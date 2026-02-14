import PartySocket from 'partysocket';
import type { Board } from '@tetris-battle/game-core';

export class PartykitGameSync {
  private socket: PartySocket;
  private playerId: string;
  private roomId: string;
  private aiOpponent?: any;

  constructor(roomId: string, playerId: string, host: string, aiOpponent?: any) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.aiOpponent = aiOpponent;

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
      this.socket.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.socket.close();
  }
}
