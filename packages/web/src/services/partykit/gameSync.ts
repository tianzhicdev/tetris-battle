import PartySocket from 'partysocket';
import type { Board } from '@tetris-battle/game-core';
import type { DebugLogger } from '../debug/DebugLogger';

export class PartykitGameSync {
  private socket: PartySocket;
  private playerId: string;
  private roomId: string;
  private aiOpponent?: any;
  private lastSyncTime: number = 0;
  private minSyncInterval: number = 100; // Minimum 100ms between syncs
  private debugLogger: DebugLogger | null = null;

  constructor(roomId: string, playerId: string, host: string, aiOpponent?: any, debugLogger?: DebugLogger) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.aiOpponent = aiOpponent;
    this.debugLogger = debugLogger || null;

    this.socket = new PartySocket({
      host,
      party: 'game',
      room: roomId,
    });
  }

  connect(
    onOpponentStateUpdate: (state: any) => void,
    onOpponentDisconnected: () => void,
    onGameFinished: (winnerId: string) => void,
    onAbilityReceived?: (abilityType: string, fromPlayerId: string) => void
  ): void {
    this.socket.addEventListener('open', () => {
      console.log(`Connected to game room: ${this.roomId}`);
      this.joinGame(this.aiOpponent);
    });

    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      this.debugLogger?.logIncoming(data);

      switch (data.type) {
        case 'room_state':
          console.log('Room state:', data);
          break;

        case 'game_start':
          console.log('Game started with players:', data.players);
          break;

        case 'opponent_info':
          console.log('Opponent:', data.opponentId);
          if (data.opponentState) {
            onOpponentStateUpdate(data.opponentState);
          }
          break;

        case 'opponent_state_update':
          onOpponentStateUpdate(data.state);
          break;

        case 'opponent_event':
          console.log('Opponent event:', data.event);
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
      console.error('Game sync error:', error);
    });
  }

  joinGame(aiOpponent?: any): void {
    this.send({
      type: 'join_game',
      playerId: this.playerId,
      aiOpponent,
    });
  }

  updateGameState(
    board: Board,
    score: number,
    stars: number,
    linesCleared: number,
    comboCount: number,
    isGameOver: boolean,
    currentPiece?: any
  ): void {
    // Debounce: Don't sync more than once per minSyncInterval
    const now = Date.now();
    if (now - this.lastSyncTime < this.minSyncInterval) {
      return; // Skip this sync
    }
    this.lastSyncTime = now;

    this.send({
      type: 'game_state_update',
      playerId: this.playerId,
      state: {
        board: board.grid,
        score,
        stars,
        linesCleared,
        comboCount,
        isGameOver,
        currentPiece,
      },
    });
  }

  sendEvent(eventType: string, eventData?: any): void {
    this.send({
      type: 'game_event',
      playerId: this.playerId,
      event: {
        type: eventType,
        data: eventData,
      },
    });
  }

  activateAbility(abilityType: string, targetPlayerId: string): void {
    this.send({
      type: 'ability_activation',
      playerId: this.playerId,
      abilityType,
      targetPlayerId,
    });
  }

  gameOver(): void {
    this.send({
      type: 'game_over',
      playerId: this.playerId,
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

  getDebugInfo(): { lastSyncTime: number; minSyncInterval: number } {
    return {
      lastSyncTime: this.lastSyncTime,
      minSyncInterval: this.minSyncInterval,
    };
  }

  disconnect(): void {
    this.socket.close();
  }
}
