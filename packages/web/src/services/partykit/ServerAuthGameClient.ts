import PartySocket from 'partysocket';
import type { PlayerInputType } from '@tetris-battle/game-core';

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

  constructor(roomId: string, playerId: string, host: string, loadout: string[], _aiOpponent?: any) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.loadout = loadout;

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
      this.socket.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.socket.close();
  }
}
