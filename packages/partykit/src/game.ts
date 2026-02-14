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
  type AIPersona,
  type GameState as CoreGameState,
  type Tetromino,
  type Board,
  type AIMove,
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
    });

    // If AI opponent provided, set it up
    if (aiOpponent) {
      this.aiPlayer = aiOpponent;
      this.players.set(aiOpponent.id, {
        playerId: aiOpponent.id,
        connectionId: 'ai', // Fake connection ID for AI
        gameState: null,
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

      // Rate limit moves based on difficulty
      if (now - this.aiLastMoveTime < config.moveDelay) {
        return;
      }

      // If no moves queued, decide next placement
      if (this.aiMoveQueue.length === 0) {
        const decision = findBestPlacement(
          this.aiGameState.board,
          this.aiGameState.currentPiece,
          config.weights
        );
        this.aiMoveQueue = decision.moves;
      }

      // Execute next move
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
          newPiece.position = getHardDropPosition(this.aiGameState.board, newPiece);
          // Lock piece
          this.aiGameState.board = lockPiece(this.aiGameState.board, newPiece);
          const { board, linesCleared } = clearLines(this.aiGameState.board);
          this.aiGameState.board = board;
          this.aiGameState.linesCleared += linesCleared;
          this.aiGameState.score += linesCleared * 100;

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

          break;
      }

      // Validate and update piece
      if (move.type !== 'hard_drop') {
        if (isValidPosition(this.aiGameState.board, newPiece)) {
          this.aiGameState.currentPiece = newPiece;
        }
      }

      this.aiLastMoveTime = now;

      // Broadcast AI state to human opponent
      const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
      if (humanPlayer) {
        const conn = this.getConnection(humanPlayer.connectionId);
        if (conn) {
          conn.send(JSON.stringify({
            type: 'opponent_state_update',
            state: {
              board: this.aiGameState.board.grid, // Send just the grid, not the Board object
              score: this.aiGameState.score,
              stars: this.aiGameState.stars,
              linesCleared: this.aiGameState.linesCleared,
              comboCount: this.aiGameState.comboCount || 0,
              isGameOver: this.aiGameState.isGameOver,
              currentPiece: this.aiGameState.currentPiece,
            },
          }));
        }
      }
    }, 50); // Check every 50ms, but moveDelay controls actual move rate
  }

  handleGameStateUpdate(playerId: string, state: GameState, sender: Party.Connection) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.gameState = state;

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

    const targetConn = this.getConnection(targetPlayer.connectionId);
    if (targetConn) {
      targetConn.send(JSON.stringify({
        type: 'ability_received',
        abilityType,
        fromPlayerId: playerId,
      }));
    }
  }

  handleGameOver(playerId: string) {
    const player = this.players.get(playerId);
    if (!player || !player.gameState) return;

    player.gameState.isGameOver = true;

    // Determine winner
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      this.winnerId = opponent.playerId;
      this.roomStatus = 'finished';

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
