import type * as Party from "partykit/server";

interface OnlineUser {
  connectedAt: number;
  status: 'menu' | 'in_queue' | 'in_game';
  connectionId: string;
}

interface PendingChallenge {
  challengeId: string;
  challengerId: string;
  challengedId: string;
  challengerUsername: string;
  challengerRank: number;
  challengerLevel: number;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
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
  // challengeId -> pending challenge info
  pendingChallenges: Map<string, PendingChallenge> = new Map();

  constructor(readonly room: Party.Room) {
    console.log('[PRESENCE] Server initialized');
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
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

    switch (data.type) {
      case 'presence_connect':
        this.handlePresenceConnect(data.userId, sender);
        break;

      case 'presence_subscribe':
        this.handlePresenceSubscribe(data.friendIds, sender);
        break;

      case 'presence_status_update':
        this.handleStatusUpdate(data.userId, data.status);
        break;

      case 'friend_challenge':
        this.handleFriendChallenge(data, sender);
        break;

      case 'friend_challenge_accept':
        this.handleChallengeAccept(data, sender);
        break;

      case 'friend_challenge_decline':
        this.handleChallengeDecline(data, sender);
        break;

      case 'friend_challenge_cancel':
        this.handleChallengeCancel(data, sender);
        break;
    }
  }

  handlePresenceConnect(userId: string, conn: Party.Connection) {
    // Clear any pending disconnect timer
    const existingTimer = this.disconnectTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectTimers.delete(userId);
    }

    // Register user as online
    this.onlineUsers.set(userId, {
      connectedAt: Date.now(),
      status: 'menu',
      connectionId: conn.id,
    });
    this.connectionToUser.set(conn.id, userId);

    console.log(`[PRESENCE] User ${userId} connected. Online: ${this.onlineUsers.size}`);

