import { supabase } from '../lib/supabase';

export interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  matchmakingRating: number;
  gamesPlayed: number;
  onlineStatus: 'online' | 'in_game' | 'offline';
}

export interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  username: string;
  matchmakingRating: number;
  gamesPlayed: number;
  createdAt: string;
}

export interface UserSearchResult {
  userId: string;
  username: string;
  matchmakingRating: number;
  gamesPlayed: number;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
}

export interface Challenge {
  id: string;
  challengerId: string;
  challengedId: string;
  challengerUsername: string;
  challengedUsername?: string;  // For outgoing challenges
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  roomId?: string;
  expiresAt: string;  // ISO timestamp
  createdAt: string;  // ISO timestamp
  acceptedAt?: string;  // ISO timestamp
  resolvedAt?: string;  // ISO timestamp
}

type FriendRequestResult =
  | { success: true; autoAccepted?: boolean }
  | { error: 'USER_NOT_FOUND' | 'ALREADY_EXISTS' | 'BLOCKED' | 'CANNOT_ADD_SELF' | 'INTERNAL_ERROR' };

class FriendService {
  async sendFriendRequest(requesterId: string, addresseeUsername: string): Promise<FriendRequestResult> {
    const normalizedUsername = addresseeUsername.trim();
    if (!normalizedUsername) {
      return { error: 'USER_NOT_FOUND' };
    }

    // Look up addressee by username (case-insensitive exact match)
    const { data: addresseeMatches, error: lookupError } = await supabase
      .from('user_profiles')
      .select('"userId", username')
      .ilike('username', normalizedUsername)
      .limit(1);
    const addressee = addresseeMatches?.[0];

    if (lookupError || !addressee) {
      return { error: 'USER_NOT_FOUND' };
    }

    const addresseeId = addressee.userId;

    if (addresseeId === requesterId) {
      return { error: 'CANNOT_ADD_SELF' };
    }

    // Check if friendship already exists in either direction
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status, "requesterId", "addresseeId"')
      .or(
        `and(requesterId.eq.${requesterId},addresseeId.eq.${addresseeId}),and(requesterId.eq.${addresseeId},addresseeId.eq.${requesterId})`
      );

    if (existing && existing.length > 0) {
      const blockedByAddressee = existing.find(
        friendship => friendship.status === 'blocked' && friendship.requesterId === addresseeId
      );
      if (blockedByAddressee) {
        return { error: 'BLOCKED' };
      }

      // If the other user already sent a pending request, auto-accept it.
      const reversePending = existing.find(
        friendship =>
          friendship.status === 'pending' &&
          friendship.requesterId === addresseeId &&
          friendship.addresseeId === requesterId
      );
      if (reversePending) {
        const { error: acceptError } = await supabase
          .from('friendships')
          .update({ status: 'accepted', updatedAt: new Date().toISOString() })
          .eq('id', reversePending.id);

        if (acceptError) {
          console.error('Error auto-accepting reverse friend request:', acceptError);
          return { error: 'INTERNAL_ERROR' };
        }

        return { success: true, autoAccepted: true };
      }

      return { error: 'ALREADY_EXISTS' };
    }

    // Insert new friendship request
    const { error: insertError } = await supabase
      .from('friendships')
      .insert({
        requesterId,
        addresseeId: addresseeId,
        status: 'pending',
      });

    if (insertError) {
      console.error('Error sending friend request:', insertError);
      if (insertError.code === '23505') {
        return { error: 'ALREADY_EXISTS' };
      }
      return { error: 'INTERNAL_ERROR' };
    }

    return { success: true };
  }

