import PartySocket from 'partysocket';
import type { PlayerInputType } from '@tetris-battle/game-core';
import { ABILITIES } from '@tetris-battle/game-core';
import { ServerGameState } from '@tetris-battle/partykit/src/ServerGameState';
import type { DebugLogger } from '../debug/DebugLogger';
import { ConnectionMonitor, type ConnectionStats } from '../ConnectionMonitor';
import { createLocalPartySocket, type PartySocketLike } from './localRuntime';

/**
 * Public state shape that matches the old server state_update format.
 * This ensures the rendering layer doesn't need to change.
 */
export interface PublicGameState {
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

export interface AbilityActivationResult {
  requestId?: string;
  abilityType: string;
  appliedAbilityType?: string;
  targetPlayerId: string;
  accepted: boolean;
  reason?: string;
  interceptedBy?: 'shield' | 'reflect';
  message: string;
  chargedCost?: number;
  remainingStars?: number;
  serverTime: number;
}

/** Rate at which we send our state summary to the server (for opponent view) */
const SUMMARY_SEND_INTERVAL_MS = 200; // 5fps - enough for smooth opponent preview

/**
 * ClientAuthGameClient: Client-authoritative game client.
 *
 * Runs the full Tetris game engine locally (zero-latency input).
 * Only communicates with server for:
 * - Join/leave coordination
 * - Ability activations (validated by server)
 * - Periodic state summaries (for opponent to see our board)
 * - Game over
 *
 * This eliminates the input-lag problem entirely since all
 * movement, rotation, and gravity happen locally.
 */
export class ClientAuthGameClient {
  private socket: PartySocketLike;
  private playerId: string;
  private roomId: string;
  private loadout: string[];
  private aiOpponent?: any;
  private debugLogger: DebugLogger | null = null;
  private connectionMonitor: ConnectionMonitor | null = null;

  /** The local game engine running our Tetris simulation */
  private localState: ServerGameState | null = null;
  private gameLoop: ReturnType<typeof setTimeout> | null = null;
  private summarySendInterval: ReturnType<typeof setInterval> | null = null;
  private roomSeed: number = 0;
  private gameStarted: boolean = false;

  /** Callbacks */
  private onLocalStateUpdate: ((state: PublicGameState) => void) | null = null;
  private onOpponentStateUpdate: ((state: PublicGameState) => void) | null = null;
  private onGameFinishedCb: ((winnerId: string) => void) | null = null;
  private onOpponentDisconnectedCb: (() => void) | null = null;
  private onAbilityReceivedCb: ((abilityType: string, fromPlayerId: string) => void) | null = null;
  private onAbilityActivationResultCb: ((result: AbilityActivationResult) => void) | null = null;

  constructor(
    roomId: string,
    playerId: string,
    host: string,
    loadout: string[],
    _aiOpponent?: any,
    debugLogger?: DebugLogger
  ) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.loadout = loadout;
    this.aiOpponent = _aiOpponent;
    this.debugLogger = debugLogger || null;

    if (this.aiOpponent?.local) {
      this.socket = createLocalPartySocket('game', roomId);
    } else {
      this.socket = new PartySocket({
        host,
        party: 'game',
        room: roomId,
      });
    }

    this.connectionMonitor = new ConnectionMonitor((timestamp) => {
      this.send({ type: 'ping', timestamp });
    });
  }

