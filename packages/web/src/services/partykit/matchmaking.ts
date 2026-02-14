import PartySocket from 'partysocket';

export class PartykitMatchmaking {
  private socket: PartySocket | null = null;
  private playerId: string;
  private host: string;
  private rank: number;

  constructor(playerId: string, host: string, rank: number) {
    this.playerId = playerId;
    this.host = host;
    this.rank = rank;
  }

  connect(
    onMatchFound: (roomId: string, player1: string, player2: string, aiOpponent?: any) => void,
    onQueueUpdate?: (position: number) => void
  ): void {
    // Connect to matchmaking party
    this.socket = new PartySocket({
      host: this.host,
      party: 'matchmaking',
      room: 'global',
    });

    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'queue_joined':
          if (onQueueUpdate) {
            onQueueUpdate(data.position);
          }
          break;

        case 'match_found':
          onMatchFound(data.roomId, data.player1, data.player2, data.aiOpponent);
          this.disconnect();
          break;

        case 'already_in_queue':
          console.log('Already in queue');
          break;
      }
    });

    this.socket.addEventListener('open', () => {
      console.log('Connected to matchmaking');
      this.joinQueue();
    });

    this.socket.addEventListener('error', (error) => {
      console.error('Matchmaking error:', error);
    });
  }

  joinQueue(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('[MATCHMAKING] Sending join_queue with rank:', this.rank);
      this.socket.send(JSON.stringify({
        type: 'join_queue',
        playerId: this.playerId,
        rank: this.rank,
      }));
    }
  }

  leaveQueue(): void {
    if (this.socket) {
      this.socket.send(JSON.stringify({
        type: 'leave_queue',
        playerId: this.playerId,
      }));
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
