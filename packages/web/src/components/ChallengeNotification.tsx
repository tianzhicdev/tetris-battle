import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFriendStore } from '../stores/friendStore';
import { audioManager } from '../services/audioManager';

interface ChallengeNotificationProps {
  userId: string;
  onNavigate: (path: string, options?: any) => void;
}

/**
 * Component to display incoming friend challenge notifications.
 * Appears at the top center of the screen with accept/decline buttons.
 * Includes a countdown timer showing time until expiry.
 */
export function ChallengeNotification({ userId, onNavigate }: ChallengeNotificationProps) {
  const incomingChallenge = useFriendStore(state => state.incomingChallenge);
  const acceptChallenge = useFriendStore(state => state.acceptChallenge);
  const declineChallenge = useFriendStore(state => state.declineChallenge);
  const pendingAccept = useFriendStore(state => state.pendingChallengeAccept);

  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
    if (!incomingChallenge) {
      setTimeLeft(120);
      return;
    }

    const remaining = Math.max(0, Math.floor(
      (new Date(incomingChallenge.expiresAt).getTime() - Date.now()) / 1000
    ));
    setTimeLeft(remaining);

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-decline when timer expires
          if (incomingChallenge) {
            declineChallenge(incomingChallenge.id, userId);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingChallenge, userId, declineChallenge]);

  const handleAccept = async () => {
    if (!incomingChallenge || !userId || pendingAccept) return;

    audioManager.playSfx('button_click');

    try {
      await acceptChallenge(incomingChallenge.id, userId, onNavigate);
    } catch (error) {
      console.error('[CHALLENGE_NOTIFICATION] Accept failed:', error);
      alert('Failed to accept challenge. Please try again.');
    }
  };

  const handleDecline = async () => {
    if (!incomingChallenge || !userId) return;

    audioManager.playSfx('button_click');
    await declineChallenge(incomingChallenge.id, userId);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {incomingChallenge && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            top: 20,
            left: 0,
            right: 0,
            zIndex: 10000,
            padding: '0 20px',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            background: 'rgba(10, 10, 30, 0.95)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            padding: 'clamp(16px, 4vw, 24px)',
            width: 'min(400px, 100%)',
            pointerEvents: 'auto',
          }}>
            <div style={{
              fontSize: 'clamp(18px, 5vw, 24px)',
              color: '#fff',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              marginBottom: '8px',
              textAlign: 'center',
            }}>
              Challenge from {incomingChallenge.challengerUsername}!
            </div>

            <div style={{
              fontSize: '14px',
              color: '#888',
              fontFamily: 'monospace',
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              Expires in{' '}
              <span style={{
                color: timeLeft <= 30 ? '#ff006e' : '#ffd700',
                fontWeight: 'bold',
              }}>
                {formatTime(timeLeft)}
              </span>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
            }}>
              <button
                onClick={handleAccept}
                disabled={pendingAccept}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  color: '#00ff88',
                  background: 'rgba(0, 255, 136, 0.1)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  borderRadius: '8px',
                  cursor: pendingAccept ? 'wait' : 'pointer',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  opacity: pendingAccept ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(0, 255, 136, 0.2)',
                }}
                onMouseEnter={(e) => {
                  if (!pendingAccept) {
                    e.currentTarget.style.background = 'rgba(0, 255, 136, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.3)';
                }}
              >
                {pendingAccept ? 'Accepting...' : 'Accept'}
              </button>

              <button
                onClick={handleDecline}
                disabled={pendingAccept}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  color: '#ff006e',
                  background: 'rgba(255, 0, 110, 0.1)',
                  border: '1px solid rgba(255, 0, 110, 0.3)',
                  borderRadius: '8px',
                  cursor: pendingAccept ? 'wait' : 'pointer',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  opacity: pendingAccept ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(255, 0, 110, 0.2)',
                }}
                onMouseEnter={(e) => {
                  if (!pendingAccept) {
                    e.currentTarget.style.background = 'rgba(255, 0, 110, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 0, 110, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 110, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 110, 0.3)';
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