  connect(
    onLocalStateUpdate: (state: PublicGameState) => void,
    onOpponentDisconnected: () => void,
    onGameFinished: (winnerId: string) => void,
    onAbilityReceived?: (abilityType: string, fromPlayerId: string) => void,
    onAbilityActivationResult?: (result: AbilityActivationResult) => void,
    onOpponentStateUpdate?: (state: PublicGameState) => void
  ): void {
    this.onLocalStateUpdate = onLocalStateUpdate;
    this.onOpponentDisconnectedCb = onOpponentDisconnected;
    this.onGameFinishedCb = onGameFinished;
    this.onAbilityReceivedCb = onAbilityReceived || null;
    this.onAbilityActivationResultCb = onAbilityActivationResult || null;
    this.onOpponentStateUpdate = onOpponentStateUpdate || null;

    this.socket.addEventListener('open', () => {
      console.log(`[CLIENT-AUTH] Connected to game room: ${this.roomId}`);
      this.connectionMonitor?.startMonitoring();
      this.joinGame();
    });

    this.socket.addEventListener('message', (event) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        console.error('[CLIENT-AUTH] Failed to parse message:', event.data, error);
        return;
      }
      this.debugLogger?.logIncoming(data);

      switch (data.type) {
        case 'game_start':
          this.handleGameStart(data);
          break;

        case 'opponent_state':
          if (this.onOpponentStateUpdate) {
            this.onOpponentStateUpdate(data.summary);
          }
          break;

        case 'ability_received':
          this.handleAbilityReceived(data.abilityType, data.fromPlayerId);
          break;

        case 'ability_activation_result':
          this.handleAbilityActivationResult(data);
          break;

        case 'ability_blocked':
          // Our defensive effect blocked an incoming ability
          if (this.debugLogger) {
            this.debugLogger.logEvent('ability_blocked', `${data.abilityType} blocked by ${data.blockedBy}`, data);
          }
          break;

        case 'opponent_disconnected':
          this.onOpponentDisconnectedCb?.();
          break;

        case 'game_finished':
          this.stopLocalGameLoop();
          this.onGameFinishedCb?.(data.winnerId);
          break;

        case 'pong':
          this.connectionMonitor?.onPong(data.timestamp, data.serverTime);
          break;

        case 'server_error':
          console.error('[CLIENT-AUTH] Server error:', data);
          break;
      }
    });

    this.socket.addEventListener('error', (error) => {
      console.error('[CLIENT-AUTH] Error:', error);
    });
  }

  private joinGame(): void {
    this.send({
      type: 'join_game',
      playerId: this.playerId,
      loadout: this.loadout,
      aiOpponent: this.aiOpponent,
    });
  }

  /**
   * Handle game_start from server - initialize local game state with shared seed
   */
  private handleGameStart(data: { players: string[]; seed: number }): void {
    console.log('[CLIENT-AUTH] Game started, initializing local state with seed:', data.seed);
    this.roomSeed = data.seed;
    this.gameStarted = true;

    // Create local game engine with the shared seed
    this.localState = new ServerGameState(this.playerId, this.roomSeed, this.loadout);

    // Start local game loop (gravity ticks)
    this.startLocalGameLoop();

    // Start sending state summaries to server for opponent view
    this.startSummarySending();

    // Emit initial state
    this.emitLocalState();
  }

  /**
   * Apply an ability to our local game state (received from server relay).
   */
  private handleAbilityReceived(abilityType: string, fromPlayerId: string): void {
    if (!this.localState) return;

    console.log(`[CLIENT-AUTH] Applying ability locally: ${abilityType} from ${fromPlayerId}`);

    if (abilityType === 'purge') {
      this.localState.clearTimedEffects();
    } else {
      this.localState.applyAbility(abilityType);
    }

    // Update tick rate since ability might change speed
    this.restartLocalGameLoop();

    this.emitLocalState();
    this.onAbilityReceivedCb?.(abilityType, fromPlayerId);
  }

  private handleAbilityActivationResult(data: AbilityActivationResult): void {
    if (!this.localState) return;

    // If ability was reflected back to us, apply it locally
    if (data.interceptedBy === 'reflect' && data.appliedAbilityType) {
      console.log(`[CLIENT-AUTH] Ability reflected, applying ${data.appliedAbilityType} to self`);
      this.localState.applyAbility(data.appliedAbilityType);
      this.restartLocalGameLoop();
      this.emitLocalState();
    }

    // Update stars from server response (source of truth for post-ability stars)
    if (typeof data.remainingStars === 'number') {
      this.localState.gameState.stars = data.remainingStars;
      this.emitLocalState();
    }

    this.onAbilityActivationResultCb?.(data);
  }

  // ============================
  // Local game loop
  // ============================

  private startLocalGameLoop(): void {
    if (!this.localState) return;

    const loop = () => {
      if (!this.localState) return;

      const stateChanged = this.localState.tick();

      if (stateChanged) {
        if (this.localState.gameState.isGameOver) {
          this.reportGameOver();
          return;
        }
        this.emitLocalState();
      }

      // Schedule next tick at current tick rate
      this.gameLoop = setTimeout(loop, this.localState.tickRate);
    };

    this.gameLoop = setTimeout(loop, this.localState.tickRate);
  }

  private stopLocalGameLoop(): void {
    if (this.gameLoop) {
      clearTimeout(this.gameLoop);
      this.gameLoop = null;
    }
    if (this.summarySendInterval) {
      clearInterval(this.summarySendInterval);
      this.summarySendInterval = null;
    }
  }

  private restartLocalGameLoop(): void {
    if (this.gameLoop) {
      clearTimeout(this.gameLoop);
      this.gameLoop = null;
    }
    this.startLocalGameLoop();
  }

  private startSummarySending(): void {
    this.summarySendInterval = setInterval(() => {
      this.sendStateSummary();
    }, SUMMARY_SEND_INTERVAL_MS);
  }

  private emitLocalState(): void {
    if (!this.localState || !this.onLocalStateUpdate) return;
    this.onLocalStateUpdate(this.localState.getPublicState());
  }

  // ============================
  // Public API: Input handling (instant, local)
  // ============================

  /**
   * Send player input - processed LOCALLY with zero latency.
   * No network round-trip needed.
   */
  sendInput(input: PlayerInputType): void {
    if (!this.localState || this.localState.gameState.isGameOver) return;

    const stateChanged = this.localState.processInput(input);

    if (stateChanged) {
      if (this.localState.gameState.isGameOver) {
        this.reportGameOver();
        return;
      }
      this.emitLocalState();
    }
  }

  /**
   * Send ability activation to server (server validates star cost + relays to opponent)
   */
  activateAbility(abilityType: string, targetPlayerId: string): string | null {
    const requestId = `ability_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Optimistically deduct stars locally
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    if (ability && this.localState) {
      const cost = this.localState.getAbilityCostForCast(ability.cost);
      if (this.localState.gameState.stars < cost) {
        return null; // Can't afford
      }
    }

    const sent = this.send({
      type: 'ability_activation',
      playerId: this.playerId,
      abilityType,
      targetPlayerId,
      requestId,
      timestamp: Date.now(),
    });
    return sent ? requestId : null;
  }

  // ============================
  // State sharing
  // ============================

  /**
   * Send our current state summary to the server for relaying to opponent.
   */
  private sendStateSummary(): void {
    if (!this.localState || !this.gameStarted) return;

    const summary = this.localState.getPublicState();
    this.send({
      type: 'state_summary',
      playerId: this.playerId,
      summary,
    });

    // Also send star count for server-side ability validation
    this.send({
      type: 'stars_update',
      playerId: this.playerId,
      stars: this.localState.gameState.stars,
    });

    // Send defensive effect state for server-side interception resolution
    const activeEffects = this.localState.getActiveEffects();
    for (const effect of ['shield', 'reflect']) {
      if (activeEffects.includes(effect)) {
        // Find end time from the timed effects
        const timedEffects = this.localState.getTimedEffectSnapshots();
        const effectSnapshot = timedEffects.find(e => e.abilityType === effect);
        const endTime = effectSnapshot ? Date.now() + effectSnapshot.remainingMs : 0;
        this.send({
          type: 'defensive_effect_update',
          playerId: this.playerId,
          effect,
          endTime,
        });
      } else {
        this.send({
          type: 'defensive_effect_update',
          playerId: this.playerId,
          effect,
          endTime: 0,
        });
      }
    }
  }

  private reportGameOver(): void {
    this.stopLocalGameLoop();
    this.send({
      type: 'game_over',
      playerId: this.playerId,
    });
  }

  // ============================
  // Utils
  // ============================

  private send(data: any): boolean {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.debugLogger?.logOutgoing(data);
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendPing(callback: (rtt: number) => void): void {
    const timestamp = Date.now();
    const handler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'debug_pong' && data.timestamp === timestamp) {
        const rtt = Date.now() - timestamp;
        callback(rtt);
        this.socket.removeEventListener('message', handler);
      }
    };
    this.socket.addEventListener('message', handler);
    this.send({ type: 'debug_ping', timestamp });
  }

  setDebugLogger(debugLogger: DebugLogger | null): void {
    this.debugLogger = debugLogger;
  }

  getConnectionStats(): ConnectionStats | null {
    return this.connectionMonitor?.getStats() || null;
  }

  subscribeToConnectionStats(callback: (stats: ConnectionStats) => void): () => void {
    return this.connectionMonitor?.subscribe(callback) || (() => {});
  }

  /** Expose local game state for external access */
  getLocalState(): ServerGameState | null {
    return this.localState;
  }

  disconnect(): void {
    this.stopLocalGameLoop();
    this.connectionMonitor?.stopMonitoring();
    this.socket.close();
  }
}
