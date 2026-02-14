import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFriendStore } from '../stores/friendStore';
import { audioManager } from '../services/audioManager';
import { glassDanger, mergeGlass } from '../styles/glassUtils';

interface ChallengeWaitingProps {
  onCancel: (challengeId: string) => void;
}

export function ChallengeWaiting({ onCancel }: ChallengeWaitingProps) {
  const outgoingChallenge = useFriendStore(state => state.outgoingChallenge);
  const [timeLeft, setTimeLeft] = useState(120);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!outgoingChallenge) {
      setTimeLeft(120);
      return;
    }

    const remaining = Math.max(0, Math.floor((outgoingChallenge.expiresAt - Date.now()) / 1000));
    setTimeLeft(remaining);

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [outgoingChallenge]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {outgoingChallenge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
            padding: '20px',
          }}
        >
          <div style={{
            background: 'rgba(10, 10, 30, 0.95)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            padding: 'clamp(24px, 6vw, 40px)',
            textAlign: 'center',
            maxWidth: '400px',
            width: '100%',
          }}>
            {/* Spinner */}
            <div
              style={{
                width: '60px',
                height: '60px',
                margin: '0 auto 20px',
                border: '4px solid rgba(255, 255, 255, 0.1)',
                borderTop: '4px solid #c942ff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <style>
              {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
            </style>

            <div style={{
              fontSize: 'clamp(16px, 4vw, 20px)',
              color: '#fff',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              marginBottom: '8px',
            }}>
              Waiting for {outgoingChallenge.challengerUsername}{dots}
            </div>

            <div style={{
              fontSize: '14px',
              color: '#888',
              fontFamily: 'monospace',
              marginBottom: '20px',
            }}>
              Challenge will expire in{' '}
              <span style={{
                color: timeLeft <= 30 ? '#ff006e' : '#ffd700',
                fontWeight: 'bold',
              }}>
                {formatTime(timeLeft)}
              </span>
            </div>

            <button
              onClick={() => {
                audioManager.playSfx('button_click');
                onCancel(outgoingChallenge.challengeId);
              }}
              style={mergeGlass(glassDanger(), {
                padding: '10px 30px',
                fontSize: '14px',
                color: '#ff006e',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              })}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
