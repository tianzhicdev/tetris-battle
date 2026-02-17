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
  challengedUsername?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  roomId?: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  resolvedAt?: string;
}

type FriendRequestResult =
  | { success: true; autoAccepted?: boolean }
  | { error: 'USER_NOT_FOUND' | 'ALREADY_EXISTS' | 'BLOCKED' | 'CANNOT_ADD_SELF' | 'INTERNAL_ERROR' };

class FriendService {
  async sendFriendRequest(
    requesterId: string,
    addresseeUsername: string
  ): Promise<FriendRequestResult> {
    const normalizedUsername = addresseeUsername.trim();
    if (!normalizedUsername) return { error: 'USER_NOT_FOUND' };

    // Look up addressee by username (case-insensitive)
    const { data: addresseeMatches, error: lookupError } = await supabase
      .from('user_profiles')
      .select('id, username')
      .ilike('username', normalizedUsername)
      .limit(1);

    const addressee = addresseeMatches?.[0];
    if (lookupError || !addressee) return { error: 'USER_NOT_FOUND' };

    const addresseeId = addressee.id;
    if (addresseeId === requesterId) return { error: 'CANNOT_ADD_SELF' };

    // Check if friendship already exists in either direction
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status, requester_id, addressee_id')
      .or(
        `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),` +
        `and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`
      );

    if (existing && existing.length > 0) {
      const blockedByAddressee = existing.find(
        (f) => f.status === 'blocked' && f.requester_id === addresseeId
      );
      if (blockedByAddressee) return { error: 'BLOCKED' };

      // If the other user already sent a pending request, auto-accept it
      const reversePending = existing.find(
        (f) =>
          f.status === 'pending' &&
          f.requester_id === addresseeId &&
          f.addressee_id === requesterId
      );
      if (reversePending) {
        const { error: acceptError } = await supabase
          .from('friendships')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
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
    const { error: insertError } = await supabase.from('friendships').insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: 'pending',
    });

    if (insertError) {
      console.error('Error sending friend request:', insertError);
      if (insertError.code === '23505') return { error: 'ALREADY_EXISTS' };
      return { error: 'INTERNAL_ERROR' };
    }

    return { success: true };
  }

  async acceptFriendRequest(friendshipId: string, userId: string): Promise<boolean> {
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', friendshipId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .single();

    if (!friendship) {
      console.error('Friend request not found or not authorized');
      return false;
    }

    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    if (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }
    return true;
  }

