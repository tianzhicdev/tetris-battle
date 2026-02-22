import type * as Party from "partykit/server";
import {
  createInitialPlayerMetrics,
  DeterministicBattleAI,
  ABILITIES,
  getAbilityTargeting,
  isDebuffAbility,
  STAR_VALUES,
  type AIPersona,
  type AIMove,
  type PlayerMetrics,
  type PlayerInputType,
} from '@tetris-battle/game-core';
import { ServerGameState } from './ServerGameState';

/**
 * Lightweight opponent state summary sent by clients at low frequency.
 * Much smaller than the full state_update the old server used to broadcast.
 */
interface OpponentSummary {
  board: any[][];
  boardWidth: number;
  boardHeight: number;
  currentPiece: any;
  magnetGhost?: any | null;
  nextPieces: string[];
  score: number;
  stars: number;
  linesCleared: number;
  comboCount: number;
  isGameOver: boolean;
  activeEffects: string[];
  timedEffects?: Array<{ abilityType: string; remainingMs: number; durationMs: number }>;
  pieceCountEffects?: Array<{ abilityType: string; remaining: number; total: number }>;
  tiltDirection?: number;
}

interface PlayerState {
  playerId: string;
  connectionId: string;
  metrics: PlayerMetrics;
  loadout: string[];
  /** Latest state summary reported by this player's client */
  lastSummary: OpponentSummary | null;
  /** Stars tracked server-side for ability cost validation */
  stars: number;
}

type AbilityRejectReason =
  | 'unknown_ability'
  | 'invalid_target'
  | 'source_player_missing'
  | 'source_state_missing'
  | 'ability_not_in_loadout'
  | 'insufficient_stars'
  | 'target_player_missing'
  | 'target_state_missing'
  | 'clone_no_ability'
  | 'blocked_by_shield'
  | 'reflected_by_opponent';

interface AbilityActivationResult {
  type: 'ability_activation_result';
  requestId?: string;
  abilityType: string;
  appliedAbilityType?: string;
  targetPlayerId: string;
  finalTargetPlayerId?: string;
  accepted: boolean;
  reason?: AbilityRejectReason;
  interceptedBy?: 'shield' | 'reflect';
  message: string;
  chargedCost?: number;
  remainingStars?: number;
  serverTime: number;
}

/**
 * GameRoomRelay: A thin relay server for client-authoritative Tetris.
 *
 * Each client runs its own game simulation locally. The server only:
 * 1. Coordinates join/leave and game start
 * 2. Shares the room seed so both clients get deterministic piece sequences
 * 3. Relays opponent state summaries between clients (at client-chosen frequency)
 * 4. Validates and relays ability activations (with star cost checks)
 * 5. Runs the AI opponent (since there's no AI "client")
 * 6. Handles game_over
 *
 * This eliminates per-input round trips and full-state broadcasts,
 * reducing network traffic by ~95%.
 */
export default class GameRoomRelay implements Party.Server {
  readonly room: Party.Room;
  players: Map<string, PlayerState> = new Map();
  roomStatus: 'waiting' | 'playing' | 'finished' = 'waiting';
  winnerId: string | null = null;
  roomSeed: number = 0;

  // Defensive state tracking (server-side, for shield/reflect validation)
  playerDefensiveEffects: Map<string, Map<string, number>> = new Map(); // playerId -> (effect -> endTime)
  lastNonCloneAbilityByPlayer: Map<string, string> = new Map();

  // AI fields (AI still runs server-side since there's no AI client)
  aiPlayer: AIPersona | null = null;
  aiInterval: ReturnType<typeof setInterval> | null = null;
  aiMoveQueue: AIMove[] = [];
  aiLastMoveTime: number = 0;
  battleAI: DeterministicBattleAI | null = null;
  aiAbilityLoadout: string[] = [];
  aiLastAbilityUse: number = 0;
  aiIsExecuting: boolean = false;
  aiServerState: ServerGameState | null = null;
  aiGameLoop: ReturnType<typeof setTimeout> | null = null;

