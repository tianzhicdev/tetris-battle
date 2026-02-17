import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFriendStore } from '../stores/friendStore';
import type { Challenge } from '../services/friendService';
import { audioManager } from '../services/audioManager';

/**
 * Hook to subscribe to incoming friend challenges via Supabase Realtime.
 * Listens for:
 * - INSERT events when a new challenge is sent to this user
 * - UPDATE events when challenge status changes (accepted, declined, expired, cancelled)
 *
 * @param userId - The current user's ID
 */
export function useIncomingChallenges(userId: string) {
  const setIncomingChallenge = useFriendStore(s => s.setIncomingChallenge);

  useEffect(() => {
    if (!userId) return;

    console.log('[CHALLENGES] Setting up incoming challenge subscription for:', userId);

    const subscription = supabase
      .channel(`incoming_challenges_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'friend_challenges',
        filter: `challenged_id=eq.${userId}`,
      }, async (payload) => {
        console.log('[CHALLENGES] Received INSERT:', payload);
        const challenge = payload.new as any;

        // Ignore if already expired
        if (new Date(challenge.expires_at) < new Date()) {
          console.log('[CHALLENGES] Challenge already expired, ignoring');
          return;
        }

        // Fetch challenger profile for username
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', challenge.challenger_id)
          .single();

        const fullChallenge: Challenge = {
          id: challenge.id,
          challengerId: challenge.challenger_id,
          challengedId: challenge.challenged_id,
          challengerUsername: profile?.username || 'Unknown',
          status: challenge.status as 'pending',
          expiresAt: challenge.expires_at,
          createdAt: challenge.created_at,
        };

        setIncomingChallenge(fullChallenge);

        // Play sound effect for new challenge
        try {
          audioManager.playSfx('match_found');
        } catch (error) {
          console.warn('[CHALLENGES] Failed to play sound effect:', error);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_challenges',
        filter: `challenged_id=eq.${userId}`,
      }, (payload) => {
        console.log('[CHALLENGES] Received UPDATE:', payload);
        const challenge = payload.new as any;

        // Clear if no longer pending (accepted, declined, expired, cancelled)
        if (challenge.status !== 'pending') {
          console.log('[CHALLENGES] Challenge no longer pending, clearing:', challenge.status);
          setIncomingChallenge(null);
        }
      })
      .subscribe((status) => {
        console.log('[CHALLENGES] Subscription status:', status);
      });

    return () => {
      console.log('[CHALLENGES] Unsubscribing from incoming challenges');
      subscription.unsubscribe();
    };
  }, [userId, setIncomingChallenge]);
}