  async declineFriendRequest(friendshipId: string, userId: string): Promise<boolean> {
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', friendshipId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .single();

    if (!friendship) {
      console.error('Friend request not found or not authorized');
      return false;
    }

    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) {
      console.error('Error declining friend request:', error);
      return false;
    }
    return true;
  }

  async removeFriend(friendshipId: string, userId: string): Promise<boolean> {
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', friendshipId)
      .single();

    if (!friendship) {
      console.error('Friendship not found');
      return false;
    }

    if (friendship.requester_id !== userId && friendship.addressee_id !== userId) {
      console.error('Not authorized to remove this friendship');
      return false;
    }

    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) {
      console.error('Error removing friend:', error);
      return false;
    }
    return true;
  }

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    await supabase
      .from('friendships')
      .delete()
      .eq('requester_id', blockedId)
      .eq('addressee_id', blockerId)
      .eq('status', 'accepted');

    const { data: existing } = await supabase
      .from('friendships')
      .select('id')
      .eq('requester_id', blockerId)
      .eq('addressee_id', blockedId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'blocked', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) { console.error('Error blocking user:', error); return false; }
    } else {
      const { error } = await supabase.from('friendships').insert({
        requester_id: blockerId,
        addressee_id: blockedId,
        status: 'blocked',
      });
      if (error) { console.error('Error blocking user:', error); return false; }
    }
    return true;
  }

  async getFriendList(userId: string): Promise<Friend[]> {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error || !friendships) {
      console.error('Error fetching friend list:', error);
      return [];
    }
    if (friendships.length === 0) return [];

    const friendUserIds = friendships.map((f) =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, rating, games_played')
      .in('id', friendUserIds);

    if (profileError || !profiles) {
      console.error('Error fetching friend profiles:', profileError);
      return [];
    }

    const friends: Friend[] = [];
    for (const f of friendships) {
      const friendUserId = f.requester_id === userId ? f.addressee_id : f.requester_id;
      const profile = profiles.find((p) => p.id === friendUserId);
      if (!profile) continue;

      friends.push({
        friendshipId: f.id,
        userId: friendUserId,
        username: profile.username,
        matchmakingRating: profile.rating,
        gamesPlayed: profile.games_played,
        onlineStatus: 'offline',
      });
    }
    friends.sort((a, b) => a.username.localeCompare(b.username));
    return friends;
  }

  async getPendingRequests(userId: string): Promise<FriendRequest[]> {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, requester_id, created_at')
      .eq('addressee_id', userId)
      .eq('status', 'pending');

    if (error || !friendships) {
      console.error('Error fetching pending requests:', error);
      return [];
    }
    if (friendships.length === 0) return [];

    const requesterIds = friendships.map((f) => f.requester_id);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, rating, games_played')
      .in('id', requesterIds);

    if (profileError || !profiles) {
      console.error('Error fetching requester profiles:', profileError);
      return [];
    }

    return friendships
      .map((f) => {
        const profile = profiles.find((p) => p.id === f.requester_id);
        if (!profile) return null;
        return {
          friendshipId: f.id,
          requesterId: f.requester_id,
          username: profile.username,
          matchmakingRating: profile.rating,
          gamesPlayed: profile.games_played,
          createdAt: f.created_at,
        };
      })
      .filter((r): r is FriendRequest => r !== null);
  }

  async searchUsers(query: string, currentUserId: string): Promise<UserSearchResult[]> {
    if (!query || query.length < 2) return [];

    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, username, rating, games_played')
      .ilike('username', `%${query}%`)
      .neq('id', currentUserId)
      .limit(10);

    if (error || !users) {
      console.error('Error searching users:', error);
      return [];
    }
    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);
    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .or(
        userIds
          .map(
            (uid) =>
              `and(requester_id.eq.${currentUserId},addressee_id.eq.${uid}),` +
              `and(requester_id.eq.${uid},addressee_id.eq.${currentUserId})`
          )
          .join(',')
      );

    return users.map((user) => {
      let friendshipStatus: UserSearchResult['friendshipStatus'] = 'none';

      if (friendships) {
        const friendship = friendships.find(
          (f) =>
            (f.requester_id === currentUserId && f.addressee_id === user.id) ||
            (f.requester_id === user.id && f.addressee_id === currentUserId)
        );

        if (friendship) {
          if (friendship.status === 'blocked') {
            friendshipStatus = 'blocked';
          } else if (friendship.status === 'accepted') {
            friendshipStatus = 'accepted';
          } else if (friendship.status === 'pending') {
            friendshipStatus =
              friendship.requester_id === currentUserId ? 'pending_sent' : 'pending_received';
          }
        }
      }

      return {
        userId: user.id,
        username: user.username,
        matchmakingRating: user.rating,
        gamesPlayed: user.games_played,
        friendshipStatus,
      };
    });
  }

  async createChallenge(
    challengerId: string,
    challengedId: string
  ): Promise<{
    success: boolean;
    challenge?: Challenge;
    error?: 'DUPLICATE_CHALLENGE' | 'NOT_FRIENDS' | 'INTERNAL_ERROR';
  }> {
    const { data, error } = await supabase
      .from('friend_challenges')
      .insert({
        challenger_id: challengerId,
        challenged_id: challengedId,
        status: 'pending',
        expires_at: new Date(Date.now() + 120000).toISOString(),
      })
      .select('id, challenger_id, challenged_id, status, created_at, expires_at')
      .single();

    if (error) {
      console.error('Error creating challenge:', error);
      if (error.code === '23505') return { success: false, error: 'DUPLICATE_CHALLENGE' };
      return { success: false, error: 'INTERNAL_ERROR' };
    }

    // Fetch challenger profile for username
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', challengerId)
      .single();

    return {
      success: true,
      challenge: {
        id: data.id,
        challengerId: data.challenger_id,
        challengedId: data.challenged_id,
        challengerUsername: profile?.username || 'Unknown',
        status: data.status,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
      } as Challenge,
    };
  }

  async acceptChallenge(
    challengeId: string,
    userId: string
  ): Promise<{
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

  async declineChallenge(
    challengeId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
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

  async cancelChallenge(
    challengeId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
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
    const { data: challenges, error } = await supabase
      .from('friend_challenges')
      .select('id, challenger_id, challenged_id, status, created_at, expires_at')
      .eq('status', 'pending')
      .eq('challenged_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error || !challenges) {
      console.error('Error fetching pending challenges:', error);
      return [];
    }
    if (challenges.length === 0) return [];

    const challengerIds = challenges.map((c) => c.challenger_id);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username')
      .in('id', challengerIds);

    if (profileError || !profiles) {
      console.error('Error fetching challenger profiles:', profileError);
      return [];
    }

    return challenges
      .map((c) => {
        const challengerProfile = profiles.find((p) => p.id === c.challenger_id);
        if (!challengerProfile) return null;
        return {
          id: c.id,
          challengerId: c.challenger_id,
          challengedId: c.challenged_id,
          challengerUsername: challengerProfile.username,
          status: c.status as Challenge['status'],
          expiresAt: c.expires_at,
          createdAt: c.created_at,
        } as Challenge;
      })
      .filter((c): c is Challenge => c !== null);
  }

  async getOutgoingChallenges(userId: string): Promise<Challenge[]> {
    const { data: challenges, error } = await supabase
      .from('friend_challenges')
      .select('id, challenger_id, challenged_id, status, created_at, expires_at')
      .eq('status', 'pending')
      .eq('challenger_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error || !challenges) {
      console.error('Error fetching outgoing challenges:', error);
      return [];
    }
    if (challenges.length === 0) return [];

    const challengedIds = challenges.map((c) => c.challenged_id);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username')
      .in('id', challengedIds);

    if (profileError || !profiles) {
      console.error('Error fetching challenged profiles:', profileError);
      return [];
    }

    return challenges
      .map((c) => {
        const challengedProfile = profiles.find((p) => p.id === c.challenged_id);
        if (!challengedProfile) return null;
        return {
          id: c.id,
          challengerId: c.challenger_id,
          challengedId: c.challenged_id,
          challengerUsername: '',
          challengedUsername: challengedProfile.username,
          status: c.status as Challenge['status'],
          expiresAt: c.expires_at,
          createdAt: c.created_at,
        } as Challenge;
      })
      .filter((c): c is Challenge => c !== null);
  }
}

export const friendService = new FriendService();
