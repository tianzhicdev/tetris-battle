import { create } from 'zustand';
import { friendService } from '../services/friendService';
import { audioManager } from '../services/audioManager';
import type { Friend, FriendRequest, UserSearchResult, Challenge } from '../services/friendService';

export type { Friend, FriendRequest, UserSearchResult, Challenge };

interface FriendStore {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  incomingChallenge: Challenge | null;
  outgoingChallenge: Challenge | null;
  searchResults: UserSearchResult[];
  searchLoading: boolean;
  friendsLoading: boolean;
  pendingChallengeCreate: boolean;
  pendingChallengeAccept: boolean;

  // Actions
  loadFriends: (userId: string) => Promise<void>;
  loadPendingRequests: (userId: string) => Promise<void>;
  sendRequest: (requesterId: string, username: string) => Promise<{ success: boolean; error?: string }>;
  acceptRequest: (friendshipId: string, userId: string) => Promise<void>;
  declineRequest: (friendshipId: string, userId: string) => Promise<void>;
  removeFriend: (friendshipId: string, userId: string) => Promise<void>;
  searchUsers: (query: string, userId: string) => Promise<void>;
  updatePresence: (userId: string, status: 'online' | 'in_game' | 'offline') => void;
  setIncomingChallenge: (challenge: Challenge | null) => void;
  setOutgoingChallenge: (challenge: Challenge | null) => void;
  clearChallenges: () => void;
  sendChallenge: (friendUserId: string, friendUsername: string, currentUserId: string) => Promise<void>;
  acceptChallenge: (challengeId: string, userId: string, navigate: (path: string, options?: any) => void) => Promise<void>;
  declineChallenge: (challengeId: string, userId: string) => Promise<void>;
  cancelChallenge: (challengeId: string, userId: string) => Promise<void>;
}

export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  pendingRequests: [],
  incomingChallenge: null,
  outgoingChallenge: null,
  searchResults: [],
  searchLoading: false,
  friendsLoading: false,
  pendingChallengeCreate: false,
  pendingChallengeAccept: false,

  loadFriends: async (userId: string) => {
    set({ friendsLoading: true });
    const friends = await friendService.getFriendList(userId);
    set({ friends, friendsLoading: false });
  },

  loadPendingRequests: async (userId: string) => {
    const pendingRequests = await friendService.getPendingRequests(userId);
    set({ pendingRequests });
  },

  sendRequest: async (requesterId: string, username: string) => {
    const result = await friendService.sendFriendRequest(requesterId, username);
    if ('success' in result) {
      return { success: true };
    }
    return { success: false, error: result.error };
  },

  acceptRequest: async (friendshipId: string, userId: string) => {
    const success = await friendService.acceptFriendRequest(friendshipId, userId);
    if (success) {
      await get().loadFriends(userId);
      await get().loadPendingRequests(userId);
    }
  },

  declineRequest: async (friendshipId: string, userId: string) => {
    const success = await friendService.declineFriendRequest(friendshipId, userId);
    if (success) {
      await get().loadPendingRequests(userId);
    }
  },

  removeFriend: async (friendshipId: string, userId: string) => {
    const success = await friendService.removeFriend(friendshipId, userId);
    if (success) {
      await get().loadFriends(userId);
    }
  },

  searchUsers: async (query: string, userId: string) => {
    if (!query || query.length < 2) {
      set({ searchResults: [], searchLoading: false });
      return;
    }
    set({ searchLoading: true });
    const searchResults = await friendService.searchUsers(query, userId);
    set({ searchResults, searchLoading: false });
  },

  updatePresence: (userId: string, status: 'online' | 'in_game' | 'offline') => {
    set(state => ({
      friends: state.friends.map(f =>
        f.userId === userId ? { ...f, onlineStatus: status } : f
      ),
    }));
  },

  setIncomingChallenge: (challenge: Challenge | null) => {
    set({ incomingChallenge: challenge });
  },

  setOutgoingChallenge: (challenge: Challenge | null) => {
    set({ outgoingChallenge: challenge });
  },

  clearChallenges: () => {
    set({ incomingChallenge: null, outgoingChallenge: null });
  },

  sendChallenge: async (friendUserId: string, friendUsername: string, currentUserId: string) => {
    console.log('[STORE] Sending challenge to:', friendUserId);

    // Optimistic UI update
    const tempChallenge: Challenge = {
      id: crypto.randomUUID(),
      challengerId: currentUserId,
      challengedId: friendUserId,
      challengedUsername: friendUsername,
      challengerUsername: '', // Will be filled by real data
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };

    set({
      outgoingChallenge: tempChallenge,
      pendingChallengeCreate: true,
    });

    try {
      const result = await friendService.createChallenge(currentUserId, friendUserId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create challenge');
      }

      // Update with real data from database
      set({
        outgoingChallenge: result.challenge!,
        pendingChallengeCreate: false,
      });

      audioManager.playSfx('button_click');
    } catch (error) {
      console.error('[STORE] Error sending challenge:', error);

      // Rollback optimistic update
      set({
        outgoingChallenge: null,
        pendingChallengeCreate: false,
      });

      throw error;
    }
  },

  acceptChallenge: async (challengeId: string, userId: string, navigate: (path: string, options?: any) => void) => {
    console.log('[STORE] Accepting challenge:', challengeId);

    set({ pendingChallengeAccept: true });

    try {
      const result = await friendService.acceptChallenge(challengeId, userId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to accept challenge');
      }

      // Clear challenge (navigation happens here)
      set({
        incomingChallenge: null,
        pendingChallengeAccept: false,
      });

      // Navigate to game room
      navigate(`/game?roomId=${result.roomId}&mode=friend`, {
        state: {
          challengeId: result.challengeId,
          opponentId: result.challengerId,
        },
      });

      audioManager.playSfx('match_found');
    } catch (error) {
      console.error('[STORE] Error accepting challenge:', error);
      set({ pendingChallengeAccept: false });
      throw error;
    }
  },

  declineChallenge: async (challengeId: string, userId: string) => {
    console.log('[STORE] Declining challenge:', challengeId);

    // Optimistic clear
    set({ incomingChallenge: null });

    try {
      await friendService.declineChallenge(challengeId, userId);
    } catch (error) {
      console.error('[STORE] Error declining challenge:', error);
      // Don't rollback, challenge is gone from UI
    }
  },

  cancelChallenge: async (challengeId: string, userId: string) => {
    console.log('[STORE] Cancelling challenge:', challengeId);

    // Optimistic clear
    set({ outgoingChallenge: null });

    try {
      await friendService.cancelChallenge(challengeId, userId);
    } catch (error) {
      console.error('[STORE] Error cancelling challenge:', error);
      // Don't rollback
    }
  },
}));
