import type * as Party from "partykit/server";

interface OnlineUser {
  connectedAt: number;
  status: 'menu' | 'in_queue' | 'in_game';
  connectionId: string;
}

export default class PresenceServer implements Party.Server {
  // userId -> online user info
  onlineUsers: Map<string, OnlineUser> = new Map();
  // userId -> disconnect timer
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // connectionId -> userId mapping for reverse lookup
  connectionToUser: Map<string, string> = new Map();
  // connectionId -> Set of userIds they're subscribed to
  subscriptions: Map<string, Set<string>> = new Map();

  constructor(readonly room: Party.Room) {
    console.log('[PRESENCE] Server initialized');
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    void ctx;
    console.log(`[PRESENCE] Connection: ${conn.id}`);
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: any;
    try {
      data = JSON.parse(message);
    } catch (error) {
      console.warn('[PRESENCE] Ignoring non-JSON message:', message, error);
      return;
    }

    try {
      switch (data.type) {
        case 'presence_connect':
          if (typeof data.userId === 'string' && data.userId.length > 0) {
            this.handlePresenceConnect(data.userId, sender);
          }
          break;

        case 'presence_subscribe':
          this.handlePresenceSubscribe(data.friendIds, sender);
          break;

        case 'presence_status_update':
          this.handleStatusUpdate(data.userId, data.status);
          break;

        case 'presence_ping':
          this.safeSend(sender, {
            type: 'presence_pong',
            timestamp: data.timestamp ?? Date.now(),
          });
          break;
      }
    } catch (error) {
      console.error('[PRESENCE] onMessage handler error:', {
        type: data?.type,
        senderId: sender.id,
        error,
      });
    }
  }

  handlePresenceConnect(userId: string, conn: Party.Connection) {
    // Clear any pending disconnect timer
    const existingTimer = this.disconnectTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectTimers.delete(userId);
    }

    // If the user already had another active connection, discard stale maps.
    const previous = this.onlineUsers.get(userId);
    if (previous && previous.connectionId !== conn.id) {
      this.connectionToUser.delete(previous.connectionId);
      this.subscriptions.delete(previous.connectionId);
    }

    // Register user as online
    this.onlineUsers.set(userId, {
      connectedAt: Date.now(),
      status: 'menu',
      connectionId: conn.id,
    });
    this.connectionToUser.set(conn.id, userId);

    console.log(`[PRESENCE] User ${userId} connected. Online: ${this.onlineUsers.size}`);
    this.notifySubscribers(userId, 'online');
  }

  handlePresenceSubscribe(friendIds: string[] | undefined, conn: Party.Connection) {
    const safeFriendIds = Array.isArray(friendIds)
      ? friendIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [];

    this.subscriptions.set(conn.id, new Set(safeFriendIds));

    for (const friendId of safeFriendIds) {
      const user = this.onlineUsers.get(friendId);
      const status = user
        ? (user.status === 'in_game' ? 'in_game' : 'online')
        : 'offline';

      this.safeSend(conn, {
        type: 'presence_update',
        userId: friendId,
        status,
      });
    }
  }

  handleStatusUpdate(userId: string, status: 'menu' | 'in_queue' | 'in_game') {
    if (!userId || (status !== 'menu' && status !== 'in_queue' && status !== 'in_game')) {
      return;
    }
    const user = this.onlineUsers.get(userId);
    if (user) {
      user.status = status;
      this.onlineUsers.set(userId, user);

      const presenceStatus = status === 'in_game' ? 'in_game' : 'online';
      this.notifySubscribers(userId, presenceStatus);
    }
  }

  notifySubscribers(userId: string, status: 'online' | 'in_game' | 'offline') {
    const message = JSON.stringify({
      type: 'presence_update',
      userId,
      status,
    });

    for (const [connId, subscribedIds] of this.subscriptions) {
      if (!subscribedIds.has(userId)) continue;
      const conn = this.getConnection(connId);
      if (!conn) continue;
      try {
        conn.send(message);
      } catch (error) {
        console.error('[PRESENCE] Failed to notify subscriber:', {
          connId,
          userId,
          status,
          error,
        });
      }
    }
  }

  private safeSend(conn: Party.Connection, payload: any): void {
    try {
      conn.send(JSON.stringify(payload));
    } catch (error) {
      console.error('[PRESENCE] Failed to send message:', {
        payloadType: payload?.type,
        connectionId: conn.id,
        error,
      });
    }
  }

  getConnection(connectionId: string): Party.Connection | undefined {
    return [...this.room.getConnections()].find((c) => c.id === connectionId);
  }

  onClose(conn: Party.Connection) {
    const userId = this.connectionToUser.get(conn.id);
    if (!userId) return;

    this.subscriptions.delete(conn.id);
    this.connectionToUser.delete(conn.id);

    // Ignore stale closes for non-current connections.
    const currentUser = this.onlineUsers.get(userId);
    if (!currentUser || currentUser.connectionId !== conn.id) {
      return;
    }

    // Keep a reconnection grace window before marking offline.
    const closingConnectionId = conn.id;
    const timer = setTimeout(() => {
      const activeUser = this.onlineUsers.get(userId);
      if (!activeUser || activeUser.connectionId !== closingConnectionId) {
        this.disconnectTimers.delete(userId);
        return;
      }

      this.onlineUsers.delete(userId);
      this.disconnectTimers.delete(userId);
      console.log(`[PRESENCE] User ${userId} offline after grace period. Online: ${this.onlineUsers.size}`);
      this.notifySubscribers(userId, 'offline');
    }, 10000);

    this.disconnectTimers.set(userId, timer);
  }
}
