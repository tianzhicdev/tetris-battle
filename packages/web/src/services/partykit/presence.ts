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
  onChallengeAcceptFailed?: (challengeId: string, error: string) => void;
  onChallengeAcknowledged?: (challengeId: string) => void;
}

export class PartykitPresence {
  private socket: PartySocket | null = null;
  private userId: string;
  private host: string;
  private callbacks: PresenceCallbacks | null = null;
  private friendIds: string[] = [];
  private intentionallyDisconnected: boolean = false;
  private currentStatus: 'menu' | 'in_queue' | 'in_game' = 'menu';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(userId: string, host: string) {
    this.userId = userId;
    this.host = host;
  }

  connect(callbacks: PresenceCallbacks): void {
    this.callbacks = callbacks;
    this.intentionallyDisconnected = false;

    // Avoid duplicate sockets. PartySocket handles reconnecting internally.
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      console.log('[PRESENCE] Existing socket is active, skipping duplicate connect');
      return;
    }

    this.socket = new PartySocket({
      host: this.host,
      party: 'presence',
      room: 'global',
      connectionTimeout: 8000,
      minReconnectionDelay: 1000,
      maxReconnectionDelay: 15000,
      reconnectionDelayGrowFactor: 1.3,
    });

    this.socket.addEventListener('open', () => {
      console.log('[PRESENCE] Connected');
      this.stopHeartbeat();
      this.startHeartbeat();
      this.socket!.send(JSON.stringify({
        type: 'presence_connect',
        userId: this.userId,
      }));

      // Re-sync subscriptions and state after initial connect and auto-reconnects.
      if (this.friendIds.length > 0) {
        this.subscribeFriends(this.friendIds);
      }
      this.updateStatus(this.currentStatus);
      this.socket!.send(JSON.stringify({
        type: 'request_pending_challenges',
        userId: this.userId,
      }));
    });

    this.socket.addEventListener('message', (event) => {
      if (!this.callbacks) return;
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'presence_update':
          this.callbacks.onPresenceUpdate(data.userId, data.status);
          break;

        case 'friend_challenge_received':
          this.callbacks.onChallengeReceived({
            challengeId: data.challengeId,
            challengerId: data.challengerId,
            challengerUsername: data.challengerUsername,
            challengerRank: data.challengerRank,
            challengerLevel: data.challengerLevel,
            expiresAt: data.expiresAt,
          });
          break;

        case 'friend_challenge_accepted':
          this.callbacks.onChallengeAccepted({
            challengeId: data.challengeId,
            roomId: data.roomId,
            player1: data.player1,
            player2: data.player2,
          });
          break;

        case 'friend_challenge_declined':
          this.callbacks.onChallengeDeclined(data.challengeId);
          break;

        case 'friend_challenge_expired':
          this.callbacks.onChallengeExpired(data.challengeId);
          break;

        case 'friend_challenge_cancelled':
          this.callbacks.onChallengeCancelled(data.challengeId);
          break;

        case 'challenge_accept_failed':
          console.error('[PRESENCE] Challenge accept failed:', data.error);
          this.callbacks.onChallengeAcceptFailed?.(data.challengeId, data.error);
          break;

        case 'challenge_ack_received':
          this.callbacks.onChallengeAcknowledged?.(data.challengeId);
          break;

        case 'presence_pong':
          break;
      }
    });

    this.socket.addEventListener('error', (error) => {
      console.error('[PRESENCE] Error:', {
        type: error.type,
        readyState: this.socket?.readyState,
        url: this.socket?.url,
      });
    });

    this.socket.addEventListener('close', (event) => {
      this.stopHeartbeat();
      // Don't reconnect if we intentionally disconnected
      if (this.intentionallyDisconnected) {
        console.log('[PRESENCE] Connection closed intentionally, not reconnecting');
        return;
      }
      // PartySocket already reconnects automatically.
      console.warn('[PRESENCE] Connection closed, waiting for PartySocket auto-reconnect', {
        code: event.code,
        reason: event.reason || '(empty)',
        wasClean: event.wasClean,
        readyState: this.socket?.readyState,
        retryCount: (this.socket as any)?.retryCount,
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
    this.currentStatus = status;
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

  disconnect(): void {
    console.log('[PRESENCE] Disconnect called');
    this.intentionallyDisconnected = true;
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.callbacks = null;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'presence_ping',
          timestamp: Date.now(),
        }));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
