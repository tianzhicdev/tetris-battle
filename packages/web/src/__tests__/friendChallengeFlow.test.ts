import { describe, it, expect, beforeEach } from 'vitest';
import { useFriendStore } from '../stores/friendStore';
import type { Challenge } from '../services/friendService';

describe('Friend Challenge Flow', () => {
  beforeEach(() => {
    useFriendStore.getState().clearChallenges();
  });

  it('sets outgoing challenge', () => {
    const challenge: Challenge = {
      id: 'test-challenge-1',
      challengerId: 'user-1',
      challengedId: 'user-2',
      challengerUsername: 'Player1',
      challengedUsername: 'Player2',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };

    useFriendStore.getState().setOutgoingChallenge(challenge);
    expect(useFriendStore.getState().outgoingChallenge).toEqual(challenge);
  });

  it('sets incoming challenge', () => {
    const challenge: Challenge = {
      id: 'test-challenge-2',
      challengerId: 'user-2',
      challengedId: 'user-1',
      challengerUsername: 'Player2',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };

    useFriendStore.getState().setIncomingChallenge(challenge);
    expect(useFriendStore.getState().incomingChallenge).toEqual(challenge);
  });

  it('clears both incoming and outgoing challenges', () => {
    const outgoing: Challenge = {
      id: 'test-outgoing',
      challengerId: 'user-1',
      challengedId: 'user-2',
      challengerUsername: 'Player1',
      challengedUsername: 'Player2',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };

    const incoming: Challenge = {
      id: 'test-incoming',
      challengerId: 'user-2',
      challengedId: 'user-1',
      challengerUsername: 'Player2',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };

    useFriendStore.getState().setOutgoingChallenge(outgoing);
    useFriendStore.getState().setIncomingChallenge(incoming);
    useFriendStore.getState().clearChallenges();

    expect(useFriendStore.getState().outgoingChallenge).toBeNull();
    expect(useFriendStore.getState().incomingChallenge).toBeNull();
  });
});
