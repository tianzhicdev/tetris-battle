import { useState, useEffect } from 'react';
import type { MatchRewards } from '../lib/rewards';
import { T } from '../design-tokens';
import { PrimaryButton } from './ui/PrimaryButton';

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
      background: T.bg.overlay,
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: T.font.body,
    }}>
      <div style={{
        background: T.bg.panel,
        backdropFilter: 'blur(30px)',
        border: `3px solid ${outcomeColor}`,
        borderRadius: `${T.radius.xl}px`,
        boxShadow: T.panelGlow,
        padding: '40px',
        maxWidth: '600px',
        width: '90%',
      }}>
        {/* Outcome Header */}
        <h1 style={{
          margin: '0 0 30px 0',
          fontSize: '48px',
          fontWeight: 700,
          fontFamily: T.font.display,
          letterSpacing: '3px',
          color: outcomeColor,
          textAlign: 'center',
          textShadow: T.glow(outcomeColor, 1.5),
        }}>
          {outcomeText}
        </h1>

        {/* Rewards Breakdown */}
        {showRewards && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{
              color: T.accent.cyan,
              marginBottom: '20px',
              fontSize: '24px',
              fontWeight: 700,
              fontFamily: T.font.display,
              letterSpacing: '2px',
              textShadow: T.glow(T.accent.cyan, 1),
            }}>
              REWARDS EARNED
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
        <PrimaryButton onClick={onContinue} color={outcomeColor}>
          CONTINUE
        </PrimaryButton>
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
