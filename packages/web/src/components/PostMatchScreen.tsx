import { useState, useEffect } from 'react';
import type { MatchRewards } from '../lib/rewards';

interface PostMatchScreenProps {
  outcome: 'win' | 'loss' | 'draw';
  rewards: MatchRewards;
  onContinue: () => void;
}

export function PostMatchScreen({ outcome, rewards, onContinue }: PostMatchScreenProps) {
  const [showRewards, setShowRewards] = useState(false);

  useEffect(() => {
    // Animate rewards showing
    const timer = setTimeout(() => setShowRewards(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const outcomeColor = outcome === 'win' ? '#00ff00' : outcome === 'loss' ? '#ff0000' : '#ffff00';
  const outcomeText = outcome === 'win' ? 'VICTORY' : outcome === 'loss' ? 'DEFEAT' : 'DRAW';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: 'monospace',
    }}>
      <div style={{
        background: '#1a1a1a',
        border: `3px solid ${outcomeColor}`,
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '600px',
        width: '90%',
      }}>
        {/* Outcome Header */}
        <h1 style={{
          margin: '0 0 30px 0',
          fontSize: '48px',
          color: outcomeColor,
          textAlign: 'center',
          textShadow: `0 0 20px ${outcomeColor}`,
        }}>
          {outcomeText}
        </h1>

        {/* Level Up Banner */}
        {rewards.leveledUp && (
          <div style={{
            background: 'linear-gradient(90deg, #ff00ff, #00ffff)',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '30px',
            textAlign: 'center',
            animation: 'pulse 1s infinite',
          }}>
            <div style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#000',
            }}>
              LEVEL UP! → {rewards.newLevel}
            </div>
          </div>
        )}

        {/* Rewards Breakdown */}
        {showRewards && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{
              color: '#00ff00',
              marginBottom: '20px',
              fontSize: '24px',
            }}>
              Rewards Earned
            </h2>

            {/* Coins */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{
                fontSize: '20px',
                color: '#ffaa00',
                marginBottom: '10px',
              }}>
                🪙 +{rewards.coins} Coins
              </div>

              <div style={{
                fontSize: '14px',
                color: '#888',
                paddingLeft: '20px',
              }}>
                {rewards.breakdown.baseCoins > 0 && (
                  <div>Base reward: +{rewards.breakdown.baseCoins}</div>
                )}
                {rewards.breakdown.performanceBonus > 0 && (
                  <div>Performance bonus: +{rewards.breakdown.performanceBonus}</div>
                )}
                {rewards.breakdown.streakBonus > 0 && (
                  <div>Win streak bonus: +{rewards.breakdown.streakBonus}</div>
                )}
                {rewards.breakdown.firstWinBonus > 0 && (
                  <div>First win of day: +{rewards.breakdown.firstWinBonus}</div>
                )}
              </div>
            </div>

            {/* XP */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '20px',
                color: '#00ffff',
                marginBottom: '10px',
              }}>
                ⭐ +{rewards.xp} XP
              </div>

              <div style={{
                fontSize: '14px',
                color: '#888',
                paddingLeft: '20px',
              }}>
                {rewards.breakdown.baseXp > 0 && (
                  <div>Match complete: +{rewards.breakdown.baseXp}</div>
                )}
                {rewards.breakdown.winBonus > 0 && (
                  <div>Victory bonus: +{rewards.breakdown.winBonus}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={onContinue}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '20px',
            background: outcomeColor,
            color: outcome === 'draw' ? '#000' : '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}
        >
          Continue
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
