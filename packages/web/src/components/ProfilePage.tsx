import { useState, useEffect } from 'react';
import { getLevelStage, getXpForNextLevel, LEVEL_THRESHOLDS, getRankTier, isInPlacement } from '@tetris-battle/game-core';
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
  const [opponentProfiles, setOpponentProfiles] = useState<Record<string, UserProfile>>({});

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

    // Load opponent profiles
    const opponentIds = [...new Set(history.map(m => m.opponentId))];
    const profiles: Record<string, UserProfile> = {};
    await Promise.all(
      opponentIds.map(async (id) => {
        const p = await progressionService.getUserProfile(id);
        if (p) profiles[id] = p;
      })
    );
    setOpponentProfiles(profiles);

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
      background: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: 'clamp(10px, 2vw, 20px)',
    }}>
      <div style={{
        background: 'rgba(10, 10, 30, 0.95)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(0, 255, 136, 0.3)',
        borderRadius: 'clamp(12px, 3vw, 16px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        maxWidth: 'min(800px, 100%)',
        width: '100%',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: 'clamp(15px, 4vw, 20px)',
          borderBottom: '1px solid rgba(0, 255, 136, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'clamp(10px, 2.5vw, 15px)',
          flexWrap: 'wrap',
        }}>
          <div>
            <h2 style={{ margin: '0 0 clamp(4px, 1vw, 5px) 0', color: '#00ff88', fontSize: 'clamp(22px, 5.5vw, 28px)', fontWeight: '700', textShadow: '0 0 15px rgba(0, 255, 136, 0.6)' }}>
              {profile.username}
            </h2>
            <div style={{
              color: stageColors[stage],
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              textTransform: 'uppercase',
              fontWeight: '600',
              textShadow: `0 0 10px ${stageColors[stage]}80`,
            }}>
              {stage} • Level {profile.level}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
              borderRadius: 'clamp(5px, 1.25vw, 6px)',
              cursor: 'pointer',
              fontSize: 'clamp(14px, 3.5vw, 16px)',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
            }}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'clamp(15px, 4vw, 20px)',
        }}>
          {/* Stats Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))',
            gap: 'clamp(10px, 2.5vw, 12px)',
            marginBottom: 'clamp(15px, 3.75vw, 20px)',
          }}>
            <div style={{
              background: 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 170, 0, 0.4)',
              borderRadius: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(255, 170, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ color: '#ffd700', fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '700', textShadow: '0 0 15px rgba(255, 215, 0, 0.5)' }}>
                {profile.coins}
              </div>
              <div style={{ color: '#aaa', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                Coins
              </div>
            </div>

            <div style={{
              background: 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              borderRadius: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ color: '#00d4ff', fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '700', textShadow: '0 0 15px rgba(0, 212, 255, 0.5)' }}>
                {profile.xp}
              </div>
              <div style={{ color: '#aaa', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                Total XP
              </div>
            </div>

            <div style={{
              background: 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 255, 136, 0.4)',
              borderRadius: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 255, 136, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ color: '#00ff88', fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '700', textShadow: '0 0 15px rgba(0, 255, 136, 0.5)' }}>
                {wins}-{losses}
              </div>
              <div style={{ color: '#aaa', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                Win/Loss
              </div>
            </div>

            <div style={{
              background: 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 0, 255, 0.4)',
              borderRadius: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(255, 0, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ color: '#ff00ff', fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '700', textShadow: '0 0 15px rgba(255, 0, 255, 0.5)' }}>
                {winStreak}
              </div>
              <div style={{ color: '#aaa', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                Win Streak
              </div>
            </div>

            <div style={{
              background: 'rgba(10, 10, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              borderRadius: 'clamp(6px, 1.5vw, 8px)',
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ color: '#00d4ff', fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '700', textShadow: '0 0 15px rgba(0, 212, 255, 0.5)' }}>
                {profile.rank}
              </div>
              <div style={{ color: '#aaa', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                Rank {isInPlacement(profile.gamesPlayed) && '(Placement)'}
              </div>
              <div style={{ color: '#00d4ff', fontSize: 'clamp(9px, 2.25vw, 10px)', textTransform: 'uppercase', marginTop: 'clamp(2px, 0.5vw, 3px)', fontWeight: '700', textShadow: '0 0 8px rgba(0, 212, 255, 0.4)' }}>
                {getRankTier(profile.rank)}
              </div>
            </div>
          </div>

          {/* XP Progress Bar */}
          {nextLevelThreshold && (
            <div style={{ marginBottom: 'clamp(20px, 5vw, 25px)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 'clamp(6px, 1.5vw, 8px)',
                color: '#00d4ff',
                fontSize: 'clamp(12px, 3vw, 14px)',
                fontWeight: '600',
              }}>
                <span>Level {profile.level}</span>
                <span>{xpInCurrentLevel}/{xpForNext} XP</span>
                <span>Level {profile.level + 1}</span>
              </div>

              <div style={{
                background: 'rgba(10, 10, 30, 0.5)',
                backdropFilter: 'blur(10px)',
                height: 'clamp(16px, 4vw, 20px)',
                borderRadius: 'clamp(8px, 2vw, 10px)',
                overflow: 'hidden',
                border: '1px solid rgba(0, 212, 255, 0.4)',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
              }}>
                <div style={{
                  background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
                  height: '100%',
                  width: `${xpProgress}%`,
                  transition: 'width 0.3s',
                  boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
                }}/>
              </div>
            </div>
          )}

          {/* Match History */}
          <div>
            <h3 style={{ color: '#00ff88', marginBottom: 'clamp(12px, 3vw, 15px)', fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: '700', textShadow: '0 0 15px rgba(0, 255, 136, 0.6)' }}>
              Recent Matches
            </h3>

            {loading ? (
              <div style={{ color: '#aaa', textAlign: 'center', padding: 'clamp(15px, 4vw, 20px)', fontSize: 'clamp(13px, 3.25vw, 14px)' }}>
                Loading...
              </div>
            ) : matchHistory.length === 0 ? (
              <div style={{ color: '#aaa', textAlign: 'center', padding: 'clamp(15px, 4vw, 20px)', fontSize: 'clamp(13px, 3.25vw, 14px)' }}>
                No matches played yet
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(8px, 2vw, 10px)',
              }}>
                {matchHistory.map(match => {
                  const outcomeColor = match.outcome === 'win' ? '#00ff88' : match.outcome === 'loss' ? '#ff6e6e' : '#ffaa00';
                  const date = new Date(match.timestamp).toLocaleDateString();
                  const opponent = opponentProfiles[match.opponentId];
                  const rankChangeColor = match.rankChange >= 0 ? '#00ff88' : '#ff006e';

                  return (
                    <div
                      key={match.id}
                      style={{
                        background: 'rgba(10, 10, 30, 0.6)',
                        backdropFilter: 'blur(20px)',
                        border: `1px solid ${outcomeColor}80`,
                        borderRadius: 'clamp(6px, 1.5vw, 8px)',
                        padding: 'clamp(10px, 2.5vw, 12px)',
                        boxShadow: `0 4px 15px ${outcomeColor}30, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'clamp(6px, 1.5vw, 8px)',
                        gap: 'clamp(10px, 2.5vw, 15px)',
                      }}>
                        <div>
                          <div style={{
                            color: outcomeColor,
                            fontSize: 'clamp(14px, 3.5vw, 16px)',
                            fontWeight: '700',
                            marginBottom: 'clamp(3px, 0.75vw, 4px)',
                            textTransform: 'uppercase',
                            textShadow: `0 0 10px ${outcomeColor}60`,
                          }}>
                            {match.outcome}
                          </div>
                          <div style={{ color: '#aaa', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                            vs {opponent ? opponent.username : 'Unknown'}
                          </div>
                          <div style={{ color: '#666', fontSize: 'clamp(10px, 2.5vw, 11px)', marginTop: 'clamp(1px, 0.25vw, 2px)', fontWeight: '600' }}>
                            {opponent ? `Lvl ${opponent.level} • ${match.opponentRank} Rank` : `${match.opponentRank} Rank`}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: rankChangeColor, fontSize: 'clamp(14px, 3.5vw, 16px)', fontWeight: '700', textShadow: `0 0 10px ${rankChangeColor}60` }}>
                            {match.rankChange >= 0 ? '+' : ''}{match.rankChange}
                          </div>
                          <div style={{ color: '#aaa', fontSize: 'clamp(10px, 2.5vw, 11px)', fontWeight: '600' }}>
                            → {match.rankAfter} Rank
                          </div>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: 'clamp(6px, 1.5vw, 8px)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        gap: 'clamp(10px, 2.5vw, 15px)',
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ color: '#aaa', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                          {match.linesCleared} lines • {match.abilitiesUsed} abilities
                        </div>
                        <div style={{ color: '#ffd700', fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600' }}>
                          +{match.coinsEarned} 🪙 | +{match.xpEarned} XP
                        </div>
                      </div>

                      <div style={{ color: '#666', fontSize: 'clamp(10px, 2.5vw, 11px)', marginTop: 'clamp(5px, 1.25vw, 6px)', fontWeight: '600' }}>
                        {date}
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
