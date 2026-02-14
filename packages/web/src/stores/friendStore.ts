import { create } from 'zustand';
import { friendService } from '../services/friendService';
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
}

export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  pendingRequests: [],
  incomingChallenge: null,
  outgoingChallenge: null,
  searchResults: [],
  searchLoading: false,
  friendsLoading: false,

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
}));
