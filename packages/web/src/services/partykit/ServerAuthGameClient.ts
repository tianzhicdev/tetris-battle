import PartySocket from 'partysocket';
import type { PlayerInputType } from '@tetris-battle/game-core';
import { getAbilityById } from '@tetris-battle/game-core';
import type { DebugLogger } from '../debug/DebugLogger';
import { ConnectionMonitor, type ConnectionStats } from '../ConnectionMonitor';

export interface GameStateUpdate {
  timestamp: number;
  yourState: {
    board: any[][];
    currentPiece: any;
    score: number;
    stars: number;
    linesCleared: number;
    comboCount: number;
    isGameOver: boolean;
    activeEffects: string[];
  };
  opponentState: {
    board: any[][];
    currentPiece: any;
    score: number;
    stars: number;
    linesCleared: number;
    comboCount: number;
    isGameOver: boolean;
    activeEffects: string[];
  };
}

export interface AbilityActivationResult {
  requestId?: string;
  abilityType: string;
  targetPlayerId: string;
  accepted: boolean;
  reason?: string;
  message: string;
  remainingStars?: number;
  serverTime: number;
}

/**
 * ServerAuthGameClient handles communication with the server-authoritative game server.
 * Sends inputs to server, receives state updates from server.
 */
export class ServerAuthGameClient {
  private socket: PartySocket;
  private playerId: string;
  private roomId: string;
  private loadout: string[];
  private aiOpponent?: any;
  private debugLogger: DebugLogger | null = null;
  private connectionMonitor: ConnectionMonitor | null = null;

  constructor(roomId: string, playerId: string, host: string, loadout: string[], _aiOpponent?: any, debugLogger?: DebugLogger) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.loadout = loadout;
    this.aiOpponent = _aiOpponent;
    this.debugLogger = debugLogger || null;

    this.socket = new PartySocket({
      host,
      party: 'game',
      room: roomId,
    });

    // Initialize connection monitor
    this.connectionMonitor = new ConnectionMonitor((timestamp) => {
      this.send({ type: 'ping', timestamp });
    });
  }

  connect(
    onStateUpdate: (state: GameStateUpdate) => void,
    onOpponentDisconnected: () => void,
    onGameFinished: (winnerId: string) => void,
    onAbilityReceived?: (abilityType: string, fromPlayerId: string) => void,
    onAbilityActivationResult?: (result: AbilityActivationResult) => void,
    onInputConfirmed?: (confirmedSeq: number, serverState: any) => void,
    onInputRejected?: (rejectedSeq: number, reason: string, serverState: any) => void
  ): void {
    this.socket.addEventListener('open', () => {
      console.log(`[SERVER-AUTH] Connected to game room: ${this.roomId}`);
      this.connectionMonitor?.startMonitoring();
      this.joinGame();
    });

    this.socket.addEventListener('message', (event) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        console.error('[SERVER-AUTH] Failed to parse message:', event.data, error);
        this.debugLogger?.logEvent('parse_error', 'Failed to parse server message', {
          raw: String(event.data),
          error: String(error),
        });
        return;
      }
      this.debugLogger?.logIncoming(data);

      switch (data.type) {
        case 'game_start':
          console.log('[SERVER-AUTH] Game started:', data);
          break;

        case 'state_update':
          onStateUpdate(data as GameStateUpdate);
          break;

        case 'ability_received':
          if (onAbilityReceived) {
            onAbilityReceived(data.abilityType, data.fromPlayerId);
          }
          // Log in debug mode
          if (this.debugLogger) {
            const ability = getAbilityById(data.abilityType);
            this.debugLogger.logEvent(
              'ability_received',
              `Received ${ability?.name || data.abilityType} from opponent`,
              { abilityType: data.abilityType, from: data.fromPlayerId }
            );
          }
          break;

        case 'ability_activation_result':
          onAbilityActivationResult?.(data as AbilityActivationResult);
          if (this.debugLogger) {
            const status = data.accepted ? 'accepted' : 'rejected';
            this.debugLogger.logEvent(
              'ability_activation_result',
              `${data.abilityType} ${status}: ${data.message}`,
              data
            );
          }
          break;

        case 'input_confirmed':
          if (onInputConfirmed) {
            onInputConfirmed(data.confirmedSeq, data.serverState);
          }
          this.debugLogger?.logEvent(
            'input_confirmed',
            `Input seq ${data.confirmedSeq} confirmed`,
            data
          );
          break;

        case 'input_rejected':
          if (onInputRejected) {
            onInputRejected(data.rejectedSeq, data.reason, data.serverState);
          }
          this.debugLogger?.logEvent(
            'input_rejected',
            `Input seq ${data.rejectedSeq} rejected: ${data.reason}`,
            data
          );
          break;

        case 'server_error':
          console.error('[SERVER-AUTH] Server error:', data);
          this.debugLogger?.logEvent('server_error', data.message || 'Server error', data);
          break;

        case 'opponent_disconnected':
          onOpponentDisconnected();
          break;

        case 'game_finished':
          onGameFinished(data.winnerId);
          break;

        case 'pong':
          this.connectionMonitor?.onPong(data.timestamp, data.serverTime);
          this.debugLogger?.logEvent('pong', `RTT: ${Date.now() - data.timestamp}ms`, data);
          break;
      }
    });

    this.socket.addEventListener('error', (error) => {
      console.error('[SERVER-AUTH] Error:', error);
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
   * Send player input to server
   */
  sendInput(input: PlayerInputType, seq: number | null = null): void {
    const payload: any = {
      type: 'player_input',
      playerId: this.playerId,
      input,
      timestamp: Date.now(),
    };

    // Include seq number if provided (prediction mode)
    if (seq !== null) {
      payload.seq = seq;
    }

    this.send(payload);
  }

  /**
   * Send ability activation to server
   */
  activateAbility(abilityType: string, targetPlayerId: string): string | null {
    const requestId = `ability_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

  private send(data: any): boolean {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.debugLogger?.logOutgoing(data);
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  /**
   * Send ping for RTT measurement
   */
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

  disconnect(): void {
    this.connectionMonitor?.stopMonitoring();
    this.socket.close();
  }
}