  async acceptFriendRequest(friendshipId: string, userId: string): Promise<boolean> {
    // Verify the current user is the addressee
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', friendshipId)
      .eq('addresseeId', userId)
      .eq('status', 'pending')
      .single();

    if (!friendship) {
      console.error('Friend request not found or not authorized');
      return false;
    }

    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updatedAt: new Date().toISOString() })
      .eq('id', friendshipId);

    if (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }

    return true;
  }

  async declineFriendRequest(friendshipId: string, userId: string): Promise<boolean> {
    // Verify the current user is the addressee
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', friendshipId)
      .eq('addresseeId', userId)
      .eq('status', 'pending')
      .single();

    if (!friendship) {
      console.error('Friend request not found or not authorized');
      return false;
    }

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      console.error('Error declining friend request:', error);
      return false;
    }

    return true;
  }

  async removeFriend(friendshipId: string, userId: string): Promise<boolean> {
    // Verify the current user is either requester or addressee
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', friendshipId)
      .single();

    if (!friendship) {
      console.error('Friendship not found');
      return false;
    }

    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      console.error('Not authorized to remove this friendship');
      return false;
    }

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      console.error('Error removing friend:', error);
      return false;
    }

    return true;
  }

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    // Remove any existing accepted friendship in the reverse direction
    await supabase
      .from('friendships')
      .delete()
      .eq('requesterId', blockedId)
      .eq('addresseeId', blockerId)
      .eq('status', 'accepted');

    // Upsert friendship with blocked status
    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .eq('requesterId', blockerId)
      .eq('addresseeId', blockedId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'blocked', updatedAt: new Date().toISOString() })
        .eq('id', existing.id);

      if (error) {
        console.error('Error blocking user:', error);
        return false;
      }
    } else {
      const { error } = await supabase
        .from('friendships')
        .insert({
          requesterId: blockerId,
          addresseeId: blockedId,
          status: 'blocked',
        });

      if (error) {
        console.error('Error blocking user:', error);
        return false;
      }
    }

    return true;
  }

  async getFriendList(userId: string): Promise<Friend[]> {
    // Get all accepted friendships where user is either party
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, "requesterId", "addresseeId"')
      .eq('status', 'accepted')
      .or(`requesterId.eq.${userId},addresseeId.eq.${userId}`);

    if (error || !friendships) {
      console.error('Error fetching friend list:', error);
      return [];
    }

    if (friendships.length === 0) return [];

    // Get friend user IDs
    const friendUserIds = friendships.map(f =>
      f.requesterId === userId ? f.addresseeId : f.requesterId
    );

    // Fetch friend profiles
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('"userId", username, "matchmakingRating", "gamesPlayed"')
      .in('userId', friendUserIds);

    if (profileError || !profiles) {
      console.error('Error fetching friend profiles:', profileError);
      return [];
    }

    // Combine friendship + profile data
    const friends: Friend[] = [];
    for (const f of friendships) {
      const friendUserId = f.requesterId === userId ? f.addresseeId : f.requesterId;
      const profile = profiles.find(p => p.userId === friendUserId);
      if (!profile) continue;

      friends.push({
        friendshipId: f.id,
        userId: friendUserId,
        username: profile.username,
        matchmakingRating: profile.matchmakingRating,
        gamesPlayed: profile.gamesPlayed,
        onlineStatus: 'offline',
      });
    }
    friends.sort((a, b) => a.username.localeCompare(b.username));

    return friends;
  }

  async getPendingRequests(userId: string): Promise<FriendRequest[]> {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, "requesterId", "createdAt"')
      .eq('addresseeId', userId)
      .eq('status', 'pending');

    if (error || !friendships) {
      console.error('Error fetching pending requests:', error);
      return [];
    }

    if (friendships.length === 0) return [];

    const requesterIds = friendships.map(f => f.requesterId);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('"userId", username, "matchmakingRating", "gamesPlayed"')
      .in('userId', requesterIds);

    if (profileError || !profiles) {
      console.error('Error fetching requester profiles:', profileError);
      return [];
    }

    return friendships
      .map(f => {
        const profile = profiles.find(p => p.userId === f.requesterId);
        if (!profile) return null;

        return {
          friendshipId: f.id,
          requesterId: f.requesterId,
          username: profile.username,
          matchmakingRating: profile.matchmakingRating,
          gamesPlayed: profile.gamesPlayed,
          createdAt: f.createdAt,
        };
      })
      .filter((r): r is FriendRequest => r !== null);
  }

  async searchUsers(query: string, currentUserId: string): Promise<UserSearchResult[]> {
    if (!query || query.length < 2) return [];

    // Search users by username
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('"userId", username, "matchmakingRating", "gamesPlayed"')
      .ilike('username', `%${query}%`)
      .neq('userId', currentUserId)
      .limit(10);

    if (error || !users) {
      console.error('Error searching users:', error);
      return [];
    }

    if (users.length === 0) return [];

    // Get friendship statuses for found users
    const userIds = users.map(u => u.userId);
    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, "requesterId", "addresseeId", status')
      .or(
        userIds.map(uid =>
          `and(requesterId.eq.${currentUserId},addresseeId.eq.${uid}),and(requesterId.eq.${uid},addresseeId.eq.${currentUserId})`
        ).join(',')
      );

    return users.map(user => {
      let friendshipStatus: UserSearchResult['friendshipStatus'] = 'none';

      if (friendships) {
        const friendship = friendships.find(
          f =>
            (f.requesterId === currentUserId && f.addresseeId === user.userId) ||
            (f.requesterId === user.userId && f.addresseeId === currentUserId)
        );

        if (friendship) {
          if (friendship.status === 'blocked') {
            friendshipStatus = 'blocked';
          } else if (friendship.status === 'accepted') {
            friendshipStatus = 'accepted';
          } else if (friendship.status === 'pending') {
            friendshipStatus = friendship.requesterId === currentUserId
              ? 'pending_sent'
              : 'pending_received';
          }
        }
      }

      return {
        userId: user.userId,
        username: user.username,
        matchmakingRating: user.matchmakingRating,
        gamesPlayed: user.gamesPlayed,
        friendshipStatus,
      };
    });
  }

  async createChallenge(challengerId: string, challengedId: string): Promise<{
    success: boolean;
    challenge?: Challenge;
    error?: 'DUPLICATE_CHALLENGE' | 'NOT_FRIENDS' | 'INTERNAL_ERROR';
  }> {
    const { data, error } = await supabase
      .from('friend_challenges')
      .insert({
        challengerId,
        challengedId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      })
      .select('id, challengerId, challengedId, status, createdAt, expiresAt')
      .single();

    if (error) {
      console.error('Error creating challenge:', error);
      // Check for unique constraint violation (23505 = unique_violation)
      if (error.code === '23505') {
        return { success: false, error: 'DUPLICATE_CHALLENGE' };
      }
      return { success: false, error: 'INTERNAL_ERROR' };
    }

    // Fetch challenger profile for username
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('userId', challengerId)
      .single();

    return {
      success: true,
      challenge: {
        ...data,
        challengerUsername: profile?.username || 'Unknown',
      } as Challenge,
    };
  }

  async acceptChallenge(challengeId: string, userId: string): Promise<{
    success: boolean;
    roomId?: string;
    challengeId?: string;
    challengerId?: string;
    challengedId?: string;
    error?: 'CHALLENGE_NOT_FOUND' | 'CHALLENGE_EXPIRED' | 'CONCURRENT_MODIFICATION' | 'INTERNAL_ERROR';
  }> {
    const { data, error } = await supabase.rpc('accept_challenge', {
      p_challenge_id: challengeId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Error accepting challenge:', error);
      return { success: false, error: 'INTERNAL_ERROR' };
    }

    return data as any;
  }

  async declineChallenge(challengeId: string, userId: string): Promise<{
    success: boolean;
    error?: 'CHALLENGE_NOT_FOUND' | 'INTERNAL_ERROR';
  }> {
    const { data, error } = await supabase.rpc('decline_challenge', {
      p_challenge_id: challengeId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Error declining challenge:', error);
      return { success: false, error: 'INTERNAL_ERROR' };
    }

    return data as any;
  }

  async cancelChallenge(challengeId: string, userId: string): Promise<{
    success: boolean;
    error?: 'CHALLENGE_NOT_FOUND' | 'INTERNAL_ERROR';
  }> {
    const { data, error } = await supabase.rpc('cancel_challenge', {
      p_challenge_id: challengeId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Error cancelling challenge:', error);
      return { success: false, error: 'INTERNAL_ERROR' };
    }

    return data as any;
  }

  async getPendingChallenges(userId: string): Promise<Challenge[]> {
    // ONLY return challenges where user is the challenged party (incoming challenges)
    const { data: challenges, error } = await supabase
      .from('friend_challenges')
      .select('id, "challengerId", "challengedId", status, "createdAt", "expiresAt"')
      .eq('status', 'pending')
      .eq('challengedId', userId)  // ONLY incoming challenges
      .gt('expiresAt', new Date().toISOString())
      .order('createdAt', { ascending: true });

    if (error || !challenges) {
      console.error('Error fetching pending challenges:', error);
      return [];
    }

    if (challenges.length === 0) return [];

    // Fetch challenger profiles
    const challengerIds = challenges.map(c => c.challengerId);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('"userId", username')
      .in('userId', challengerIds);

    if (profileError || !profiles) {
      console.error('Error fetching challenger profiles:', profileError);
      return [];
    }

    const result: Challenge[] = [];
    for (const c of challenges) {
      const challengerProfile = profiles.find(p => p.userId === c.challengerId);
      if (!challengerProfile) continue;

      result.push({
        id: c.id,
        challengerId: c.challengerId,
        challengedId: c.challengedId,
        challengerUsername: challengerProfile.username,
        status: c.status as 'pending',
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
      });
    }
    return result;
  }

  async getOutgoingChallenges(userId: string): Promise<Challenge[]> {
    // Return challenges where user is the challenger (outgoing challenges)
    const { data: challenges, error } = await supabase
      .from('friend_challenges')
      .select('id, "challengerId", "challengedId", status, "createdAt", "expiresAt"')
      .eq('status', 'pending')
      .eq('challengerId', userId)  // ONLY outgoing challenges
      .gt('expiresAt', new Date().toISOString())
      .order('createdAt', { ascending: true });

    if (error || !challenges) {
      console.error('Error fetching outgoing challenges:', error);
      return [];
    }

    if (challenges.length === 0) return [];

    // Fetch challenged user profiles
    const challengedIds = challenges.map(c => c.challengedId);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('"userId", username')
      .in('userId', challengedIds);

    if (profileError || !profiles) {
      console.error('Error fetching challenged profiles:', profileError);
      return [];
    }

    const result: Challenge[] = [];
    for (const c of challenges) {
      const challengedProfile = profiles.find(p => p.userId === c.challengedId);
      if (!challengedProfile) continue;

      result.push({
        id: c.id,
        challengerId: c.challengerId,
        challengedId: c.challengedId,
        challengerUsername: '', // We don't need this for outgoing challenges
        challengedUsername: challengedProfile.username,  // The person we challenged
        status: c.status as 'pending',
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
      });
    }
    return result;
  }
}

export const friendService = new FriendService();
