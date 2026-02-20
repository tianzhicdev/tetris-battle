import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFriendStore } from '../stores/friendStore';
import { audioManager } from '../services/audioManager';
import { T } from '../design-tokens';

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
            background: T.bg.panel,
            backdropFilter: 'blur(30px)',
            border: `1px solid ${T.accent.cyan}4d`,
            borderRadius: `${T.radius.lg}px`,
            boxShadow: `${T.glow(T.accent.cyan, 0.8)}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
            padding: 'clamp(16px, 4vw, 24px)',
            width: 'min(400px, 100%)',
            pointerEvents: 'auto',
          }}>
            <div style={{
              fontSize: 'clamp(18px, 5vw, 24px)',
              color: T.text.primary,
              fontFamily: T.font.display,
              fontWeight: 700,
              letterSpacing: '1px',
              marginBottom: '8px',
              textAlign: 'center',
            }}>
              Challenge from {incomingChallenge.challengerUsername}!
            </div>

            <div style={{
              fontSize: '14px',
              color: T.text.secondary,
              fontFamily: T.font.mono,
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              Expires in{' '}
              <span style={{
                color: timeLeft <= 30 ? T.accent.pink : T.accent.yellow,
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
                  color: T.accent.green,
                  background: `${T.accent.green}1a`,
                  border: `1px solid ${T.accent.green}4d`,
                  borderRadius: `${T.radius.md}px`,
                  cursor: pendingAccept ? 'wait' : 'pointer',
                  fontFamily: T.font.display,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  opacity: pendingAccept ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)',
                  boxShadow: T.glow(T.accent.green, 0.4),
                  textShadow: T.glow(T.accent.green, 0.8),
                }}
                onMouseEnter={(e) => {
                  if (!pendingAccept) {
                    e.currentTarget.style.background = `${T.accent.green}33`;
                    e.currentTarget.style.borderColor = `${T.accent.green}80`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${T.accent.green}1a`;
                  e.currentTarget.style.borderColor = `${T.accent.green}4d`;
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
                  color: T.accent.pink,
                  background: `${T.accent.pink}1a`,
                  border: `1px solid ${T.accent.pink}4d`,
                  borderRadius: `${T.radius.md}px`,
                  cursor: pendingAccept ? 'wait' : 'pointer',
                  fontFamily: T.font.display,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  opacity: pendingAccept ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)',
                  boxShadow: T.glow(T.accent.pink, 0.4),
                  textShadow: T.glow(T.accent.pink, 0.8),
                }}
                onMouseEnter={(e) => {
                  if (!pendingAccept) {
                    e.currentTarget.style.background = `${T.accent.pink}33`;
                    e.currentTarget.style.borderColor = `${T.accent.pink}80`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${T.accent.pink}1a`;
                  e.currentTarget.style.borderColor = `${T.accent.pink}4d`;
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
