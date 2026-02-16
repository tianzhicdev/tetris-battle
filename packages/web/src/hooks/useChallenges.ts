import { useEffect } from 'react';
import { useIncomingChallenges } from './useIncomingChallenges';
import { useOutgoingChallenges } from './useOutgoingChallenges';
import { friendService } from '../services/friendService';
import { useFriendStore } from '../stores/friendStore';

/**
 * Combined hook that:
 * 1. Sets up real-time subscriptions for incoming and outgoing challenges
 * 2. Loads pending challenges from database on mount (in case they exist from previous session)
 *
 * This is the main hook to use in App.tsx for friend challenge functionality.
 *
 * @param userId - The current user's ID
 */
export function useChallenges(userId: string) {
  const setIncomingChallenge = useFriendStore(s => s.setIncomingChallenge);
  const setOutgoingChallenge = useFriendStore(s => s.setOutgoingChallenge);

  // Set up real-time subscriptions for both incoming and outgoing challenges
  useIncomingChallenges(userId);
  useOutgoingChallenges(userId);

  // Load initial pending challenges from database on mount
  // This ensures challenges persist across page refreshes and reconnections
  useEffect(() => {
    if (!userId) return;

    const loadInitialChallenges = async () => {
      console.log('[CHALLENGES] Loading initial pending challenges');

      try {
        // Load incoming challenges (where I'm being challenged)
        const incoming = await friendService.getPendingChallenges(userId);
        if (incoming.length > 0) {
          console.log('[CHALLENGES] Found incoming challenge:', incoming[0]);
          setIncomingChallenge(incoming[0]);  // Show first incoming challenge
        }

        // Load outgoing challenges (where I sent a challenge)
        const outgoing = await friendService.getOutgoingChallenges(userId);
        if (outgoing.length > 0) {
          console.log('[CHALLENGES] Found outgoing challenge:', outgoing[0]);
          setOutgoingChallenge(outgoing[0]);  // Show first outgoing challenge
        }
      } catch (error) {
        console.error('[CHALLENGES] Error loading initial challenges:', error);
      }
    };

    loadInitialChallenges();
  }, [userId, setIncomingChallenge, setOutgoingChallenge]);
}
