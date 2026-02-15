import PartySocket from 'partysocket';

export class PartykitMatchmaking {
  private socket: PartySocket | null = null;
  private playerId: string;
  private host: string;
  private rank: number;
  private onDebugEvent?: (type: 'sent' | 'received' | 'status', data: any) => void;

  constructor(playerId: string, host: string, rank: number, onDebugEvent?: (type: 'sent' | 'received' | 'status', data: any) => void) {
    this.playerId = playerId;
    this.host = host;
    this.rank = rank;
    this.onDebugEvent = onDebugEvent;
  }

  connect(
    onMatchFound: (roomId: string, player1: string, player2: string, aiOpponent?: any) => void,
    onQueueUpdate?: (position: number) => void,
    onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void
  ): void {
    // Connect to matchmaking party
    this.socket = new PartySocket({
      host: this.host,
      party: 'matchmaking',
      room: 'global',
    });

    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      this.onDebugEvent?.('received', data);

      switch (data.type) {
        case 'queue_joined':
          console.log('[MATCHMAKING CLIENT] Queue joined, position:', data.position, 'playerId:', this.playerId);
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
      console.log('[MATCHMAKING CLIENT] Connected to matchmaking, playerId:', this.playerId, 'rank:', this.rank);
      this.onDebugEvent?.('status', { event: 'connected', playerId: this.playerId, rank: this.rank });
      onStatusChange?.('connected');
      this.joinQueue();
    });

    this.socket.addEventListener('error', (error) => {
      console.error('Matchmaking error:', error);
      this.onDebugEvent?.('status', { event: 'error', error: String(error) });
    });

    this.socket.addEventListener('close', () => {
      this.onDebugEvent?.('status', { event: 'disconnected' });
      onStatusChange?.('disconnected');
    });
  }

  joinQueue(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('[MATCHMAKING] Sending join_queue with rank:', this.rank);
      const message = {
        type: 'join_queue',
        playerId: this.playerId,
        rank: this.rank,
      };
      this.onDebugEvent?.('sent', message);
      this.socket.send(JSON.stringify(message));
    }
  }

  leaveQueue(): void {
    if (this.socket) {
      const message = {
        type: 'leave_queue',
        playerId: this.playerId,
      };
      this.onDebugEvent?.('sent', message);
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
