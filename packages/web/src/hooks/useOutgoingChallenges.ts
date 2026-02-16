import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFriendStore } from '../stores/friendStore';

/**
 * Hook to subscribe to outgoing friend challenges via Supabase Realtime.
 * Listens for UPDATE events when challenge status changes:
 * - 'accepted' → Game will start (handled by App.tsx)
 * - 'declined' → Clear outgoing challenge
 * - 'expired' → Clear outgoing challenge
 * - 'cancelled' → Clear outgoing challenge
 *
 * @param userId - The current user's ID (as challenger)
 */
export function useOutgoingChallenges(userId: string) {
  const setOutgoingChallenge = useFriendStore(s => s.setOutgoingChallenge);
  const clearChallenges = useFriendStore(s => s.clearChallenges);

  useEffect(() => {
    if (!userId) return;

    console.log('[CHALLENGES] Setting up outgoing challenge subscription for:', userId);

    const subscription = supabase
      .channel(`outgoing_challenges_${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_challenges',
        filter: `challengerId=eq.${userId}`,
      }, (payload) => {
        console.log('[CHALLENGES] Outgoing challenge updated:', payload);
        const challenge = payload.new as any;

        if (challenge.status === 'accepted' && challenge.roomId) {
          // Challenge accepted! Game will start
          // Navigation is handled by App.tsx which also subscribes to this
          console.log('[CHALLENGES] Challenge accepted, roomId:', challenge.roomId);
          clearChallenges();
        } else if (challenge.status === 'declined') {
          console.log('[CHALLENGES] Challenge declined');
          setOutgoingChallenge(null);
          // TODO: Show notification "Challenge declined"
        } else if (challenge.status === 'expired') {
          console.log('[CHALLENGES] Challenge expired');
          setOutgoingChallenge(null);
          // TODO: Show notification "Challenge expired"
        } else if (challenge.status === 'cancelled') {
          console.log('[CHALLENGES] Challenge cancelled');
          setOutgoingChallenge(null);
        }
      })
      .subscribe((status) => {
        console.log('[CHALLENGES] Outgoing subscription status:', status);
      });

    return () => {
      console.log('[CHALLENGES] Unsubscribing from outgoing challenges');
      subscription.unsubscribe();
    };
  }, [userId, setOutgoingChallenge, clearChallenges]);
}
