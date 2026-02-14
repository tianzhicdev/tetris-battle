import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFriendStore } from '../stores/friendStore';
import { audioManager } from '../services/audioManager';
import { glassSuccess, glassDanger, mergeGlass } from '../styles/glassUtils';

interface ChallengeNotificationProps {
  onAccept: (challengeId: string) => void;
  onDecline: (challengeId: string) => void;
}

export function ChallengeNotification({ onAccept, onDecline }: ChallengeNotificationProps) {
  const incomingChallenge = useFriendStore(state => state.incomingChallenge);
  const [timeLeft, setTimeLeft] = useState(120);

  useEffect(() => {
    if (!incomingChallenge) {
      setTimeLeft(120);
      return;
    }

    const remaining = Math.max(0, Math.floor((incomingChallenge.expiresAt - Date.now()) / 1000));
    setTimeLeft(remaining);

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          onDecline(incomingChallenge.challengeId);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingChallenge, onDecline]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {incomingChallenge && (
        <motion.div
          initial={{ y: -200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -200, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            width: 'min(400px, calc(100% - 40px))',
          }}
        >
          <div style={{
            background: 'rgba(10, 10, 30, 0.95)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(201, 66, 255, 0.4)',
            borderRadius: '16px',
            boxShadow: '0 8px 40px rgba(201, 66, 255, 0.3), 0 0 60px rgba(201, 66, 255, 0.1)',
            padding: 'clamp(16px, 4vw, 24px)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '12px',
              color: '#c942ff',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: '8px',
              textShadow: '0 0 10px rgba(201, 66, 255, 0.5)',
            }}>
              Challenge Received
            </div>

            <div style={{
              fontSize: 'clamp(18px, 5vw, 22px)',
              color: '#fff',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              marginBottom: '4px',
            }}>
              {incomingChallenge.challengerUsername}
            </div>

            <div style={{
              fontSize: '12px',
              color: '#888',
              fontFamily: 'monospace',
              marginBottom: '16px',
            }}>
              Lv {incomingChallenge.challengerLevel} · Rank {incomingChallenge.challengerRank}
            </div>

            {/* Countdown */}
            <div style={{
              fontSize: '14px',
              color: timeLeft <= 30 ? '#ff006e' : '#ffd700',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              marginBottom: '16px',
              textShadow: timeLeft <= 30 ? '0 0 10px rgba(255, 0, 110, 0.5)' : '0 0 10px rgba(255, 215, 0, 0.5)',
            }}>
              {formatTime(timeLeft)}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  audioManager.playSfx('button_click');
                  onAccept(incomingChallenge.challengeId);
                }}
                style={mergeGlass(glassSuccess(), {
                  padding: '10px 28px',
                  fontSize: '14px',
                  color: '#00ff88',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
                  transition: 'all 0.2s ease',
                })}
              >
                Accept
              </button>
              <button
                onClick={() => {
                  audioManager.playSfx('button_click');
                  onDecline(incomingChallenge.challengeId);
                }}
                style={mergeGlass(glassDanger(), {
                  padding: '10px 28px',
                  fontSize: '14px',
                  color: '#ff006e',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                })}
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
