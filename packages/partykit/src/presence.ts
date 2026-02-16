import type * as Party from "partykit/server";
import { createClient } from '@supabase/supabase-js';

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
  ackTimeout?: ReturnType<typeof setTimeout>;
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
  // Track which challenges have been acknowledged by the recipient
  acknowledgedChallenges: Map<string, boolean> = new Map();

  constructor(readonly room: Party.Room) {
    console.log('[PRESENCE] Server initialized');
  }

  // Helper method to query challenge from database (fallback when not in memory)
  async queryChallengeFromDB(challengeId: string): Promise<PendingChallenge | null> {
    try {
      // Access Supabase credentials from environment
      const supabaseUrl = this.room.env.SUPABASE_URL as string;
      const supabaseKey = this.room.env.SUPABASE_ANON_KEY as string;

      if (!supabaseUrl || !supabaseKey) {
        console.warn('[PRESENCE] Supabase credentials not configured, cannot query database');
        return null;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Query challenge from database
      const { data, error } = await supabase
        .from('friend_challenges')
        .select('id, "challengerId", "challengedId", "createdAt", "expiresAt", status')
        .eq('id', challengeId)
        .eq('status', 'pending')
        .gt('expiresAt', new Date().toISOString())
        .single();

      if (error || !data) {
        console.log('[PRESENCE] Challenge not found in database:', challengeId);
        return null;
      }

      // Fetch user profiles to get usernames
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('"userId", username, level, rank')
        .in('userId', [data.challengerId, data.challengedId]);

      const challengerProfile = profiles?.find(p => p.userId === data.challengerId);
      if (!challengerProfile) {
        console.log('[PRESENCE] Challenger profile not found');
        return null;
      }

      return {
        challengeId: data.id,
        challengerId: data.challengerId,
        challengedId: data.challengedId,
        challengerUsername: challengerProfile.username,
        challengerRank: challengerProfile.rank,
        challengerLevel: challengerProfile.level,
        expiresAt: new Date(data.expiresAt).getTime(),
        timer: setTimeout(() => {}, 0), // Dummy timer, will be cleared immediately
        ackTimeout: undefined,
      };
    } catch (error) {
      console.error('[PRESENCE] Error querying challenge from database:', error);
      return null;
    }
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

        case 'friend_challenge':
          this.handleFriendChallenge(data, sender);
          break;

        case 'friend_challenge_accept':
          // Handle async method - don't await to avoid blocking other messages
          this.handleChallengeAccept(data, sender).catch(err => {
            console.error('[PRESENCE] Error handling challenge accept:', err);
            this.safeSend(sender, {
              type: 'challenge_accept_failed',
              challengeId: data.challengeId,
              error: 'Internal server error while processing challenge',
            });
          });
          break;

        case 'friend_challenge_decline':
          this.handleChallengeDecline(data, sender);
          break;

        case 'friend_challenge_cancel':
          this.handleChallengeCancel(data, sender);
          break;

        case 'challenge_ack':
          this.handleChallengeAck(data, sender);
          break;

        case 'request_pending_challenges':
          this.handleRequestPendingChallenges(data.userId, sender);
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

    // Notify subscribers that this user is online
    this.notifySubscribers(userId, 'online');
  }

  handlePresenceSubscribe(friendIds: string[] | undefined, conn: Party.Connection) {
    const safeFriendIds = Array.isArray(friendIds)
      ? friendIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [];

    // Store subscription
    this.subscriptions.set(conn.id, new Set(safeFriendIds));

    // Send current status of all requested friends
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
        this.safeSend(conn, {
          type: 'friend_challenge_received',
          challengeId,
          challengerId,
          challengerUsername,
          challengerRank,
          challengerLevel,
          expiresAt,
        });

        // Track if ACK received within 5 seconds
        const ackTimeout = setTimeout(() => {
          if (!this.acknowledgedChallenges.get(challengeId)) {
            console.warn(`[PRESENCE] Challenge ${challengeId} not acknowledged, retrying...`);
            // Resend challenge
            if (conn) {
              this.safeSend(conn, {
                type: 'friend_challenge_received',
                challengeId,
                challengerId,
                challengerUsername,
                challengerRank,
                challengerLevel,
                expiresAt,
              });
            }
          }
        }, 5000);

        // Store timeout so we can clear it
        const challenge = this.pendingChallenges.get(challengeId);
        if (challenge) {
          challenge.ackTimeout = ackTimeout;
        }
      }
    }
  }

  async handleChallengeAccept(data: any, sender: Party.Connection) {
    const { challengeId } = data;

    // Try memory first (fast path)
    let challenge = this.pendingChallenges.get(challengeId);

    if (!challenge) {
      // Fallback to database query (server may have restarted)
      console.warn('[PRESENCE] Challenge not in memory, querying database...');
      const challengeFromDB = await this.queryChallengeFromDB(challengeId);

      if (!challengeFromDB) {
        // Challenge not found - send error to client
        this.safeSend(sender, {
          type: 'challenge_accept_failed',
          challengeId,
          error: 'Challenge not found or expired. It may have been cancelled or already accepted.',
        });
        console.error('[PRESENCE] Challenge accept failed: not found in memory or database');
        return;
      }

      challenge = challengeFromDB;
      console.log('[PRESENCE] Challenge restored from database:', challengeId);
    }

    // Clear timers if they exist
    if (challenge.timer) {
      clearTimeout(challenge.timer);
    }
    if (challenge.ackTimeout) {
      clearTimeout(challenge.ackTimeout);
    }
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
      if (conn) {
        this.safeSend(conn, matchData);
        console.log('[PRESENCE] Sent match data to challenger:', challenge.challengerId);
      } else {
        console.warn('[PRESENCE] Challenger connection not found');
      }
    } else {
      console.warn('[PRESENCE] Challenger not online:', challenge.challengerId);
    }

    // Send to challenged (the acceptor)
    const challengedUser = this.onlineUsers.get(challenge.challengedId);
    if (challengedUser) {
      const conn = this.getConnection(challengedUser.connectionId);
      if (conn) {
        this.safeSend(conn, matchData);
        console.log('[PRESENCE] Sent match data to challenged:', challenge.challengedId);
      } else {
        console.warn('[PRESENCE] Challenged connection not found');
      }
    } else {
      console.warn('[PRESENCE] Challenged not online:', challenge.challengedId);
    }

    console.log('[PRESENCE] Challenge accepted successfully, room created:', roomId);
  }

  handleChallengeDecline(data: any, sender: Party.Connection) {
    const { challengeId } = data;
    const challenge = this.pendingChallenges.get(challengeId);
    if (!challenge) return;

    // Clear timers
    clearTimeout(challenge.timer);
    if (challenge.ackTimeout) {
      clearTimeout(challenge.ackTimeout);
    }
    this.pendingChallenges.delete(challengeId);

    // Notify the challenger
    const challengerUser = this.onlineUsers.get(challenge.challengerId);
    if (challengerUser) {
      const conn = this.getConnection(challengerUser.connectionId);
      if (conn) {
        this.safeSend(conn, {
          type: 'friend_challenge_declined',
          challengeId,
        });
      }
    }
  }

  handleChallengeCancel(data: any, sender: Party.Connection) {
    const { challengeId } = data;
    const challenge = this.pendingChallenges.get(challengeId);
    if (!challenge) return;

    clearTimeout(challenge.timer);
    if (challenge.ackTimeout) {
      clearTimeout(challenge.ackTimeout);
    }
    this.pendingChallenges.delete(challengeId);

    // Notify the challenged user
    const challengedUser = this.onlineUsers.get(challenge.challengedId);
    if (challengedUser) {
      const conn = this.getConnection(challengedUser.connectionId);
      if (conn) {
        this.safeSend(conn, {
          type: 'friend_challenge_cancelled',
          challengeId,
        });
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
        this.safeSend(conn, {
          type: 'friend_challenge_expired',
          challengeId,
        });
      }
    }

    // Notify the challenged user too
    const challengedUser = this.onlineUsers.get(challenge.challengedId);
    if (challengedUser) {
      const conn = this.getConnection(challengedUser.connectionId);
      if (conn) {
        this.safeSend(conn, {
          type: 'friend_challenge_expired',
          challengeId,
        });
      }
    }
  }

  handleChallengeAck(data: any, sender: Party.Connection) {
    const { challengeId } = data;
    this.acknowledgedChallenges.set(challengeId, true);

    // Send confirmation back to sender
    this.safeSend(sender, {
      type: 'challenge_ack_received',
      challengeId,
    });

    console.log(`[PRESENCE] Challenge ${challengeId} acknowledged`);
  }

  handleRequestPendingChallenges(userId: string, sender: Party.Connection) {
    console.log(`[PRESENCE] Sending pending challenges to ${userId}`);

    // Send all pending challenges involving this user
    for (const [challengeId, challenge] of this.pendingChallenges) {
      if (challenge.challengerId === userId || challenge.challengedId === userId) {
        this.safeSend(sender, {
          type: 'friend_challenge_received',
          challengeId: challenge.challengeId,
          challengerId: challenge.challengerId,
          challengedId: challenge.challengedId,
          challengerUsername: challenge.challengerUsername,
          challengerRank: challenge.challengerRank,
          challengerLevel: challenge.challengerLevel,
          expiresAt: challenge.expiresAt,
        });
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
    return [...this.room.getConnections()].find(c => c.id === connectionId);
  }

  onClose(conn: Party.Connection) {
    const userId = this.connectionToUser.get(conn.id);
    if (!userId) return;

    // Clean up subscriptions
    this.subscriptions.delete(conn.id);
    this.connectionToUser.delete(conn.id);

    // Ignore stale closes for non-current connections.
    const currentUser = this.onlineUsers.get(userId);
    if (!currentUser || currentUser.connectionId !== conn.id) {
      return;
    }

    // Start 10-second grace period for reconnection
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

      // Notify subscribers
      this.notifySubscribers(userId, 'offline');
    }, 10000);

    this.disconnectTimers.set(userId, timer);
  }
}
