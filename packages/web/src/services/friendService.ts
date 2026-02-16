import { supabase } from '../lib/supabase';

export interface Friend {
  friendshipId: string;
  userId: string;
  username: string;
  level: number;
  rank: number;
  onlineStatus: 'online' | 'in_game' | 'offline';
}

export interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  username: string;
  level: number;
  rank: number;
  createdAt: string;
}

export interface UserSearchResult {
  userId: string;
  username: string;
  level: number;
  rank: number;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
}

export interface Challenge {
  challengeId: string;
  challengerId: string;
  challengedId: string;
  challengerUsername: string;
  challengerRank: number;
  challengerLevel: number;
  expiresAt: number;
}

type FriendRequestResult =
  | { success: true }
  | { error: 'USER_NOT_FOUND' | 'ALREADY_EXISTS' | 'BLOCKED' | 'CANNOT_ADD_SELF' };

class FriendService {
  async sendFriendRequest(requesterId: string, addresseeUsername: string): Promise<FriendRequestResult> {
    // Look up addressee by username
    const { data: addressee, error: lookupError } = await supabase
      .from('user_profiles')
      .select('"userId", username')
      .eq('username', addresseeUsername)
      .single();

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
      const friendship = existing[0];
      // Check if blocked
      if (friendship.status === 'blocked' && friendship.requesterId === addresseeId) {
        return { error: 'BLOCKED' };
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
      return { error: 'ALREADY_EXISTS' };
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
      .select('"userId", username, level, rank')
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
        level: profile.level,
        rank: profile.rank,
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
      .select('"userId", username, level, rank')
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
          level: profile.level,
          rank: profile.rank,
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
      .select('"userId", username, level, rank')
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
        level: user.level,
        rank: user.rank,
        friendshipStatus,
      };
    });
  }

  async createChallenge(challengerId: string, challengedId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('friend_challenges')
      .insert({
        challengerId,
        challengedId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating challenge:', error);
      return null;
    }

    return data.id;
  }

  async updateChallengeStatus(challengeId: string, status: 'accepted' | 'declined' | 'expired'): Promise<boolean> {
    const { error } = await supabase
      .from('friend_challenges')
      .update({ status })
      .eq('id', challengeId);

    if (error) {
      console.error('Error updating challenge status:', error);
      return false;
    }

    return true;
  }

  async getPendingChallenges(userId: string): Promise<Challenge[]> {
    // ONLY return challenges where user is the challenged party (incoming challenges)
    const { data: challenges, error } = await supabase
      .from('friend_challenges')
      .select('id, "challengerId", "challengedId", "createdAt", "expiresAt"')
      .eq('status', 'pending')
      .eq('challengedId', userId)  // ONLY incoming challenges
      .gt('expiresAt', new Date().toISOString());

    if (error || !challenges) {
      console.error('Error fetching pending challenges:', error);
      return [];
    }

    if (challenges.length === 0) return [];

    // Fetch challenger profiles
    const challengerIds = challenges.map(c => c.challengerId);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('"userId", username, level, rank')
      .in('userId', challengerIds);

    if (profileError || !profiles) {
      console.error('Error fetching challenger profiles:', profileError);
      return [];
    }

    return challenges.map(c => {
      const challengerProfile = profiles.find(p => p.userId === c.challengerId);
      if (!challengerProfile) return null;

      return {
        challengeId: c.id,
        challengerId: c.challengerId,
        challengedId: c.challengedId,
        challengerUsername: challengerProfile.username,
        challengerRank: challengerProfile.rank,
        challengerLevel: challengerProfile.level,
        expiresAt: new Date(c.expiresAt).getTime(),
      };
    }).filter((c): c is Challenge => c !== null);
  }

  async getOutgoingChallenges(userId: string): Promise<Challenge[]> {
    // Return challenges where user is the challenger (outgoing challenges)
    const { data: challenges, error } = await supabase
      .from('friend_challenges')
      .select('id, "challengerId", "challengedId", "createdAt", "expiresAt"')
      .eq('status', 'pending')
      .eq('challengerId', userId)  // ONLY outgoing challenges
      .gt('expiresAt', new Date().toISOString());

    if (error || !challenges) {
      console.error('Error fetching outgoing challenges:', error);
      return [];
    }

    if (challenges.length === 0) return [];

    // Fetch challenged user profiles
    const challengedIds = challenges.map(c => c.challengedId);

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('"userId", username, level, rank')
      .in('userId', challengedIds);

    if (profileError || !profiles) {
      console.error('Error fetching challenged profiles:', profileError);
      return [];
    }

    return challenges.map(c => {
      const challengedProfile = profiles.find(p => p.userId === c.challengedId);
      if (!challengedProfile) return null;

      return {
        challengeId: c.id,
        challengerId: c.challengerId,
        challengedId: c.challengedId,
        challengerUsername: challengedProfile.username,  // Actually the challenged user's name
        challengerRank: challengedProfile.rank,
        challengerLevel: challengedProfile.level,
        expiresAt: new Date(c.expiresAt).getTime(),
      };
    }).filter((c): c is Challenge => c !== null);
  }
}

export const friendService = new FriendService();
