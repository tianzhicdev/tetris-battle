import { useState, useEffect } from 'react';
import type { MatchRewards } from '../lib/rewards';
import { T } from '../design-tokens';

interface PostMatchScreenProps {
  outcome: 'win' | 'loss';
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

  const outcomeColor = outcome === 'win' ? T.accent.green : T.accent.red;
  const outcomeText = outcome === 'win' ? 'VICTORY' : 'DEFEAT';

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

        {/* Rewards Breakdown */}
        {showRewards && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{
              color: T.accent.green,
              marginBottom: '20px',
              fontSize: '24px',
            }}>
              Rewards Earned
            </h2>

            {/* Coins */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{
                fontSize: '20px',
                color: T.accent.yellow,
                marginBottom: '10px',
              }}>
                💰 +{rewards.coins} Coins
              </div>

              <div style={{
                fontSize: '14px',
                color: T.text.secondary,
                paddingLeft: '20px',
              }}>
                <div>Base reward: +{rewards.breakdown.baseCoins}</div>
                {rewards.breakdown.firstWinBonus > 0 && (
                  <div>First win of day: +{rewards.breakdown.firstWinBonus}</div>
                )}
                {rewards.breakdown.streakBonus > 0 && (
                  <div>Win streak bonus: +{rewards.breakdown.streakBonus}</div>
                )}
              </div>

              <div style={{
                fontSize: '18px',
                color: T.accent.yellow,
                marginTop: '15px',
                fontWeight: 'bold',
              }}>
                Total Balance: {rewards.newCoins} 💰
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
            color: '#000',
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