  constructor(room: Party.Room) {
    this.room = room;
    this.roomSeed = parseInt(room.id.substring(0, 8), 36) || 12345;
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    void ctx;
    console.log(`[RELAY] Player connected to game room ${this.room.id}: ${conn.id}`);
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
      console.warn('[RELAY] Ignoring non-JSON message:', message, error);
      sender.send(JSON.stringify({
        type: 'server_error',
        code: 'invalid_json',
        message: 'Message payload must be valid JSON',
        serverTime: Date.now(),
      }));
      return;
    }

    if (data.type === 'ping' || data.type === 'debug_ping') {
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
      case 'state_summary':
        this.handleStateSummary(data.playerId, data.summary);
        break;
      case 'stars_update':
        this.handleStarsUpdate(data.playerId, data.stars);
        break;
      case 'ability_activation':
        this.handleAbilityActivation(data.playerId, data.abilityType, data.targetPlayerId, data.requestId);
        break;
      case 'defensive_effect_update':
        this.handleDefensiveEffectUpdate(data.playerId, data.effect, data.endTime);
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
    const playerLoadout: string[] = loadout || [];
    this.players.set(playerId, {
      playerId,
      connectionId: conn.id,
      metrics: createInitialPlayerMetrics(),
      loadout: playerLoadout,
      lastSummary: null,
      stars: STAR_VALUES.startingPool,
    });
    this.playerDefensiveEffects.set(playerId, new Map());
    this.lastNonCloneAbilityByPlayer.delete(playerId);

    console.log(`[RELAY] Player ${playerId} joined`);

    // Set up AI if provided
    if (aiOpponent) {
      this.aiPlayer = aiOpponent;
      this.players.set(aiOpponent.id, {
        playerId: aiOpponent.id,
        connectionId: 'ai',
        metrics: createInitialPlayerMetrics(),
        loadout: [],
        lastSummary: null,
        stars: STAR_VALUES.startingPool,
      });
      this.playerDefensiveEffects.set(aiOpponent.id, new Map());
      // Initialize AI server state (AI still needs server-side simulation)
      this.aiServerState = new ServerGameState(aiOpponent.id, this.roomSeed, []);
      console.log(`[RELAY] AI opponent ${aiOpponent.id} added`);
    }

    console.log(`[RELAY] Player count: ${this.players.size}`);

    if (this.players.size === 2 && this.roomStatus === 'waiting') {
      this.roomStatus = 'playing';
      const playerIds = Array.from(this.players.keys());

      console.log(`[RELAY] Starting client-authoritative game`, {
        player1: playerIds[0],
        player2: playerIds[1],
        hasAI: !!this.aiPlayer,
        roomId: this.room.id,
        seed: this.roomSeed,
      });

      // Broadcast game_start with the room seed so clients can
      // initialize their own deterministic game state.
      this.broadcast({
        type: 'game_start',
        players: playerIds,
        seed: this.roomSeed,
      });

      // Start AI game loop if this is an AI match
      if (this.aiPlayer && this.aiServerState) {
        this.startAIGameLoop();
        this.startAITickLoop();
      }
    }

    // Send opponent info
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      conn.send(JSON.stringify({
        type: 'opponent_info',
        opponentId: opponent.playerId,
        opponentState: null,
      }));
    }
  }

  /**
   * Client sends a lightweight summary of its game state.
   * We relay it to the opponent as their opponent view.
   */
  private handleStateSummary(playerId: string, summary: OpponentSummary): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.lastSummary = summary;

    // Update server-tracked stars from summary
    if (typeof summary.stars === 'number') {
      player.stars = summary.stars;
    }

    // Relay to opponent
    const opponentId = this.getOpponentId(playerId);
    if (!opponentId) return;
    if (opponentId === this.aiPlayer?.id) return; // AI doesn't need summaries

    this.sendToPlayer(opponentId, {
      type: 'opponent_state',
      playerId,
      summary,
      serverTime: Date.now(),
    });
  }

  /**
   * Client sends star count updates (after line clears, passive regen, etc.)
   * so the server can validate ability costs.
   */
  private handleStarsUpdate(playerId: string, stars: number): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.stars = stars;
  }

  /**
   * Client reports its defensive effect state (shield/reflect) so the server
   * can resolve ability interceptions correctly.
   */
  private handleDefensiveEffectUpdate(playerId: string, effect: string, endTime: number): void {
    const effects = this.playerDefensiveEffects.get(playerId);
    if (!effects) return;

    if (endTime <= 0) {
      effects.delete(effect);
    } else {
      effects.set(effect, endTime);
    }
  }

  handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string, requestId?: string) {
    console.log(`[RELAY ABILITY] Request id=${requestId ?? 'n/a'} ${playerId} -> ${targetPlayerId}: ${abilityType}`);
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    if (!ability) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'unknown_ability', `Unknown ability type: ${abilityType}`);
      return;
    }

    // Validate target category
    const targeting = getAbilityTargeting(ability);
    if (targeting === 'self' && targetPlayerId !== playerId) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'invalid_target', `${abilityType} must target self`);
      return;
    }
    if (targeting === 'opponent' && targetPlayerId === playerId) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'invalid_target', `${abilityType} must target opponent`);
      return;
    }

    // Validate source
    const sourcePlayer = this.players.get(playerId);
    if (!sourcePlayer) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'source_player_missing', `Source player not found: ${playerId}`);
      return;
    }
    if (sourcePlayer.loadout.length > 0 && !sourcePlayer.loadout.includes(abilityType)) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'ability_not_in_loadout', `${abilityType} is not in ${playerId}'s loadout`);
      return;
    }

    const targetPlayer = this.players.get(targetPlayerId);
    if (!targetPlayer) {
      this.rejectAbilityActivation(playerId, abilityType, targetPlayerId, requestId, 'target_player_missing', `Target player not found: ${targetPlayerId}`);
      return;
    }

    // Star cost validation (use server-tracked stars, allow small tolerance for latency)
    const chargedCost = ability.cost; // No overcharge discount in relay mode for simplicity
    if (sourcePlayer.stars < chargedCost) {
      this.rejectAbilityActivation(
        playerId, abilityType, targetPlayerId, requestId,
        'insufficient_stars',
        `Insufficient stars for ${abilityType}: ${sourcePlayer.stars}/${chargedCost}`
      );
      return;
    }
    sourcePlayer.stars -= chargedCost;
    console.log(`[RELAY ABILITY] Accepted id=${requestId ?? 'n/a'} ${playerId} used ${abilityType}, charged=${chargedCost}, stars=${sourcePlayer.stars}`);

    let interceptedBy: 'shield' | 'reflect' | undefined;
    let finalTargetPlayerId = targetPlayerId;
    let fromPlayerId = playerId;

    // Defensive interception (server-validated)
    if (isDebuffAbility(ability)) {
      const interception = this.consumeDefensiveInterception(targetPlayerId);
      if (interception === 'shield') {
        interceptedBy = 'shield';
        console.log(`[RELAY ABILITY] Blocked by shield`);
      } else if (interception === 'reflect') {
        interceptedBy = 'reflect';
        finalTargetPlayerId = playerId;
        fromPlayerId = targetPlayerId;
        console.log(`[RELAY ABILITY] Reflected back to ${playerId}`);
      }
    }

    if (interceptedBy === 'shield') {
      if (abilityType !== 'clone') {
        this.lastNonCloneAbilityByPlayer.set(playerId, abilityType);
      }
      this.sendAbilityActivationResult(playerId, {
        type: 'ability_activation_result',
        requestId,
        abilityType,
        appliedAbilityType: abilityType,
        targetPlayerId,
        finalTargetPlayerId: targetPlayerId,
        accepted: false,
        reason: 'blocked_by_shield',
        interceptedBy: 'shield',
        message: `${abilityType} blocked by shield`,
        chargedCost,
        remainingStars: sourcePlayer.stars,
        serverTime: Date.now(),
      });
      this.sendToPlayer(targetPlayerId, {
        type: 'ability_blocked',
        abilityType,
        fromPlayerId: playerId,
        blockedBy: 'shield',
        serverTime: Date.now(),
      });
      return;
    }

    let appliedAbilityType = abilityType;

    // Clone resolution
    if (abilityType === 'clone') {
      const cloneSourcePlayerId = finalTargetPlayerId === playerId ? targetPlayerId : finalTargetPlayerId;
      const copiedAbilityType = this.lastNonCloneAbilityByPlayer.get(cloneSourcePlayerId);
      const copiedAbility = copiedAbilityType
        ? ABILITIES[copiedAbilityType as keyof typeof ABILITIES]
        : undefined;

      if (!copiedAbility) {
        sourcePlayer.stars = Math.min(STAR_VALUES.maxCapacity, sourcePlayer.stars + chargedCost);
        this.sendAbilityActivationResult(playerId, {
          type: 'ability_activation_result',
          requestId,
          abilityType,
          appliedAbilityType: abilityType,
          targetPlayerId,
          finalTargetPlayerId,
          accepted: false,
          reason: 'clone_no_ability',
          message: 'Clone failed: opponent has no cloneable ability yet',
          chargedCost: 0,
          remainingStars: sourcePlayer.stars,
          serverTime: Date.now(),
        });
        return;
      }

      appliedAbilityType = copiedAbility.type;
      if (getAbilityTargeting(copiedAbility) === 'self') {
        finalTargetPlayerId = playerId;
        fromPlayerId = playerId;
      }
    }

    // Apply ability to AI server state if targeting AI
    if (finalTargetPlayerId === this.aiPlayer?.id && this.aiServerState) {
      if (appliedAbilityType === 'purge') {
        this.aiServerState.clearTimedEffects();
      } else {
        this.aiServerState.applyAbility(appliedAbilityType);
      }
      this.aiMoveQueue = [];
    }

    // Notify the target player to apply the ability locally
    if (finalTargetPlayerId !== this.aiPlayer?.id) {
      this.sendToPlayer(finalTargetPlayerId, {
        type: 'ability_received',
        abilityType: appliedAbilityType,
        fromPlayerId,
      });
    }

    // If purge, also notify the opponent
    if (appliedAbilityType === 'purge') {
      const opponentId = this.getOpponentId(playerId);
      if (opponentId && opponentId !== finalTargetPlayerId && opponentId !== this.aiPlayer?.id) {
        this.sendToPlayer(opponentId, {
          type: 'ability_received',
          abilityType: 'purge',
          fromPlayerId: playerId,
        });
      }
    }

    if (abilityType !== 'clone') {
      this.lastNonCloneAbilityByPlayer.set(playerId, abilityType);
    }

    this.sendAbilityActivationResult(playerId, {
      type: 'ability_activation_result',
      requestId,
      abilityType,
      appliedAbilityType,
      targetPlayerId,
      finalTargetPlayerId,
      accepted: interceptedBy !== 'reflect',
      reason: interceptedBy === 'reflect' ? 'reflected_by_opponent' : undefined,
      interceptedBy,
      message: interceptedBy === 'reflect'
        ? `${abilityType} reflected back to ${playerId}`
        : `${appliedAbilityType} applied to ${finalTargetPlayerId}`,
      chargedCost,
      remainingStars: sourcePlayer.stars,
      serverTime: Date.now(),
    });
  }

  private consumeDefensiveInterception(targetPlayerId: string): 'shield' | 'reflect' | null {
    const effects = this.playerDefensiveEffects.get(targetPlayerId);
    if (!effects) return null;

    const now = Date.now();

    // Reflect has priority
    const reflectEnd = effects.get('reflect');
    if (typeof reflectEnd === 'number' && reflectEnd > now) {
      effects.delete('reflect');
      return 'reflect';
    }

    const shieldEnd = effects.get('shield');
    if (typeof shieldEnd === 'number' && shieldEnd > now) {
      effects.delete('shield');
      return 'shield';
    }

    return null;
  }

  // ============================
  // AI logic (runs server-side)
  // ============================

  private startAITickLoop(): void {
    if (!this.aiServerState) return;

    const loop = () => {
      if (!this.aiServerState) return;
      const stateChanged = this.aiServerState.tick();

      if (stateChanged) {
        if (this.aiServerState.gameState.isGameOver) {
          this.handleGameOver(this.aiPlayer!.id);
          return;
        }
        // Broadcast AI state to human player
        this.broadcastAIState();
      }

      this.aiGameLoop = setTimeout(loop, this.aiServerState.tickRate);
    };

    this.aiGameLoop = setTimeout(loop, this.aiServerState.tickRate);
  }

  startAIGameLoop() {
    if (!this.aiPlayer || !this.aiServerState) return;

    const reactionCadenceMs = this.resolveAIReactionCadenceMs();
    this.battleAI = new DeterministicBattleAI(reactionCadenceMs);

    this.aiAbilityLoadout = Object.values(ABILITIES)
      .filter((ability) => isDebuffAbility(ability))
      .map((ability) => ability.type)
      .sort((a, b) => {
        const costDiff = this.getAbilityCost(b) - this.getAbilityCost(a);
        if (costDiff !== 0) return costDiff;
        return a.localeCompare(b);
      });
    this.aiServerState.loadout = [...this.aiAbilityLoadout];
    this.aiLastAbilityUse = Date.now();

    this.aiInterval = setInterval(() => {
      if (this.aiIsExecuting) return;
      if (!this.aiServerState) return;
      if (!this.aiServerState.gameState.currentPiece || this.aiServerState.gameState.isGameOver) return;

      this.aiIsExecuting = true;
      const now = Date.now();

      const activeEffects = new Set(this.aiServerState.getActiveEffects());
      let moveDelay = this.battleAI ? this.battleAI.decideMoveDelay() : 200;
      if (activeEffects.has('blind_spot')) moveDelay *= 1.2;
      if (activeEffects.has('screen_shake')) moveDelay *= 1.2;
      if (activeEffects.has('shrink_ceiling')) moveDelay *= 1.1;

      if (now - this.aiLastMoveTime < moveDelay) {
        this.aiIsExecuting = false;
        return;
      }

      if (this.aiMoveQueue.length === 0 && this.battleAI) {
        const decision = this.battleAI.findMove(
          this.aiServerState.gameState.board,
          this.aiServerState.gameState.currentPiece
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
      const linesBefore = this.aiServerState.gameState.linesCleared;
      const stateChanged = this.aiServerState.processInput(input);

      if (stateChanged) {
        this.broadcastAIState();
      }

      if (this.aiServerState.gameState.linesCleared > linesBefore) {
        this.aiConsiderUsingAbility();
      }
      if (this.aiServerState.gameState.isGameOver) {
        this.handleGameOver(this.aiPlayer!.id);
      }

      this.aiLastMoveTime = now;
      this.aiIsExecuting = false;
    }, 50);
  }

  private broadcastAIState(): void {
    if (!this.aiServerState || !this.aiPlayer) return;

    const aiState = this.aiServerState.getPublicState();

    // Update AI player's stored summary
    const aiPlayerState = this.players.get(this.aiPlayer.id);
    if (aiPlayerState) {
      aiPlayerState.lastSummary = aiState;
      aiPlayerState.stars = this.aiServerState.gameState.stars;
    }

    // Send to human player as opponent state
    for (const [pid] of this.players) {
      if (pid === this.aiPlayer.id) continue;
      this.sendToPlayer(pid, {
        type: 'opponent_state',
        playerId: this.aiPlayer.id,
        summary: aiState,
        serverTime: Date.now(),
      });
    }
  }

  private resolveAIReactionCadenceMs(): number {
    const cadence = this.aiPlayer?.reactionCadenceMs;
    if (typeof cadence !== 'number' || !Number.isFinite(cadence)) return 180;
    return Math.max(60, Math.min(1200, Math.round(cadence)));
  }

  private aiMoveToPlayerInput(moveType: AIMove['type']): PlayerInputType {
    switch (moveType) {
      case 'left': return 'move_left';
      case 'right': return 'move_right';
      case 'rotate_cw': return 'rotate_cw';
      case 'rotate_ccw': return 'rotate_ccw';
      case 'hard_drop':
      default: return 'hard_drop';
    }
  }

  private getAbilityCost(abilityType: string): number {
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    return ability?.cost ?? Number.MAX_SAFE_INTEGER;
  }

  aiConsiderUsingAbility() {
    if (!this.aiPlayer || this.aiAbilityLoadout.length === 0 || !this.aiServerState) return;

    const now = Date.now();
    const timeSinceLastAbility = now - this.aiLastAbilityUse;
    const cooldown = 12000;

    if (timeSinceLastAbility < cooldown) return;

    const humanPlayer = Array.from(this.players.values()).find(
      p => p.playerId !== this.aiPlayer!.id && p.connectionId !== 'ai'
    );
    if (!humanPlayer) return;

    const pickAffordableAbility = (): string | null => {
      for (const abilityType of this.aiAbilityLoadout) {
        if (this.aiServerState!.gameState.stars >= this.getAbilityCost(abilityType)) {
          return abilityType;
        }
      }
      return null;
    };

    let selectedAbility = pickAffordableAbility();

    if (!selectedAbility) {
      const board = this.aiServerState.gameState.board;
      const aiBoardHeight = this.calculateBoardHeight(board);
      if (aiBoardHeight > 10) {
        const highestCost = this.aiAbilityLoadout.length > 0
          ? this.getAbilityCost(this.aiAbilityLoadout[0])
          : 0;
        this.aiServerState.gameState.stars += Math.floor(highestCost * 0.5);
        selectedAbility = pickAffordableAbility();
      }
    }

    if (!selectedAbility) return;

    const abilityCost = this.getAbilityCost(selectedAbility);
    if (this.aiServerState.gameState.stars < abilityCost) return;

    console.log(`[RELAY AI] Using ability: ${selectedAbility}`);
    this.aiLastAbilityUse = now;

    // Update AI player stars in our tracking
    const aiPlayerState = this.players.get(this.aiPlayer.id);
    if (aiPlayerState) {
      aiPlayerState.stars = this.aiServerState.gameState.stars;
    }

    this.handleAbilityActivation(this.aiPlayer.id, selectedAbility, humanPlayer.playerId);
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

  handleGameOver(playerId: string) {
    if (this.roomStatus === 'finished') return;

    const loser = this.players.get(playerId);
    if (!loser) return;

    const opponent = this.getOpponent(playerId);
    if (!opponent) return;

    this.winnerId = opponent.playerId;
    this.roomStatus = 'finished';
    this.stopAIGameLoops();

    console.log(`[RELAY] Game over. Winner: ${this.winnerId}, Loser: ${playerId}`);

    this.broadcast({
      type: 'game_finished',
      winnerId: this.winnerId,
      loserId: playerId,
    });
  }

  private stopAIGameLoops(): void {
    if (this.aiInterval) {
      clearInterval(this.aiInterval);
      this.aiInterval = null;
    }
    if (this.aiGameLoop) {
      clearTimeout(this.aiGameLoop);
      this.aiGameLoop = null;
    }
    this.aiMoveQueue = [];
  }

  // ============================
  // Helpers
  // ============================

  getOpponent(playerId: string): PlayerState | null {
    for (const [id, player] of this.players) {
      if (id !== playerId) return player;
    }
    return null;
  }

  private getOpponentId(playerId: string): string | null {
    for (const id of this.players.keys()) {
      if (id !== playerId) return id;
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
    console.warn(`[RELAY ABILITY] Rejected ${abilityType} from ${playerId} -> ${targetPlayerId}: ${reason}`);
    const playerState = this.players.get(playerId);
    this.sendAbilityActivationResult(playerId, {
      type: 'ability_activation_result',
      requestId,
      abilityType,
      targetPlayerId,
      accepted: false,
      reason,
      message,
      remainingStars: playerState?.stars,
      serverTime: Date.now(),
    });
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.room.broadcast(message);
  }

  onClose(conn: Party.Connection) {
    let disconnectedPlayerId: string | null = null;
    for (const [playerId, player] of this.players) {
      if (player.connectionId === conn.id) {
        disconnectedPlayerId = playerId;
        break;
      }
    }
    if (!disconnectedPlayerId) return;

    console.log(`[RELAY] Player ${disconnectedPlayerId} disconnected`);

    if (this.roomStatus === 'playing') {
      this.handleGameOver(disconnectedPlayerId);
    } else {
      this.stopAIGameLoops();
      this.roomStatus = 'finished';

      const opponent = this.getOpponent(disconnectedPlayerId);
      if (opponent) {
        const opponentConn = this.getConnection(opponent.connectionId);
        if (opponentConn) {
          opponentConn.send(JSON.stringify({
            type: 'opponent_disconnected',
          }));
        }
      }
    }

    this.players.delete(disconnectedPlayerId);
    this.playerDefensiveEffects.delete(disconnectedPlayerId);
    this.lastNonCloneAbilityByPlayer.delete(disconnectedPlayerId);
  }
}
