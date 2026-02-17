import PartySocket from 'partysocket';

export interface PresenceCallbacks {
  onPresenceUpdate: (userId: string, status: 'online' | 'in_game' | 'offline') => void;
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

    // PartySocket handles reconnecting internally.
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
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
      this.stopHeartbeat();
      this.startHeartbeat();
      this.socket!.send(JSON.stringify({
        type: 'presence_connect',
        userId: this.userId,
      }));

      // Re-sync subscriptions and state after reconnect.
      if (this.friendIds.length > 0) {
        this.subscribeFriends(this.friendIds);
      }
      this.updateStatus(this.currentStatus);
    });

    this.socket.addEventListener('message', (event) => {
      if (!this.callbacks) return;
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'presence_update':
          this.callbacks.onPresenceUpdate(data.userId, data.status);
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
      if (this.intentionallyDisconnected) {
        return;
      }
      console.warn('[PRESENCE] Connection closed, waiting for PartySocket auto-reconnect', {
        code: event.code,
        reason: event.reason || '(empty)',
        wasClean: event.wasClean,
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

  disconnect(): void {
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
