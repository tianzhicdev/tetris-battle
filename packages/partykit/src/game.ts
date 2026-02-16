import type * as Party from "partykit/server";
import {
  createInitialPlayerMetrics,
  AdaptiveAI,
  ABILITIES,
  type AIPersona,
  type AIMove,
  type PlayerMetrics,
  type PlayerInputType,
} from '@tetris-battle/game-core';
import { ServerGameState } from './ServerGameState';

interface PlayerState {
  playerId: string;
  connectionId: string;
  metrics: PlayerMetrics;
}

type AbilityRejectReason =
  | 'unknown_ability'
  | 'invalid_target'
  | 'source_player_missing'
  | 'source_state_missing'
  | 'ability_not_in_loadout'
  | 'insufficient_stars'
  | 'target_player_missing'
  | 'target_state_missing';

interface AbilityActivationResult {
  type: 'ability_activation_result';
  requestId?: string;
  abilityType: string;
  targetPlayerId: string;
  accepted: boolean;
  reason?: AbilityRejectReason;
  message: string;
  remainingStars?: number;
  serverTime: number;
}

export default class GameRoomServer implements Party.Server {
  players: Map<string, PlayerState> = new Map();
  roomStatus: 'waiting' | 'playing' | 'finished' = 'waiting';
  winnerId: string | null = null;

  // AI fields
  aiPlayer: AIPersona | null = null;
  aiInterval: ReturnType<typeof setInterval> | null = null;
  aiMoveQueue: AIMove[] = [];
  aiLastMoveTime: number = 0;
  adaptiveAI: AdaptiveAI | null = null;
  aiAbilityLoadout: string[] = [];
  aiLastAbilityUse: number = 0;
  aiIsExecuting: boolean = false; // Prevent overlapping AI executions

  // Server-authoritative mode
  serverGameStates: Map<string, ServerGameState> = new Map();
  gameLoops: Map<string, ReturnType<typeof setTimeout>> = new Map();
  lastBroadcastTime: number = 0;
  broadcastThrottle: number = 16; // 60fps = 16ms
  roomSeed: number = 0; // Deterministic seed for this room
  playerLatencies: Map<string, number> = new Map();
  lastPlayerBroadcasts: Map<string, number> = new Map();

  constructor(readonly room: Party.Room) {
    // Generate deterministic seed from room ID
    this.roomSeed = parseInt(room.id.substring(0, 8), 36) || 12345;
  }

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
    let data: any;
    try {
      data = JSON.parse(message);
    } catch (error) {
      console.warn('[GAME] Ignoring non-JSON message:', message, error);
      sender.send(JSON.stringify({
        type: 'server_error',
        code: 'invalid_json',
        message: 'Message payload must be valid JSON',
        serverTime: Date.now(),
      }));
      return;
    }

    // Handle ping/pong for connection monitoring
    if (data.type === 'ping' || data.type === 'debug_ping') {
      // Calculate latency if this is a returning ping
      const latency = Date.now() - data.timestamp;

      // Get player ID from connection
      const playerId = this.getPlayerIdByConnection(sender.id);
      if (playerId) {
        this.playerLatencies.set(playerId, latency);
      }

      sender.send(JSON.stringify({
        type: data.type === 'ping' ? 'pong' : 'debug_pong',
        timestamp: data.timestamp,
        serverTime: Date.now(),
      }));
      return;
    }

