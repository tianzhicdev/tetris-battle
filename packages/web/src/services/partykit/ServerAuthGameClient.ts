import PartySocket from 'partysocket';
import type { PlayerInputType } from '@tetris-battle/game-core';
import { ABILITIES } from '@tetris-battle/game-core';
import type { DebugLogger } from '../debug/DebugLogger';

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

/**
 * ServerAuthGameClient handles communication with the server-authoritative game server.
 * Sends inputs to server, receives state updates from server.
 */
export class ServerAuthGameClient {
  private socket: PartySocket;
  private playerId: string;
  private roomId: string;
  private loadout: string[];
  private debugLogger: DebugLogger | null = null;

  constructor(roomId: string, playerId: string, host: string, loadout: string[], _aiOpponent?: any, debugLogger?: DebugLogger) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.loadout = loadout;
    this.debugLogger = debugLogger || null;

    this.socket = new PartySocket({
      host,
      party: 'game',
      room: roomId,
    });
  }

  connect(
    onStateUpdate: (state: GameStateUpdate) => void,
    onOpponentDisconnected: () => void,
    onGameFinished: (winnerId: string) => void,
    onAbilityReceived?: (abilityType: string, fromPlayerId: string) => void
  ): void {
    this.socket.addEventListener('open', () => {
      console.log(`[SERVER-AUTH] Connected to game room: ${this.roomId}`);
      this.joinGame();
    });

    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
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
            const ability = ABILITIES[data.abilityType as keyof typeof ABILITIES];
            this.debugLogger.logEvent(
              'ability_received',
              `Received ${ability?.name || data.abilityType} from opponent`,
              { abilityType: data.abilityType, from: data.fromPlayerId }
            );
          }
          break;

        case 'opponent_disconnected':
          onOpponentDisconnected();
          break;

        case 'game_finished':
          onGameFinished(data.winnerId);
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
    });
  }

  /**
   * Send player input to server
   */
  sendInput(input: PlayerInputType): void {
    this.send({
      type: 'player_input',
      playerId: this.playerId,
      input,
      timestamp: Date.now(),
    });
  }

  /**
   * Send ability activation to server
   */
  activateAbility(abilityType: string, targetPlayerId: string): void {
    this.send({
      type: 'ability_activation',
      playerId: this.playerId,
      abilityType,
      targetPlayerId,
      timestamp: Date.now(),
    });
  }

  private send(data: any): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.debugLogger?.logOutgoing(data);
      this.socket.send(JSON.stringify(data));
    }
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

  disconnect(): void {
    this.socket.close();
  }
}