    // Notify subscribers that this user is online
    this.notifySubscribers(userId, 'online');
  }

  handlePresenceSubscribe(friendIds: string[], conn: Party.Connection) {
    // Store subscription
    this.subscriptions.set(conn.id, new Set(friendIds));

    // Send current status of all requested friends
    for (const friendId of friendIds) {
      const user = this.onlineUsers.get(friendId);
      const status = user
        ? (user.status === 'in_game' ? 'in_game' : 'online')
        : 'offline';

      conn.send(JSON.stringify({
        type: 'presence_update',
        userId: friendId,
        status,
      }));
    }
  }

  handleStatusUpdate(userId: string, status: 'menu' | 'in_queue' | 'in_game') {
    const user = this.onlineUsers.get(userId);
    if (user) {
      user.status = status;
      this.onlineUsers.set(userId, user);

      // Notify subscribers
      const presenceStatus = status === 'in_game' ? 'in_game' : 'online';
      this.notifySubscribers(userId, presenceStatus);
    }
  }

  handleFriendChallenge(data: any, sender: Party.Connection) {
    const { challengeId, challengerId, challengedId, challengerUsername, challengerRank, challengerLevel } = data;

    // Set up expiry timer (2 minutes)
    const expiresAt = Date.now() + 120000;
    const timer = setTimeout(() => {
      this.handleChallengeExpiry(challengeId);
    }, 120000);

    this.pendingChallenges.set(challengeId, {
      challengeId,
      challengerId,
      challengedId,
      challengerUsername,
      challengerRank,
      challengerLevel,
      expiresAt,
      timer,
    });

    // Forward challenge to the challenged user
    const challengedUser = this.onlineUsers.get(challengedId);
    if (challengedUser) {
      const conn = this.getConnection(challengedUser.connectionId);
      if (conn) {
        conn.send(JSON.stringify({
          type: 'friend_challenge_received',
          challengeId,
          challengerId,
          challengerUsername,
          challengerRank,
          challengerLevel,
          expiresAt,
        }));
      }
    }
  }

  handleChallengeAccept(data: any, sender: Party.Connection) {
    const { challengeId } = data;
    const challenge = this.pendingChallenges.get(challengeId);
    if (!challenge) return;

    // Clear expiry timer
    clearTimeout(challenge.timer);
    this.pendingChallenges.delete(challengeId);

    // Generate game room
    const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Notify both players
    const matchData = {
      type: 'friend_challenge_accepted',
      challengeId,
      roomId,
      player1: challenge.challengerId,
      player2: challenge.challengedId,
    };

    // Send to challenger
    const challengerUser = this.onlineUsers.get(challenge.challengerId);
    if (challengerUser) {
      const conn = this.getConnection(challengerUser.connectionId);
      if (conn) conn.send(JSON.stringify(matchData));
    }

    // Send to challenged (the acceptor)
    const challengedUser = this.onlineUsers.get(challenge.challengedId);
    if (challengedUser) {
      const conn = this.getConnection(challengedUser.connectionId);
      if (conn) conn.send(JSON.stringify(matchData));
    }
  }

  handleChallengeDecline(data: any, sender: Party.Connection) {
    const { challengeId } = data;
    const challenge = this.pendingChallenges.get(challengeId);
    if (!challenge) return;

    // Clear expiry timer
    clearTimeout(challenge.timer);
    this.pendingChallenges.delete(challengeId);

    // Notify the challenger
    const challengerUser = this.onlineUsers.get(challenge.challengerId);
    if (challengerUser) {
      const conn = this.getConnection(challengerUser.connectionId);
      if (conn) {
        conn.send(JSON.stringify({
          type: 'friend_challenge_declined',
          challengeId,
        }));
      }
    }
  }

  handleChallengeCancel(data: any, sender: Party.Connection) {
    const { challengeId } = data;
    const challenge = this.pendingChallenges.get(challengeId);
    if (!challenge) return;

    clearTimeout(challenge.timer);
    this.pendingChallenges.delete(challengeId);

    // Notify the challenged user
    const challengedUser = this.onlineUsers.get(challenge.challengedId);
    if (challengedUser) {
      const conn = this.getConnection(challengedUser.connectionId);
      if (conn) {
        conn.send(JSON.stringify({
          type: 'friend_challenge_cancelled',
          challengeId,
        }));
      }
    }
  }

  handleChallengeExpiry(challengeId: string) {
    const challenge = this.pendingChallenges.get(challengeId);
    if (!challenge) return;

    this.pendingChallenges.delete(challengeId);

    // Notify the challenger
    const challengerUser = this.onlineUsers.get(challenge.challengerId);
    if (challengerUser) {
      const conn = this.getConnection(challengerUser.connectionId);
      if (conn) {
        conn.send(JSON.stringify({
          type: 'friend_challenge_expired',
          challengeId,
        }));
      }
    }

    // Notify the challenged user too
    const challengedUser = this.onlineUsers.get(challenge.challengedId);
    if (challengedUser) {
      const conn = this.getConnection(challengedUser.connectionId);
      if (conn) {
        conn.send(JSON.stringify({
          type: 'friend_challenge_expired',
          challengeId,
        }));
      }
    }
  }

  notifySubscribers(userId: string, status: 'online' | 'in_game' | 'offline') {
    const message = JSON.stringify({
      type: 'presence_update',
      userId,
      status,
    });

    // Find all connections subscribed to this user
    for (const [connId, subscribedIds] of this.subscriptions) {
      if (subscribedIds.has(userId)) {
        const conn = this.getConnection(connId);
        if (conn) {
          conn.send(message);
        }
      }
    }
  }

  getConnection(connectionId: string): Party.Connection | undefined {
    return [...this.room.getConnections()].find(c => c.id === connectionId);
  }

  onClose(conn: Party.Connection) {
    const userId = this.connectionToUser.get(conn.id);
    if (!userId) return;

    // Clean up subscriptions
    this.subscriptions.delete(conn.id);

    // Start 10-second grace period for reconnection
    const timer = setTimeout(() => {
      this.onlineUsers.delete(userId);
      this.connectionToUser.delete(conn.id);
      this.disconnectTimers.delete(userId);
      console.log(`[PRESENCE] User ${userId} offline after grace period. Online: ${this.onlineUsers.size}`);

      // Notify subscribers
      this.notifySubscribers(userId, 'offline');
    }, 10000);

    this.disconnectTimers.set(userId, timer);
  }
}