    switch (data.type) {
      case 'join_game':
        this.handleJoinGame(data.playerId, sender, data.loadout, data.aiOpponent);
        break;
      case 'player_input':
        this.handlePlayerInput(data.playerId, data.input, data.seq);
        break;
      case 'ability_activation':
        this.handleAbilityActivation(data.playerId, data.abilityType, data.targetPlayerId, data.requestId);
        break;
      case 'game_over':
        this.handleGameOver(data.playerId);
        break;
      default:
        sender.send(JSON.stringify({
          type: 'server_error',
          code: 'unsupported_message_type',
          message: `Unsupported message type: ${String(data.type)}`,
          serverTime: Date.now(),
        }));
        break;
    }
  }

  handleJoinGame(playerId: string, conn: Party.Connection, loadout?: string[], aiOpponent?: AIPersona) {
    // Create player entry
    this.players.set(playerId, {
      playerId,
      connectionId: conn.id,
      metrics: createInitialPlayerMetrics(),
    });

    // Initialize server-side game state for this player
    const playerLoadout: string[] = loadout || [];
    const serverState = new ServerGameState(playerId, this.roomSeed, playerLoadout);
    this.serverGameStates.set(playerId, serverState);

    console.log(`[GAME] Player ${playerId} joined with server-side state`);

    // If AI opponent provided, set it up (keep existing AI logic)
    if (aiOpponent) {
      this.aiPlayer = aiOpponent;
      this.players.set(aiOpponent.id, {
        playerId: aiOpponent.id,
        connectionId: 'ai',
        metrics: createInitialPlayerMetrics(),
      });
      const aiServerState = new ServerGameState(aiOpponent.id, this.roomSeed, []);
      this.serverGameStates.set(aiOpponent.id, aiServerState);
      console.log(`AI opponent ${aiOpponent.id} added to game`);
    }

    console.log(`Player ${playerId} joined. Total players: ${this.players.size}`);

    // If we have 2 players, start game
    if (this.players.size === 2 && this.roomStatus === 'waiting') {
      this.roomStatus = 'playing';

      console.log(`[GAME] Starting server-authoritative game`, {
        player1: Array.from(this.players.keys())[0],
        player2: Array.from(this.players.keys())[1],
        hasAI: !!this.aiPlayer,
        roomId: this.room.id,
        seed: this.roomSeed,
      });

      this.broadcast({
        type: 'game_start',
        players: Array.from(this.players.keys()),
      });

      // Start game loops for all non-AI players
      for (const [pid] of this.serverGameStates) {
        this.startGameLoop(pid);
      }

      // Start AI game loop if this is an AI match
      if (this.aiPlayer) {
        this.startAIGameLoop();
      }

      // Initial state broadcast
      this.broadcastState();
    }

    // Send opponent info if available
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      conn.send(JSON.stringify({
        type: 'opponent_info',
        opponentId: opponent.playerId,
        opponentState: null,
      }));
    }
  }

  private handlePlayerInput(playerId: string, input: PlayerInputType, seq?: number): void {
    const serverState = this.serverGameStates.get(playerId);
    if (!serverState) {
      console.warn(`[INPUT] No server state for player ${playerId}`);
      if (seq !== undefined) {
        this.sendToPlayer(playerId, {
          type: 'input_rejected',
          rejectedSeq: seq,
          reason: 'no_server_state',
          serverState: null,
        });
      }
      return;
    }

    const stateChanged = serverState.processInput(input);

    if (stateChanged) {
      // Input was successful
      if (seq !== undefined) {
        this.sendToPlayer(playerId, {
          type: 'input_confirmed',
          confirmedSeq: seq,
          serverState: serverState.getPublicState(),
        });
      }
      this.broadcastState();
    } else {
      // Input failed validation (collision, etc.)
      if (seq !== undefined) {
        this.sendToPlayer(playerId, {
          type: 'input_rejected',
          rejectedSeq: seq,
          reason: 'invalid_action',
          serverState: serverState.getPublicState(),
        });
      }
    }
  }

  private startGameLoop(playerId: string): void {
    const serverState = this.serverGameStates.get(playerId);
    if (!serverState) return;

    const loop = () => {
      // Tick the game
      const stateChanged = serverState.tick();

      if (stateChanged) {
        // Check for game over
        if (serverState.gameState.isGameOver) {
          this.handleGameOver(playerId);
          this.stopGameLoop(playerId);
          return;
        }

        this.broadcastState();
      }

      // Schedule next tick (using current tick rate)
      this.gameLoops.set(playerId, setTimeout(loop, serverState.tickRate));
    };

    // Start the loop
    console.log(`[GAME LOOP] Starting for player ${playerId}`);
    this.gameLoops.set(playerId, setTimeout(loop, serverState.tickRate));
  }

  private stopGameLoop(playerId: string): void {
    const loop = this.gameLoops.get(playerId);
    if (loop) {
      clearTimeout(loop);
      this.gameLoops.delete(playerId);
      console.log(`[GAME LOOP] Stopped for player ${playerId}`);
    }
  }

  private broadcastState(): void {
    const now = Date.now();

    // Get all player states
    const playerStates: Record<string, any> = {};
    for (const [playerId, serverState] of this.serverGameStates) {
      playerStates[playerId] = serverState.getPublicState();
    }

    // Send to each player with adaptive throttling
    for (const [playerId, playerState] of this.players) {
      if (playerId === this.aiPlayer?.id) continue; // Skip AI

      const conn = this.getConnection(playerState.connectionId);
      if (!conn) continue;

      // Check player-specific throttle
      const updateRate = this.determineUpdateRate(playerId);
      const lastBroadcast = this.lastPlayerBroadcasts.get(playerId) || 0;

      if (now - lastBroadcast < updateRate) {
        continue; // Skip this player this frame
      }

      this.lastPlayerBroadcasts.set(playerId, now);

      // Find opponent
      const opponentId = this.getOpponentId(playerId);
      if (!opponentId) continue;

      const yourState = playerStates[playerId];
      const opponentState = playerStates[opponentId];

      if (!yourState || !opponentState) continue;

      conn.send(JSON.stringify({
        type: 'state_update',
        timestamp: now,
        yourState,
        opponentState,
      }));
    }
  }

  private getOpponentId(playerId: string): string | null {
    for (const id of this.players.keys()) {
      if (id !== playerId) return id;
    }
    return null;
  }

  private getPlayerIdByConnection(connectionId: string): string | null {
    for (const [playerId, playerState] of this.players) {
      if (playerState.connectionId === connectionId) {
        return playerId;
      }
    }
    return null;
  }

  private determineUpdateRate(playerId: string): number {
    const latency = this.playerLatencies.get(playerId) || 50;

    if (latency < 50) return 16;    // 60fps (16ms)
    if (latency < 100) return 33;   // 30fps (33ms)
    if (latency < 200) return 50;   // 20fps (50ms)
    return 100;                     // 10fps (100ms)
  }

  startAIGameLoop() {
    if (!this.aiPlayer) return;

    // Get human player for metrics
    const humanPlayer = Array.from(this.players.values()).find(p => p.playerId !== this.aiPlayer!.id);
    if (!humanPlayer) return;
    const aiState = this.serverGameStates.get(this.aiPlayer.id);
    if (!aiState) return;

    // Initialize adaptive AI with player metrics
    this.adaptiveAI = new AdaptiveAI(humanPlayer.metrics);

    // Set AI ability loadout (debuff-focused)
    this.aiAbilityLoadout = [
      'earthquake',
      'random_spawner',
      'death_cross',
      'row_rotate',
      'gold_digger',
      'speed_up_opponent',
      'reverse_controls',
      'rotation_lock',
      'blind_spot',
      'screen_shake',
      'shrink_ceiling',
      'weird_shapes',
    ];
    aiState.loadout = [...this.aiAbilityLoadout];
    this.aiLastAbilityUse = Date.now();

    this.aiInterval = setInterval(() => {
      // Guard: skip if previous AI execution is still running (prevents event loop blocking)
      if (this.aiIsExecuting) {
        console.warn('[AI] Skipping tick - previous execution still running');
        return;
      }

      const currentAIState = this.serverGameStates.get(this.aiPlayer!.id);
      if (!currentAIState) {
        return;
      }
      if (!currentAIState.gameState.currentPiece || currentAIState.gameState.isGameOver) {
        return;
      }

      this.aiIsExecuting = true; // Mark as executing
      const now = Date.now();

      // AI gets slower under visual disruption debuffs to mirror human impact.
      const activeEffects = new Set(currentAIState.getActiveEffects());
      let moveDelay = this.adaptiveAI ? this.adaptiveAI.decideMoveDelay() : 300;
      if (activeEffects.has('blind_spot')) moveDelay *= 1.2;
      if (activeEffects.has('screen_shake')) moveDelay *= 1.2;
      if (activeEffects.has('shrink_ceiling')) moveDelay *= 1.1;

      if (now - this.aiLastMoveTime < moveDelay) {
        this.aiIsExecuting = false;
        return;
      }

      // If no moves queued, decide next placement using adaptive AI
      if (this.aiMoveQueue.length === 0 && this.adaptiveAI) {
        const decision = this.adaptiveAI.findMove(
          currentAIState.gameState.board,
          currentAIState.gameState.currentPiece
        );
        this.aiMoveQueue = decision.moves;
      }

      let move = this.aiMoveQueue.shift();
      if (!move) {
        this.aiIsExecuting = false;
        return;
      }

      if (activeEffects.has('reverse_controls')) {
        if (move.type === 'left') move = { type: 'right' };
        else if (move.type === 'right') move = { type: 'left' };
      }

      while (
        activeEffects.has('rotation_lock') &&
        (move.type === 'rotate_cw' || move.type === 'rotate_ccw')
      ) {
        move = this.aiMoveQueue.shift() || { type: 'hard_drop' };
      }

      const input = this.aiMoveToPlayerInput(move.type);
      const linesBefore = currentAIState.gameState.linesCleared;
      const stateChanged = currentAIState.processInput(input);

      if (stateChanged) {
        this.broadcastState();
      }

      if (currentAIState.gameState.linesCleared > linesBefore) {
        this.aiConsiderUsingAbility();
      }
      if (currentAIState.gameState.isGameOver) {
        this.handleGameOver(this.aiPlayer!.id);
      }

      this.aiLastMoveTime = now;
      this.aiIsExecuting = false; // Mark as complete
    }, 200); // Increased from 50ms to 200ms to prevent event loop blocking
  }

  private aiMoveToPlayerInput(moveType: AIMove['type']): PlayerInputType {
    switch (moveType) {
      case 'left':
        return 'move_left';
      case 'right':
        return 'move_right';
      case 'rotate_cw':
        return 'rotate_cw';
      case 'rotate_ccw':
        return 'rotate_ccw';
      case 'hard_drop':
      default:
        return 'hard_drop';
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

  handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string, requestId?: string) {
    console.log(`[ABILITY] Request id=${requestId ?? 'n/a'} ${playerId} -> ${targetPlayerId}: ${abilityType}`);
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    if (!ability) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'unknown_ability', `Unknown ability type: ${abilityType}`);
      return;
    }

    // Validate target category
    if (ability.category === 'buff' && targetPlayerId !== playerId) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'invalid_target', `Buff ${abilityType} must target self`);
      return;
    }
    if (ability.category === 'debuff' && targetPlayerId === playerId) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'invalid_target', `Debuff ${abilityType} must target opponent`);
      return;
    }

    // Validate source player state and star cost
    const playerState = this.serverGameStates.get(playerId);
    const sourcePlayer = this.players.get(playerId);
    if (!sourcePlayer) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'source_player_missing', `Source player not found: ${playerId}`);
      return;
    }
    if (!playerState) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'source_state_missing', `Source server state not found for ${playerId}`);
      return;
    }
    if (playerState.loadout.length > 0 && !playerState.loadout.includes(abilityType)) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'ability_not_in_loadout', `${abilityType} is not in ${playerId}'s loadout`);
      return;
    }
    if (playerState.gameState.stars < ability.cost) {
      this.rejectAbilityActivation(
        playerId,
        abilityType,
        targetPlayerId,
        requestId,
        'insufficient_stars',
        `Insufficient stars for ${abilityType}: ${playerState.gameState.stars}/${ability.cost}`
      );
      return;
    }
    playerState.gameState.stars -= ability.cost;
    console.log(`[ABILITY] Accepted id=${requestId ?? 'n/a'} ${playerId} used ${abilityType}, stars: ${playerState.gameState.stars}`);

    const targetPlayer = this.players.get(targetPlayerId);
    if (!targetPlayer) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'target_player_missing', `Target player not found: ${targetPlayerId}`);
      return;
    }

    // Apply ability to target player's server-side state
    const targetServerState = this.serverGameStates.get(targetPlayerId);
    if (!targetServerState) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'target_state_missing', `Target server state not found for ${targetPlayerId}`);
      return;
    }
    targetServerState.applyAbility(abilityType);
    const targetConn = this.getConnection(targetPlayer.connectionId);
    if (targetConn) {
      targetConn.send(JSON.stringify({
        type: 'ability_received',
        abilityType,
        fromPlayerId: playerId,
      }));
    }
    if (targetPlayerId === this.aiPlayer?.id) {
      this.aiMoveQueue = [];
    }

    this.sendAbilityActivationResult(playerId, {
      type: 'ability_activation_result',
      requestId,
      abilityType,
      targetPlayerId,
      accepted: true,
      message: `${abilityType} applied to ${targetPlayerId}`,
      remainingStars: playerState.gameState.stars,
      serverTime: Date.now(),
    });

    this.broadcastState();
  }

  private getAbilityCost(abilityType: string): number {
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    return ability?.cost ?? Number.MAX_SAFE_INTEGER;
  }

  aiConsiderUsingAbility() {
    if (!this.aiPlayer || this.aiAbilityLoadout.length === 0) {
      return;
    }
    const aiState = this.serverGameStates.get(this.aiPlayer.id);
    if (!aiState) return;

    const now = Date.now();
    const timeSinceLastAbility = now - this.aiLastAbilityUse;

    // Cooldown: 10-30 seconds between abilities
    const minCooldown = 10000;
    const cooldownVariance = 20000;
    const cooldown = minCooldown + Math.random() * cooldownVariance;

    if (timeSinceLastAbility < cooldown) {
      return;
    }

    // Get human player state for strategic decision
    const humanPlayer = Array.from(this.players.values()).find(
      p => p.playerId !== this.aiPlayer!.id && p.connectionId !== 'ai'
    );
    if (!humanPlayer) {
      return;
    }
    const humanState = this.serverGameStates.get(humanPlayer.playerId);
    if (!humanState) {
      return;
    }

    const aiBoardHeight = this.calculateBoardHeight(aiState.gameState.board);
    const playerBoardHeight = this.calculateBoardHeight(humanState.gameState.board);

    // Strategic ability selection
    let selectedAbility: string | null = null;
    const offensiveOptions = this.aiAbilityLoadout.filter(ability => {
      const metadata = ABILITIES[ability as keyof typeof ABILITIES];
      return metadata?.category === 'debuff';
    });

    // AI losing (board high) — pick an offensive debuff to disrupt player
    if (aiBoardHeight > 12 || playerBoardHeight < 6) {
      if (offensiveOptions.length > 0) {
        selectedAbility = offensiveOptions[Math.floor(Math.random() * offensiveOptions.length)];
      }
    }

    // If no strategic choice, 30% chance to use random ability
    if (!selectedAbility) {
      if (Math.random() < 0.3) {
        selectedAbility = this.aiAbilityLoadout[Math.floor(Math.random() * this.aiAbilityLoadout.length)];
      }
    }

    if (!selectedAbility) return;

    const abilityCost = this.getAbilityCost(selectedAbility);

    // AI star management: if stars too low and board is high, grant bonus stars
    if (aiState.gameState.stars < abilityCost && aiBoardHeight > 10) {
      // "Cheat slightly" per spec to maintain balance
      aiState.gameState.stars += Math.floor(abilityCost * 0.5);
    }

    if (aiState.gameState.stars < abilityCost) {
      return;
    }

    console.log(`AI using ability: ${selectedAbility} (cost: ${abilityCost}, stars: ${aiState.gameState.stars})`);
    this.aiLastAbilityUse = now;
    this.handleAbilityActivation(this.aiPlayer.id, selectedAbility, humanPlayer.playerId);
  }

  handleGameOver(playerId: string) {
    if (this.roomStatus === 'finished') return;

    const loser = this.players.get(playerId);
    if (!loser) return;

    const loserServerState = this.serverGameStates.get(playerId);
    if (loserServerState) {
      loserServerState.gameState.isGameOver = true;
    } else {
      console.warn('[GAME OVER] No authoritative state for loser:', playerId);
    }

    if (this.aiPlayer && playerId === this.aiPlayer.id) {
      console.log('[GAME OVER] AI lost');
    } else {
      console.log('[GAME OVER] Human player lost');
    }

    const opponent = this.getOpponent(playerId);
    if (!opponent) {
      console.warn('[GAME OVER] Opponent not found for loser:', playerId);
      return;
    }

    this.winnerId = opponent.playerId;
    this.roomStatus = 'finished';
    this.stopAllGameLoops();
    this.stopAIGameLoop();
    this.aiMoveQueue = [];

    console.log(`[GAME OVER] Winner: ${this.winnerId}, Loser: ${playerId}`);

    this.broadcast({
      type: 'game_finished',
      winnerId: this.winnerId,
      loserId: playerId,
    });
  }

  private stopAllGameLoops(): void {
    for (const timeout of this.gameLoops.values()) {
      clearTimeout(timeout);
    }
    this.gameLoops.clear();
  }

  private stopAIGameLoop(): void {
    if (this.aiInterval) {
      clearInterval(this.aiInterval);
      this.aiInterval = null;
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

  private sendToPlayer(playerId: string, data: any): void {
    const player = this.players.get(playerId);
    if (!player) return;
    const conn = this.getConnection(player.connectionId);
    if (!conn) return;
    conn.send(JSON.stringify(data));
  }

  private sendAbilityActivationResult(playerId: string, result: AbilityActivationResult): void {
    this.sendToPlayer(playerId, result);
  }

  private rejectAbilityActivation(
    playerId: string,
    abilityType: string,
    targetPlayerId: string,
    requestId: string | undefined,
    reason: AbilityRejectReason,
    message: string
  ): void {
    console.warn(`[ABILITY] Rejected ${abilityType} from ${playerId} -> ${targetPlayerId}: ${reason} (${message})`);
    const playerState = this.serverGameStates.get(playerId);
    this.sendAbilityActivationResult(playerId, {
      type: 'ability_activation_result',
      requestId,
      abilityType,
      targetPlayerId,
      accepted: false,
      reason,
      message,
      remainingStars: playerState?.gameState.stars,
      serverTime: Date.now(),
    });
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.room.broadcast(message);
  }

  onClose(conn: Party.Connection) {
    this.stopAIGameLoop();

    // Find and remove player
    for (const [playerId, player] of this.players) {
      if (player.connectionId === conn.id) {
        // Clean up server game state
        this.stopAllGameLoops();
        this.serverGameStates.delete(playerId);
        this.aiMoveQueue = [];
        this.roomStatus = 'finished';

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
