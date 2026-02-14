import type * as Party from "partykit/server";
import {
  createInitialGameState,
  movePiece,
  rotatePiece,
  lockPiece,
  clearLines,
  isValidPosition,
  getHardDropPosition,
  createTetromino,
  getRandomTetromino,
  findBestPlacement,
  AI_DIFFICULTIES,
  createInitialPlayerMetrics,
  AdaptiveAI,
  applyEarthquake,
  applyClearRows,
  applyRandomSpawner,
  applyRowRotate,
  applyDeathCross,
  applyGoldDigger,
  type AIPersona,
  type GameState as CoreGameState,
  type Tetromino,
  type Board,
  type AIMove,
  type PlayerMetrics,
} from '@tetris-battle/game-core';

interface GameState {
  board: any;
  score: number;
  stars: number;
  linesCleared: number;
  comboCount: number;
  isGameOver: boolean;
}

interface PlayerState {
  playerId: string;
  connectionId: string;
  gameState: GameState | null;
  metrics: PlayerMetrics;
  lastPieceLockTime: number;
}

export default class GameRoomServer implements Party.Server {
  players: Map<string, PlayerState> = new Map();
  roomStatus: 'waiting' | 'playing' | 'finished' = 'waiting';
  winnerId: string | null = null;

  // AI fields
  aiPlayer: AIPersona | null = null;
  aiGameState: CoreGameState | null = null;
  aiInterval: ReturnType<typeof setInterval> | null = null;
  aiMoveQueue: AIMove[] = [];
  aiLastMoveTime: number = 0;
  aiLastGravityTime: number = 0;
  adaptiveAI: AdaptiveAI | null = null;
  aiAbilityLoadout: string[] = [];
  aiLastAbilityUse: number = 0;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connected to game room ${this.room.id}: ${conn.id}`);

    // Send current room state
    conn.send(JSON.stringify({
      type: 'room_state',
      status: this.roomStatus,
      playerCount: this.players.size,
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'join_game':
        this.handleJoinGame(data.playerId, sender, data.aiOpponent);
        break;
      case 'game_state_update':
        this.handleGameStateUpdate(data.playerId, data.state, sender);
        break;
      case 'game_event':
        this.handleGameEvent(data.playerId, data.event, sender);
        break;
      case 'ability_activation':
        this.handleAbilityActivation(data.playerId, data.abilityType, data.targetPlayerId);
        break;
      case 'game_over':
        this.handleGameOver(data.playerId);
        break;
    }
  }

  handleJoinGame(playerId: string, conn: Party.Connection, aiOpponent?: AIPersona) {
    this.players.set(playerId, {
      playerId,
      connectionId: conn.id,
      gameState: null,
      metrics: createInitialPlayerMetrics(),
      lastPieceLockTime: Date.now(),
    });

    // If AI opponent provided, set it up
    if (aiOpponent) {
      this.aiPlayer = aiOpponent;
      this.players.set(aiOpponent.id, {
        playerId: aiOpponent.id,
        connectionId: 'ai', // Fake connection ID for AI
        gameState: null,
        metrics: createInitialPlayerMetrics(),
        lastPieceLockTime: Date.now(),
      });
      console.log(`AI opponent ${aiOpponent.id} (${aiOpponent.difficulty}) added to game`);
    }

    console.log(`Player ${playerId} joined. Total players: ${this.players.size}`);

    // If we have 2 players, start game
    if (this.players.size === 2 && this.roomStatus === 'waiting') {
      this.roomStatus = 'playing';

      this.broadcast({
        type: 'game_start',
        players: Array.from(this.players.keys()),
      });

      // Start AI game loop if this is an AI match
      if (this.aiPlayer) {
        this.startAIGameLoop();
      }
    }

    // Send opponent info if available
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      conn.send(JSON.stringify({
        type: 'opponent_info',
        opponentId: opponent.playerId,
        opponentState: opponent.gameState,
      }));
    }
  }

  startAIGameLoop() {
    if (!this.aiPlayer) return;

    // Get human player for metrics
    const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
    if (!humanPlayer) return;

    // Initialize adaptive AI with player metrics
    this.adaptiveAI = new AdaptiveAI(humanPlayer.metrics);

    // Set AI ability loadout (simple set for level 1+ players)
    this.aiAbilityLoadout = [
      'earthquake',
      'random_spawner',
      'death_cross',
      'row_rotate',
      'gold_digger',
    ];
    this.aiLastAbilityUse = Date.now();

    // Initialize AI game state
    this.aiGameState = createInitialGameState();
    this.aiGameState.currentPiece = createTetromino(
      this.aiGameState.nextPieces[0],
      this.aiGameState.board.width
    );
    this.aiGameState.nextPieces.shift();
    this.aiGameState.nextPieces.push(getRandomTetromino());

    const config = AI_DIFFICULTIES[this.aiPlayer.difficulty];

    this.aiInterval = setInterval(() => {
      if (!this.aiGameState || !this.aiGameState.currentPiece || this.aiGameState.isGameOver) {
        return;
      }

      const now = Date.now();

      // Apply gravity (piece falls down naturally like human players)
      const GRAVITY_INTERVAL = 1000; // Same as human players: 1 second
      if (now - this.aiLastGravityTime >= GRAVITY_INTERVAL) {
        this.aiLastGravityTime = now;

        // Try to move piece down
        const pieceBelowMe = movePiece(this.aiGameState.currentPiece, 0, 1);
        if (isValidPosition(this.aiGameState.board, pieceBelowMe)) {
          this.aiGameState.currentPiece = pieceBelowMe;
          // Broadcast state after gravity
          this.broadcastAIState();
        } else {
          // Piece hit bottom - lock it
          this.aiGameState.board = lockPiece(this.aiGameState.board, this.aiGameState.currentPiece);
          const { board, linesCleared } = clearLines(this.aiGameState.board);
          this.aiGameState.board = board;
          this.aiGameState.linesCleared += linesCleared;
          this.aiGameState.score += linesCleared * 100;
          this.aiGameState.stars += linesCleared * 10;

          // Spawn next piece
          this.aiGameState.currentPiece = createTetromino(
            this.aiGameState.nextPieces[0],
            this.aiGameState.board.width
          );
          this.aiGameState.nextPieces.shift();
          this.aiGameState.nextPieces.push(getRandomTetromino());

          // Check game over
          if (!isValidPosition(this.aiGameState.board, this.aiGameState.currentPiece)) {
            this.aiGameState.isGameOver = true;
            this.handleGameOver(this.aiPlayer!.id);
          }

          // AI ability usage after locking piece
          this.aiConsiderUsingAbility();

          // Clear move queue (start fresh for new piece)
          this.aiMoveQueue = [];

          // Broadcast updated state
          this.broadcastAIState();
          return;
        }
      }

      // Use adaptive move delay for AI actions
      const moveDelay = this.adaptiveAI ? this.adaptiveAI.decideMoveDelay() : 300;

      if (now - this.aiLastMoveTime < moveDelay) {
        return;
      }

      // If no moves queued, decide next placement using adaptive AI
      if (this.aiMoveQueue.length === 0 && this.adaptiveAI) {
        const decision = this.adaptiveAI.findMove(
          this.aiGameState.board,
          this.aiGameState.currentPiece
        );
        this.aiMoveQueue = decision.moves;
      }

      // Execute next move (only left/right/rotate - not hard_drop anymore)
      const move = this.aiMoveQueue.shift();
      if (!move) return;

      let newPiece = this.aiGameState.currentPiece;

      switch (move.type) {
        case 'left':
          newPiece = movePiece(newPiece, -1, 0);
          break;
        case 'right':
          newPiece = movePiece(newPiece, 1, 0);
          break;
        case 'rotate_cw':
          newPiece = rotatePiece(newPiece, true);
          break;
        case 'rotate_ccw':
          newPiece = rotatePiece(newPiece, false);
          break;
        case 'hard_drop':
          // Skip hard_drop - gravity will handle locking naturally
          break;
      }

      // Validate and update piece (only for left/right/rotate)
      if (move.type !== 'hard_drop') {
        if (isValidPosition(this.aiGameState.board, newPiece)) {
          this.aiGameState.currentPiece = newPiece;
        }
      }

      this.aiLastMoveTime = now;

      // Broadcast AI state after move
      this.broadcastAIState();
    }, 50); // Check every 50ms, but moveDelay controls actual move rate
  }

  handleGameStateUpdate(playerId: string, state: GameState, sender: Party.Connection) {
    const player = this.players.get(playerId);
    if (!player) return;

    const previousState = player.gameState;
    player.gameState = state;

    // Update player metrics if piece count increased (piece was locked)
    if (previousState && previousState.linesCleared !== undefined && state.linesCleared !== undefined) {
      // Use linesCleared as a proxy for pieces - not perfect but simple
      // Better: track score increases
      const pieceLocked = previousState.score !== state.score;

      if (pieceLocked) {
        const now = Date.now();
        const lockTime = now - player.lastPieceLockTime;
        player.lastPieceLockTime = now;

        // Update metrics (rolling average)
        const metrics = player.metrics;
        metrics.pieceCount++;
        metrics.totalLockTime += lockTime;
        metrics.averageLockTime = metrics.totalLockTime / metrics.pieceCount;

        // Calculate PPM (pieces per minute)
        const elapsedMinutes = (now - metrics.lastUpdateTime) / 60000;
        if (elapsedMinutes > 0.1) {
          metrics.averagePPM = metrics.pieceCount / elapsedMinutes;
        }

        // Calculate average board height
        const boardHeight = this.calculateBoardHeight(state.board);
        if (metrics.pieceCount === 1) {
          metrics.averageBoardHeight = boardHeight;
        } else {
          // Exponential moving average (favor recent data)
          metrics.averageBoardHeight = metrics.averageBoardHeight * 0.9 + boardHeight * 0.1;
        }

        // Update adaptive AI with new metrics
        if (this.adaptiveAI) {
          this.adaptiveAI.updatePlayerMetrics(metrics);
        }
      }
    }

    // Broadcast to opponent
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      const opponentConn = this.getConnection(opponent.connectionId);
      if (opponentConn) {
        opponentConn.send(JSON.stringify({
          type: 'opponent_state_update',
          state,
        }));
      }
    }
  }

  calculateBoardHeight(board: any): number {
    if (!board || !board.grid) return 0;

    const grid = Array.isArray(board) ? board : board.grid;
    if (!grid || !Array.isArray(grid)) return 0;

    let maxHeight = 0;
    const height = grid.length;
    const width = grid[0] ? grid[0].length : 10;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (grid[y] && grid[y][x] !== null) {
          maxHeight = Math.max(maxHeight, height - y);
          break;
        }
      }
    }
    return maxHeight;
  }

  handleGameEvent(playerId: string, event: any, sender: Party.Connection) {
    // Broadcast event to opponent
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      const opponentConn = this.getConnection(opponent.connectionId);
      if (opponentConn) {
        opponentConn.send(JSON.stringify({
          type: 'opponent_event',
          event,
        }));
      }
    }
  }

  handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string) {
    const targetPlayer = this.players.get(targetPlayerId);
    if (!targetPlayer) return;

    // If target is AI, apply ability to AI board directly
    if (this.aiPlayer && targetPlayerId === this.aiPlayer.id && this.aiGameState) {
      this.applyAbilityToAI(abilityType);
      return;
    }

    // If target is human player, send ability_received message
    const targetConn = this.getConnection(targetPlayer.connectionId);
    if (targetConn) {
      targetConn.send(JSON.stringify({
        type: 'ability_received',
        abilityType,
        fromPlayerId: playerId,
      }));
    }
  }

  applyAbilityToAI(abilityType: string) {
    if (!this.aiGameState) return;

    console.log(`Applying ability ${abilityType} to AI`);

    switch (abilityType) {
      case 'earthquake':
        this.aiGameState.board = applyEarthquake(this.aiGameState.board);
        break;

      case 'clear_rows':
        const { board: clearedBoard } = applyClearRows(this.aiGameState.board, 5);
        this.aiGameState.board = clearedBoard;
        break;

      case 'random_spawner':
        this.aiGameState.board = applyRandomSpawner(this.aiGameState.board);
        break;

      case 'row_rotate':
        this.aiGameState.board = applyRowRotate(this.aiGameState.board);
        break;

      case 'death_cross':
        this.aiGameState.board = applyDeathCross(this.aiGameState.board);
        break;

      case 'gold_digger':
        this.aiGameState.board = applyGoldDigger(this.aiGameState.board);
        break;

      // Time-based debuffs (not fully implemented for AI yet)
      case 'speed_up_opponent':
      case 'reverse_controls':
      case 'rotation_lock':
      case 'blind_spot':
      case 'screen_shake':
      case 'shrink_ceiling':
      case 'cascade_multiplier':
        console.log(`Time-based ability ${abilityType} on AI - effect limited`);
        break;

      // Buff abilities shouldn't target AI
      case 'cross_firebomb':
      case 'circle_bomb':
      case 'mini_blocks':
      case 'fill_holes':
        console.warn(`Buff ability ${abilityType} sent to AI - ignoring`);
        break;

      default:
        console.warn(`Unknown ability type: ${abilityType}`);
    }

    // Clear AI move queue to force re-planning with new board state
    this.aiMoveQueue = [];

    // Broadcast updated AI state to human player immediately
    this.broadcastAIState();
  }

  broadcastAIState() {
    if (!this.aiGameState || !this.aiPlayer) return;

    const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
    if (!humanPlayer) return;

    const conn = this.getConnection(humanPlayer.connectionId);
    if (!conn) return;

    conn.send(JSON.stringify({
      type: 'opponent_state_update',
      state: {
        board: this.aiGameState.board.grid,
        score: this.aiGameState.score,
        stars: this.aiGameState.stars,
        linesCleared: this.aiGameState.linesCleared,
        comboCount: this.aiGameState.comboCount || 0,
        isGameOver: this.aiGameState.isGameOver,
        currentPiece: this.aiGameState.currentPiece,
      },
    }));
  }

  aiConsiderUsingAbility() {
    if (!this.aiGameState || !this.aiPlayer || this.aiAbilityLoadout.length === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLastAbility = now - this.aiLastAbilityUse;

    // Cooldown: 10-30 seconds between abilities
    const minCooldown = 10000;
    const cooldownVariance = 20000;
    const cooldown = minCooldown + Math.random() * cooldownVariance;

    if (timeSinceLastAbility < cooldown) {
      return;
    }

    // Need enough stars (30-80)
    const abilityCost = 30 + Math.floor(Math.random() * 50);
    if (this.aiGameState.stars < abilityCost) {
      return;
    }

    // Get human player state
    const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
    if (!humanPlayer || !humanPlayer.gameState) {
      return;
    }

    // Decide: 30% chance to use ability when available
    const useAbility = Math.random() < 0.3;
    if (!useAbility) {
      return;
    }

    // Pick random ability from loadout
    const abilityType = this.aiAbilityLoadout[Math.floor(Math.random() * this.aiAbilityLoadout.length)];

    console.log(`AI using ability: ${abilityType} (${this.aiGameState.stars} stars)`);

    // Spend stars
    this.aiGameState.stars -= abilityCost;
    this.aiLastAbilityUse = now;

    // Send ability to human player
    const humanConn = this.getConnection(humanPlayer.connectionId);
    if (humanConn) {
      humanConn.send(JSON.stringify({
        type: 'ability_received',
        abilityType,
        fromPlayerId: this.aiPlayer.id,
      }));
    }
  }

  handleGameOver(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    // Mark as game over (handle both AI and human players)
    if (this.aiPlayer && playerId === this.aiPlayer.id) {
      // AI lost - aiGameState already marked as game over
      console.log('[GAME OVER] AI lost');
    } else if (player.gameState) {
      // Human player lost
      player.gameState.isGameOver = true;
      console.log('[GAME OVER] Human player lost');
    } else {
      console.warn('[GAME OVER] Player has no game state:', playerId);
      return;
    }

    // Determine winner
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      this.winnerId = opponent.playerId;
      this.roomStatus = 'finished';

      console.log(`[GAME OVER] Winner: ${this.winnerId}, Loser: ${playerId}`);

      this.broadcast({
        type: 'game_finished',
        winnerId: this.winnerId,
        loserId: playerId,
      });
    }
  }

  getOpponent(playerId: string): PlayerState | null {
    for (const [id, player] of this.players) {
      if (id !== playerId) return player;
    }
    return null;
  }

  getConnection(connectionId: string): Party.Connection | null {
    for (const conn of this.room.getConnections()) {
      if (conn.id === connectionId) return conn;
    }
    return null;
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.room.broadcast(message);
  }

  onClose(conn: Party.Connection) {
    // Clear AI interval if exists
    if (this.aiInterval) {
      clearInterval(this.aiInterval);
      this.aiInterval = null;
    }

    // Find and remove player
    for (const [playerId, player] of this.players) {
      if (player.connectionId === conn.id) {
        this.players.delete(playerId);
        console.log(`Player ${playerId} disconnected`);

        // Notify opponent
        const opponent = this.getOpponent(playerId);
        if (opponent) {
          const opponentConn = this.getConnection(opponent.connectionId);
          if (opponentConn) {
            opponentConn.send(JSON.stringify({
              type: 'opponent_disconnected',
            }));
          }
        }
        break;
      }
    }
  }
}
