import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase to avoid env var requirement
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { useFriendStore } from '../stores/friendStore';
import type { Challenge } from '../services/friendService';

describe('Friend Challenge Flow', () => {
  beforeEach(() => {
    // Reset store
    useFriendStore.getState().clearChallenges();
  });

  it('should set outgoing challenge when challenge is sent', () => {
    const challenge: Challenge = {
      challengeId: 'test-challenge-1',
      challengerId: 'user-1',
      challengedId: 'user-2',
      challengerUsername: 'Player1',
      challengerRank: 1000,
      challengerLevel: 5,
      expiresAt: Date.now() + 120000,
    };

    useFriendStore.getState().setOutgoingChallenge(challenge);
    expect(useFriendStore.getState().outgoingChallenge).toEqual(challenge);
  });

  it('should set incoming challenge when challenge is received', () => {
    const challenge: Challenge = {
      challengeId: 'test-challenge-2',
      challengerId: 'user-2',
      challengedId: 'user-1',
      challengerUsername: 'Player2',
      challengerRank: 1100,
      challengerLevel: 6,
      expiresAt: Date.now() + 120000,
    };

    useFriendStore.getState().setIncomingChallenge(challenge);
    expect(useFriendStore.getState().incomingChallenge).toEqual(challenge);
  });

  it('should clear challenges when clearChallenges is called', () => {
    const outgoing: Challenge = {
      challengeId: 'test-outgoing',
      challengerId: 'user-1',
      challengedId: 'user-2',
      challengerUsername: 'Player1',
      challengerRank: 1000,
      challengerLevel: 5,
      expiresAt: Date.now() + 120000,
    };

    const incoming: Challenge = {
      challengeId: 'test-incoming',
      challengerId: 'user-2',
      challengedId: 'user-1',
      challengerUsername: 'Player2',
      challengerRank: 1100,
      challengerLevel: 6,
      expiresAt: Date.now() + 120000,
    };

    useFriendStore.getState().setOutgoingChallenge(outgoing);
    useFriendStore.getState().setIncomingChallenge(incoming);

    expect(useFriendStore.getState().outgoingChallenge).toEqual(outgoing);
    expect(useFriendStore.getState().incomingChallenge).toEqual(incoming);

    useFriendStore.getState().clearChallenges();

    expect(useFriendStore.getState().outgoingChallenge).toBeNull();
    expect(useFriendStore.getState().incomingChallenge).toBeNull();
  });
});
