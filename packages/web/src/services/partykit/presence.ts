import PartySocket from 'partysocket';

export interface PresenceCallbacks {
  onPresenceUpdate: (userId: string, status: 'online' | 'in_game' | 'offline') => void;
  onChallengeReceived: (challenge: {
    challengeId: string;
    challengerId: string;
    challengerUsername: string;
    challengerRank: number;
    challengerLevel: number;
    expiresAt: number;
  }) => void;
  onChallengeAccepted: (data: {
    challengeId: string;
    roomId: string;
    player1: string;
    player2: string;
  }) => void;
  onChallengeDeclined: (challengeId: string) => void;
  onChallengeExpired: (challengeId: string) => void;
  onChallengeCancelled: (challengeId: string) => void;
}

export class PartykitPresence {
  private socket: PartySocket | null = null;
  private userId: string;
  private host: string;

  constructor(userId: string, host: string) {
    this.userId = userId;
    this.host = host;
  }

  connect(callbacks: PresenceCallbacks): void {
    this.socket = new PartySocket({
      host: this.host,
      party: 'presence',
      room: 'global',
    });

    this.socket.addEventListener('open', () => {
      console.log('[PRESENCE] Connected');
      this.socket!.send(JSON.stringify({
        type: 'presence_connect',
        userId: this.userId,
      }));
    });

    this.socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'presence_update':
          callbacks.onPresenceUpdate(data.userId, data.status);
          break;

        case 'friend_challenge_received':
          callbacks.onChallengeReceived({
            challengeId: data.challengeId,
            challengerId: data.challengerId,
            challengerUsername: data.challengerUsername,
            challengerRank: data.challengerRank,
            challengerLevel: data.challengerLevel,
            expiresAt: data.expiresAt,
          });
          break;

        case 'friend_challenge_accepted':
          callbacks.onChallengeAccepted({
            challengeId: data.challengeId,
            roomId: data.roomId,
            player1: data.player1,
            player2: data.player2,
          });
          break;

        case 'friend_challenge_declined':
          callbacks.onChallengeDeclined(data.challengeId);
          break;

        case 'friend_challenge_expired':
          callbacks.onChallengeExpired(data.challengeId);
          break;

        case 'friend_challenge_cancelled':
          callbacks.onChallengeCancelled(data.challengeId);
          break;
      }
    });

    this.socket.addEventListener('error', (error) => {
      console.error('[PRESENCE] Error:', error);
    });
  }

  subscribeFriends(friendIds: string[]): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'presence_subscribe',
        friendIds,
      }));
    }
  }

  updateStatus(status: 'menu' | 'in_queue' | 'in_game'): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'presence_status_update',
        userId: this.userId,
        status,
      }));
    }
  }

  sendChallenge(
    challengeId: string,
    challengedId: string,
    challengerUsername: string,
    challengerRank: number,
    challengerLevel: number
  ): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'friend_challenge',
        challengeId,
        challengerId: this.userId,
        challengedId,
        challengerUsername,
        challengerRank,
        challengerLevel,
      }));
    }
  }

  acceptChallenge(challengeId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'friend_challenge_accept',
        challengeId,
      }));
    }
  }

  declineChallenge(challengeId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'friend_challenge_decline',
        challengeId,
      }));
    }
  }

  cancelChallenge(challengeId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'friend_challenge_cancel',
        challengeId,
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
