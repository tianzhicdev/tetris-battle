import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock friendService
vi.mock('../services/friendService', () => ({
  friendService: {
    getFriendList: vi.fn(),
    getPendingRequests: vi.fn(),
    sendFriendRequest: vi.fn(),
    acceptFriendRequest: vi.fn(),
    declineFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
    searchUsers: vi.fn(),
    createChallenge: vi.fn(),
    updateChallengeStatus: vi.fn(),
  },
}));

import { useFriendStore } from '../stores/friendStore';
import { friendService } from '../services/friendService';

const mockFriendService = vi.mocked(friendService);

describe('FriendStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useFriendStore.setState({
      friends: [],
      pendingRequests: [],
      incomingChallenge: null,
      outgoingChallenge: null,
      searchResults: [],
      searchLoading: false,
      friendsLoading: false,
    });
  });

  describe('loadFriends', () => {
    it('loads friends and sets state', async () => {
      const mockFriends = [
        { friendshipId: 'f1', userId: 'u2', username: 'bob', level: 5, rank: 1200, onlineStatus: 'offline' as const },
      ];
      mockFriendService.getFriendList.mockResolvedValue(mockFriends);

      await useFriendStore.getState().loadFriends('u1');

      expect(mockFriendService.getFriendList).toHaveBeenCalledWith('u1');
      expect(useFriendStore.getState().friends).toEqual(mockFriends);
      expect(useFriendStore.getState().friendsLoading).toBe(false);
    });
  });

  describe('loadPendingRequests', () => {
    it('loads pending requests', async () => {
      const mockRequests = [
        { friendshipId: 'f1', requesterId: 'u2', username: 'bob', level: 5, rank: 1200, createdAt: '2026-01-01' },
      ];
      mockFriendService.getPendingRequests.mockResolvedValue(mockRequests);

      await useFriendStore.getState().loadPendingRequests('u1');

      expect(useFriendStore.getState().pendingRequests).toEqual(mockRequests);
    });
  });

  describe('sendRequest', () => {
    it('returns success on valid request', async () => {
      mockFriendService.sendFriendRequest.mockResolvedValue({ success: true });

      const result = await useFriendStore.getState().sendRequest('u1', 'bob');

      expect(result).toEqual({ success: true });
    });

    it('returns error on invalid request', async () => {
      mockFriendService.sendFriendRequest.mockResolvedValue({ error: 'USER_NOT_FOUND' });

      const result = await useFriendStore.getState().sendRequest('u1', 'nonexistent');

      expect(result).toEqual({ success: false, error: 'USER_NOT_FOUND' });
    });
  });

  describe('acceptRequest', () => {
    it('reloads friends and requests after accepting', async () => {
      mockFriendService.acceptFriendRequest.mockResolvedValue(true);
      mockFriendService.getFriendList.mockResolvedValue([]);
      mockFriendService.getPendingRequests.mockResolvedValue([]);

      await useFriendStore.getState().acceptRequest('f1', 'u1');

      expect(mockFriendService.acceptFriendRequest).toHaveBeenCalledWith('f1', 'u1');
      expect(mockFriendService.getFriendList).toHaveBeenCalledWith('u1');
      expect(mockFriendService.getPendingRequests).toHaveBeenCalledWith('u1');
    });
  });

  describe('declineRequest', () => {
    it('reloads requests after declining', async () => {
      mockFriendService.declineFriendRequest.mockResolvedValue(true);
      mockFriendService.getPendingRequests.mockResolvedValue([]);

      await useFriendStore.getState().declineRequest('f1', 'u1');

      expect(mockFriendService.declineFriendRequest).toHaveBeenCalledWith('f1', 'u1');
      expect(mockFriendService.getPendingRequests).toHaveBeenCalledWith('u1');
    });
  });

  describe('removeFriend', () => {
    it('reloads friends after removing', async () => {
      mockFriendService.removeFriend.mockResolvedValue(true);
      mockFriendService.getFriendList.mockResolvedValue([]);

      await useFriendStore.getState().removeFriend('f1', 'u1');

      expect(mockFriendService.removeFriend).toHaveBeenCalledWith('f1', 'u1');
      expect(mockFriendService.getFriendList).toHaveBeenCalledWith('u1');
    });
  });

  describe('searchUsers', () => {
    it('searches and updates results', async () => {
      const mockResults = [
        { userId: 'u2', username: 'bob', level: 5, rank: 1200, friendshipStatus: 'none' as const },
      ];
      mockFriendService.searchUsers.mockResolvedValue(mockResults);

      await useFriendStore.getState().searchUsers('bob', 'u1');

      expect(useFriendStore.getState().searchResults).toEqual(mockResults);
      expect(useFriendStore.getState().searchLoading).toBe(false);
    });

    it('clears results for short queries', async () => {
      await useFriendStore.getState().searchUsers('a', 'u1');

      expect(useFriendStore.getState().searchResults).toEqual([]);
    });
  });

  describe('updatePresence', () => {
    it('updates friend online status', () => {
      useFriendStore.setState({
        friends: [
          { friendshipId: 'f1', userId: 'u2', username: 'bob', level: 5, rank: 1200, onlineStatus: 'offline' },
        ],
      });

      useFriendStore.getState().updatePresence('u2', 'online');

      expect(useFriendStore.getState().friends[0].onlineStatus).toBe('online');
    });
  });

  describe('challenge state', () => {
    it('sets and clears incoming challenge', () => {
      const challenge = {
        challengeId: 'c1',
        challengerId: 'u2',
        challengedId: 'u1',
        challengerUsername: 'bob',
        challengerRank: 1200,
        challengerLevel: 5,
        expiresAt: Date.now() + 120000,
      };

      useFriendStore.getState().setIncomingChallenge(challenge);
      expect(useFriendStore.getState().incomingChallenge).toEqual(challenge);

      useFriendStore.getState().setIncomingChallenge(null);
      expect(useFriendStore.getState().incomingChallenge).toBeNull();
    });

    it('sets and clears outgoing challenge', () => {
      const challenge = {
        challengeId: 'c1',
        challengerId: 'u1',
        challengedId: 'u2',
        challengerUsername: 'bob',
        challengerRank: 1200,
        challengerLevel: 5,
        expiresAt: Date.now() + 120000,
      };

      useFriendStore.getState().setOutgoingChallenge(challenge);
      expect(useFriendStore.getState().outgoingChallenge).toEqual(challenge);

      useFriendStore.getState().clearChallenges();
      expect(useFriendStore.getState().outgoingChallenge).toBeNull();
      expect(useFriendStore.getState().incomingChallenge).toBeNull();
    });
  });
});
