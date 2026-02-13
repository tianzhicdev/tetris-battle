import { useState, useEffect } from 'react';
import { getLevelStage, getXpForNextLevel, LEVEL_THRESHOLDS } from '@tetris-battle/game-core';
import type { UserProfile, MatchResult } from '@tetris-battle/game-core';
import { progressionService } from '../lib/supabase';

interface ProfilePageProps {
  profile: UserProfile;
  onClose: () => void;
}

export function ProfilePage({ profile, onClose }: ProfilePageProps) {
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>([]);
  const [winStreak, setWinStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [profile.userId]);

  const loadStats = async () => {
    setLoading(true);

    const [history, streak] = await Promise.all([
      progressionService.getMatchHistory(profile.userId, 10),
      progressionService.getWinStreak(profile.userId),
    ]);

    setMatchHistory(history);
    setWinStreak(streak);
    setLoading(false);
  };

  const stage = getLevelStage(profile.level);
  const xpForNext = getXpForNextLevel(profile.level);
  const currentLevelThreshold = LEVEL_THRESHOLDS.find(l => l.level === profile.level);
  const nextLevelThreshold = LEVEL_THRESHOLDS.find(l => l.level === profile.level + 1);
  const xpInCurrentLevel = currentLevelThreshold ? profile.xp - currentLevelThreshold.xpRequired : 0;
  const xpProgress = xpForNext > 0 ? (xpInCurrentLevel / xpForNext) * 100 : 100;

  const wins = matchHistory.filter(m => m.outcome === 'win').length;
  const losses = matchHistory.filter(m => m.outcome === 'loss').length;

  const stageColors: Record<string, string> = {
    rookie: '#999',
    contender: '#00ff00',
    challenger: '#00ffff',
    veteran: '#ff00ff',
    master: '#ffaa00',
    legend: '#ff0000',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: 'monospace',
      padding: '10px',
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '3px solid #00ff00',
        borderRadius: '12px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #00ff00',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: '#00ff00', fontSize: '28px' }}>
              {profile.username}
            </h2>
            <div style={{
              color: stageColors[stage],
              fontSize: '16px',
              textTransform: 'uppercase',
            }}>
              {stage} • Level {profile.level}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#ff0000',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}>
          {/* Stats Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div style={{
              background: '#2a2a2a',
              border: '2px solid #ffaa00',
              borderRadius: '8px',
              padding: '15px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#ffaa00', fontSize: '32px', marginBottom: '5px' }}>
                {profile.coins}
              </div>
              <div style={{ color: '#aaa', fontSize: '12px' }}>
                Coins
              </div>
            </div>

            <div style={{
              background: '#2a2a2a',
              border: '2px solid #00ffff',
              borderRadius: '8px',
              padding: '15px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#00ffff', fontSize: '32px', marginBottom: '5px' }}>
                {profile.xp}
              </div>
              <div style={{ color: '#aaa', fontSize: '12px' }}>
                Total XP
              </div>
            </div>

            <div style={{
              background: '#2a2a2a',
              border: '2px solid #00ff00',
              borderRadius: '8px',
              padding: '15px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#00ff00', fontSize: '32px', marginBottom: '5px' }}>
                {wins}-{losses}
              </div>
              <div style={{ color: '#aaa', fontSize: '12px' }}>
                Win/Loss
              </div>
            </div>

            <div style={{
              background: '#2a2a2a',
              border: '2px solid #ff00ff',
              borderRadius: '8px',
              padding: '15px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#ff00ff', fontSize: '32px', marginBottom: '5px' }}>
                {winStreak}
              </div>
              <div style={{ color: '#aaa', fontSize: '12px' }}>
                Win Streak
              </div>
            </div>
          </div>

          {/* XP Progress Bar */}
          {nextLevelThreshold && (
            <div style={{ marginBottom: '25px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                color: '#00ffff',
                fontSize: '14px',
              }}>
                <span>Level {profile.level}</span>
                <span>{xpInCurrentLevel}/{xpForNext} XP</span>
                <span>Level {profile.level + 1}</span>
              </div>

              <div style={{
                background: '#333',
                height: '20px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '2px solid #00ffff',
              }}>
                <div style={{
                  background: 'linear-gradient(90deg, #00ffff, #00ff00)',
                  height: '100%',
                  width: `${xpProgress}%`,
                  transition: 'width 0.3s',
                }}/>
              </div>
            </div>
          )}

          {/* Match History */}
          <div>
            <h3 style={{ color: '#00ff00', marginBottom: '15px', fontSize: '20px' }}>
              Recent Matches
            </h3>

            {loading ? (
              <div style={{ color: '#aaa', textAlign: 'center', padding: '20px' }}>
                Loading...
              </div>
            ) : matchHistory.length === 0 ? (
              <div style={{ color: '#aaa', textAlign: 'center', padding: '20px' }}>
                No matches played yet
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                {matchHistory.map(match => {
                  const outcomeColor = match.outcome === 'win' ? '#00ff00' : match.outcome === 'loss' ? '#ff0000' : '#ffaa00';
                  const date = new Date(match.timestamp).toLocaleDateString();

                  return (
                    <div
                      key={match.id}
                      style={{
                        background: '#2a2a2a',
                        border: `2px solid ${outcomeColor}`,
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{
                          color: outcomeColor,
                          fontSize: '16px',
                          fontWeight: 'bold',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                        }}>
                          {match.outcome}
                        </div>
                        <div style={{ color: '#aaa', fontSize: '12px' }}>
                          {date}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#aaa', fontSize: '12px' }}>
                          {match.linesCleared} lines • {match.abilitiesUsed} abilities
                        </div>
                        <div style={{ color: '#ffaa00', fontSize: '14px', marginTop: '4px' }}>
                          +{match.coinsEarned} 🪙 | +{match.xpEarned} XP
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
