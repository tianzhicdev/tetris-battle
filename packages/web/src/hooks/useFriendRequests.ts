import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFriendStore } from '../stores/friendStore';
import { audioManager } from '../services/audioManager';

/**
 * Hook to subscribe to real-time friend request notifications
 */
export function useFriendRequests(userId: string) {
  useEffect(() => {
    if (!userId) return;

    console.log('[FRIEND_REQUESTS] Setting up subscription for:', userId);

    // Subscribe to new friend requests where user is the addressee
    const subscription = supabase
      .channel(`friend_requests_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${userId}`,
      }, (payload) => {
        console.log('[FRIEND_REQUESTS] New request received:', payload);
        const friendship = payload.new as any;

        // Only notify for pending requests
        if (friendship.status === 'pending') {
          // Reload pending requests to get the new one with user details
          useFriendStore.getState().loadPendingRequests(userId);
          audioManager.playSfx('match_found');
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friendships',
        filter: `requester_id=eq.${userId}`,
      }, (payload) => {
        console.log('[FRIEND_REQUESTS] Request status updated:', payload);
        const friendship = payload.new as any;

        // If my outgoing request was accepted, reload friends list
        if (friendship.status === 'accepted') {
          useFriendStore.getState().loadFriends(userId);
          useFriendStore.getState().loadPendingRequests(userId);
          audioManager.playSfx('match_found');
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'friendships',
      }, (payload) => {
        console.log('[FRIEND_REQUESTS] Friendship deleted:', payload);
        // Reload both friends and requests
        useFriendStore.getState().loadFriends(userId);
        useFriendStore.getState().loadPendingRequests(userId);
      })
      .subscribe();

    return () => {
      console.log('[FRIEND_REQUESTS] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [userId]);
}
