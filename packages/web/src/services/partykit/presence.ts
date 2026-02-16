import PartySocket from 'partysocket';
import { ReconnectionManager } from '../ReconnectionManager';

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
  onChallengeAcceptFailed?: (challengeId: string, error: string) => void;
  onChallengeAcknowledged?: (challengeId: string) => void;
}

export class PartykitPresence {
  private socket: PartySocket | null = null;
  private userId: string;
  private host: string;
  private reconnectionManager: ReconnectionManager | null = null;
  private callbacks: PresenceCallbacks | null = null;
  private friendIds: string[] = [];

  constructor(userId: string, host: string) {
    this.userId = userId;
    this.host = host;
  }

  connect(callbacks: PresenceCallbacks): void {
    this.callbacks = callbacks;

    this.reconnectionManager = new ReconnectionManager(
      {
        maxAttempts: 10,
        baseDelay: 1000,
        maxDelay: 30000,
        jitterFactor: 0.25,
      },
      {
        onReconnecting: (attempt, delayMs) => {
          console.log(`[PRESENCE] Reconnecting (attempt ${attempt}) in ${Math.ceil(delayMs / 1000)}s...`);
        },
        onReconnected: async () => {
          console.log('[PRESENCE] Reconnected successfully');
          await this.restoreState();
        },
        onFailed: () => {
          console.error('[PRESENCE] Reconnection failed after max attempts');
        },
      }
    );

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

        case 'challenge_accept_failed':
          console.error('[PRESENCE] Challenge accept failed:', data.error);
          callbacks.onChallengeAcceptFailed?.(data.challengeId, data.error);
          break;

        case 'challenge_ack_received':
          callbacks.onChallengeAcknowledged?.(data.challengeId);
          break;
      }
    });

    this.socket.addEventListener('error', (error) => {
      console.error('[PRESENCE] Error:', error);
    });

    this.socket.addEventListener('close', () => {
      console.log('[PRESENCE] Connection closed, attempting reconnection...');
      this.reconnectionManager?.reconnect(async () => {
        return new Promise((resolve, reject) => {
          if (!this.callbacks) {
            reject(new Error('No callbacks set'));
            return;
          }
          this.connect(this.callbacks);
          // Wait for open event
          const checkOpen = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN) {
              clearInterval(checkOpen);
              resolve();
            }
          }, 100);
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkOpen);
            reject(new Error('Reconnection timeout'));
          }, 5000);
        });
      });
    });
  }

  subscribeFriends(friendIds: string[]): void {
    this.friendIds = friendIds;
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

  acknowledgeChallenge(challengeId: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'challenge_ack',
        challengeId,
      }));
    }
  }

  private async restoreState(): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    console.log('[PRESENCE] Restoring state after reconnection...');

    // Re-send presence_connect
    this.socket.send(JSON.stringify({
      type: 'presence_connect',
      userId: this.userId,
    }));

    // Re-subscribe to friends
    if (this.friendIds.length > 0) {
      this.subscribeFriends(this.friendIds);
    }

    // Request any pending challenges from server
    this.socket.send(JSON.stringify({
      type: 'request_pending_challenges',
      userId: this.userId,
    }));
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
