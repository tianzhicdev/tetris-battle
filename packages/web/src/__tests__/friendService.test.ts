import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must use vi.hoisted for variables used in vi.mock factory
const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import { friendService } from '../services/friendService';

// Helper to build chainable Supabase query mock
function mockQuery(result: { data?: any; error?: any }) {
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'or', 'in', 'ilike', 'limit', 'order', 'gte'];

  const chain: Record<string, any> = {};

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // .single() resolves the final result
  chain.single = vi.fn().mockResolvedValue(result);

  // Make chain thenable for awaiting without .single()
  chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
    return Promise.resolve(result).then(resolve, reject);
  };

  return chain;
}

describe('FriendService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendFriendRequest', () => {
    it('creates pending friendship with valid username', async () => {
      // Mock uses snake_case id field (matches DB schema)
      const lookupQuery = mockQuery({ data: [{ id: 'user-2', username: 'bob' }] });
      const existingQuery = mockQuery({ data: [], error: null });
      const insertQuery = mockQuery({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') return lookupQuery;
        if (table === 'friendships') {
          callCount++;
          if (callCount === 1) return existingQuery;
          return insertQuery;
        }
        return mockQuery({ data: null });
      });

      const result = await friendService.sendFriendRequest('user-1', 'bob');
      expect(result).toEqual({ success: true });
    });

    it('returns USER_NOT_FOUND for nonexistent username', async () => {
      const lookupQuery = mockQuery({ data: null, error: { code: 'PGRST116' } });
      mockFrom.mockReturnValue(lookupQuery);

      const result = await friendService.sendFriendRequest('user-1', 'nonexistent');
      expect(result).toEqual({ error: 'USER_NOT_FOUND' });
    });

    it('returns ALREADY_EXISTS for duplicate request', async () => {
      const lookupQuery = mockQuery({ data: [{ id: 'user-2', username: 'bob' }] });
      const existingQuery = mockQuery({
        data: [{ id: 'f-1', status: 'pending', requester_id: 'user-1', addressee_id: 'user-2' }],
      });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') return lookupQuery;
        if (table === 'friendships') {
          callCount++;
          return existingQuery;
        }
        return mockQuery({ data: null });
      });

      const result = await friendService.sendFriendRequest('user-1', 'bob');
      expect(result).toEqual({ error: 'ALREADY_EXISTS' });
    });

    it('returns BLOCKED when addressee has blocked requester', async () => {
      const lookupQuery = mockQuery({ data: [{ id: 'user-2', username: 'bob' }] });
      const existingQuery = mockQuery({
        data: [{ id: 'f-1', status: 'blocked', requester_id: 'user-2', addressee_id: 'user-1' }],
      });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') return lookupQuery;
        if (table === 'friendships') {
          callCount++;
          return existingQuery;
        }
        return mockQuery({ data: null });
      });

      const result = await friendService.sendFriendRequest('user-1', 'bob');
      expect(result).toEqual({ error: 'BLOCKED' });
    });

    it('returns CANNOT_ADD_SELF when trying to add yourself', async () => {
      // id matches requesterId → CANNOT_ADD_SELF
      const lookupQuery = mockQuery({ data: [{ id: 'user-1', username: 'me' }] });
      mockFrom.mockReturnValue(lookupQuery);

      const result = await friendService.sendFriendRequest('user-1', 'me');
      expect(result).toEqual({ error: 'CANNOT_ADD_SELF' });
    });

    it('auto-accepts reverse pending request', async () => {
      const lookupQuery = mockQuery({ data: [{ id: 'user-2', username: 'bob' }] });
      const existingQuery = mockQuery({
        data: [{ id: 'f-1', status: 'pending', requester_id: 'user-2', addressee_id: 'user-1' }],
      });
      const updateQuery = mockQuery({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') return lookupQuery;
        if (table === 'friendships') {
          callCount++;
          if (callCount === 1) return existingQuery;
          return updateQuery;
        }
        return mockQuery({ data: null });
      });

      const result = await friendService.sendFriendRequest('user-1', 'bob');
      expect(result).toEqual({ success: true, autoAccepted: true });
    });
  });

  describe('acceptFriendRequest', () => {
    it('accepts valid pending request when user is addressee', async () => {
      const selectQuery = mockQuery({
        data: { id: 'f-1', addressee_id: 'user-2', status: 'pending' },
      });
      const updateQuery = mockQuery({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return selectQuery;
        return updateQuery;
      });

      const result = await friendService.acceptFriendRequest('f-1', 'user-2');
      expect(result).toBe(true);
    });

    it('rejects when user is not the addressee', async () => {
      const selectQuery = mockQuery({ data: null, error: { code: 'PGRST116' } });
      mockFrom.mockReturnValue(selectQuery);

      const result = await friendService.acceptFriendRequest('f-1', 'wrong-user');
      expect(result).toBe(false);
    });
  });

  describe('declineFriendRequest', () => {
    it('deletes the friendship row', async () => {
      const selectQuery = mockQuery({
        data: { id: 'f-1', addressee_id: 'user-2', status: 'pending' },
      });
      const deleteQuery = mockQuery({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return selectQuery;
        return deleteQuery;
      });

      const result = await friendService.declineFriendRequest('f-1', 'user-2');
      expect(result).toBe(true);
    });
  });

  describe('removeFriend', () => {
    it('allows either party to remove friendship', async () => {
      const selectQuery = mockQuery({
        data: { id: 'f-1', requester_id: 'user-1', addressee_id: 'user-2' },
      });
      const deleteQuery = mockQuery({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return selectQuery;
        return deleteQuery;
      });

      const result = await friendService.removeFriend('f-1', 'user-1');
      expect(result).toBe(true);
    });

    it('rejects removal by non-member', async () => {
      const selectQuery = mockQuery({
        data: { id: 'f-1', requester_id: 'user-1', addressee_id: 'user-2' },
      });
      mockFrom.mockReturnValue(selectQuery);

      const result = await friendService.removeFriend('f-1', 'user-3');
      expect(result).toBe(false);
    });
  });

  describe('blockUser', () => {
    it('creates blocked status and removes reverse accepted friendship', async () => {
      const deleteQuery = mockQuery({ data: null, error: null });
      const selectQuery = mockQuery({ data: null, error: { code: 'PGRST116' } });
      const insertQuery = mockQuery({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return deleteQuery;
        if (callCount === 2) return selectQuery;
        return insertQuery;
      });

      const result = await friendService.blockUser('user-1', 'user-2');
      expect(result).toBe(true);
    });
  });

  describe('getFriendList', () => {
    it('returns only accepted friendships with profile data', async () => {
      const friendshipsQuery = mockQuery({
        data: [
          { id: 'f-1', requester_id: 'user-1', addressee_id: 'user-2' },
          { id: 'f-2', requester_id: 'user-3', addressee_id: 'user-1' },
        ],
      });
      const profilesQuery = mockQuery({
        data: [
          { id: 'user-2', username: 'bob', rating: 1200, games_played: 25 },
          { id: 'user-3', username: 'alice', rating: 1100, games_played: 10 },
        ],
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return friendshipsQuery;
        return profilesQuery;
      });

      const friends = await friendService.getFriendList('user-1');
      expect(friends).toHaveLength(2);
      expect(friends[0].username).toBe('alice');
      expect(friends[1].username).toBe('bob');
      expect(friends[0].onlineStatus).toBe('offline');
    });
  });

  describe('getPendingRequests', () => {
    it('returns only pending where user is addressee', async () => {
      const friendshipsQuery = mockQuery({
        data: [{ id: 'f-1', requester_id: 'user-2', created_at: '2026-01-01' }],
      });
      const profilesQuery = mockQuery({
        data: [{ id: 'user-2', username: 'bob', rating: 1200, games_played: 25 }],
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return friendshipsQuery;
        return profilesQuery;
      });

      const requests = await friendService.getPendingRequests('user-1');
      expect(requests).toHaveLength(1);
      expect(requests[0].username).toBe('bob');
      expect(requests[0].requesterId).toBe('user-2');
    });
  });

  describe('searchUsers', () => {
    it('returns search results with friendship status', async () => {
      const usersQuery = mockQuery({
        data: [
          { id: 'user-2', username: 'bob', rating: 1200, games_played: 25 },
          { id: 'user-3', username: 'bobby', rating: 1100, games_played: 10 },
        ],
      });
      const friendshipsQuery = mockQuery({
        data: [{ id: 'f-1', requester_id: 'user-1', addressee_id: 'user-2', status: 'accepted' }],
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return usersQuery;
        return friendshipsQuery;
      });

      const results = await friendService.searchUsers('bob', 'user-1');
      expect(results).toHaveLength(2);
      expect(results[0].friendshipStatus).toBe('accepted');
      expect(results[1].friendshipStatus).toBe('none');
    });

    it('returns empty array for short queries', async () => {
      const results = await friendService.searchUsers('a', 'user-1');
      expect(results).toEqual([]);
    });
  });
});
