import { useState, useEffect } from 'react';
import type { UserProfile, MatchResult } from '@tetris-battle/game-core';
import { progressionService } from '../lib/supabase';
import { T } from '../design-tokens';

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

  const wins = matchHistory.filter(m => m.outcome === 'win').length;
  const losses = matchHistory.filter(m => m.outcome === 'loss').length;
  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

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
      paddingTop: 'max(12px, env(safe-area-inset-top))',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      paddingLeft: 'clamp(10px, 2vw, 20px)',
      paddingRight: 'clamp(10px, 2vw, 20px)',
    }}>
      <div style={{
        background: T.bg.panel,
        backdropFilter: 'blur(30px)',
        border: `1px solid ${T.border.accent}`,
        borderRadius: 'clamp(12px, 3vw, 16px)',
        boxShadow: T.panelGlow,
        maxWidth: 'min(800px, 100%)',
        width: '100%',
        maxHeight: '95vh',
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: 'clamp(15px, 4vw, 20px)',
          borderBottom: `1px solid ${T.border.accent}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'clamp(10px, 2.5vw, 15px)',
          flexWrap: 'wrap',
        }}>
          <div>
            <h2 style={{ margin: '0', color: T.accent.cyan, fontSize: 'clamp(22px, 5.5vw, 28px)', fontWeight: '700', fontFamily: T.font.display, letterSpacing: '2px', textShadow: T.glow(T.accent.cyan, 1) }}>
              {profile.username}
            </h2>
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
          minHeight: 0,
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
              background: T.bg.card,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${T.accent.yellow}44`,
              borderRadius: `${T.radius.md}px`,
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: T.glow(T.accent.yellow, 0.5),
            }}>
              <div style={{ color: T.accent.yellow, fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '900', fontFamily: T.font.display, textShadow: T.glow(T.accent.yellow, 1) }}>
                {profile.coins}
              </div>
              <div style={{ color: T.text.secondary, fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600', letterSpacing: '1px' }}>
                COINS
              </div>
            </div>

            <div style={{
              background: T.bg.card,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${T.accent.cyan}44`,
              borderRadius: `${T.radius.md}px`,
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: T.glow(T.accent.cyan, 0.5),
            }}>
              <div style={{ color: T.accent.cyan, fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '900', fontFamily: T.font.display, textShadow: T.glow(T.accent.cyan, 1) }}>
                {totalGames}
              </div>
              <div style={{ color: T.text.secondary, fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600', letterSpacing: '1px' }}>
                GAMES
              </div>
            </div>

            <div style={{
              background: T.bg.card,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${T.accent.green}44`,
              borderRadius: `${T.radius.md}px`,
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: T.glow(T.accent.green, 0.5),
            }}>
              <div style={{ color: T.accent.green, fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '900', fontFamily: T.font.display, textShadow: T.glow(T.accent.green, 1) }}>
                {wins}-{losses}
              </div>
              <div style={{ color: T.text.secondary, fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600', letterSpacing: '1px' }}>
                W/L
              </div>
            </div>

            <div style={{
              background: T.bg.card,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${T.accent.pink}44`,
              borderRadius: `${T.radius.md}px`,
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: T.glow(T.accent.pink, 0.5),
            }}>
              <div style={{ color: T.accent.pink, fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '900', fontFamily: T.font.display, textShadow: T.glow(T.accent.pink, 1) }}>
                {winStreak}
              </div>
              <div style={{ color: T.text.secondary, fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600', letterSpacing: '1px' }}>
                STREAK
              </div>
            </div>

            <div style={{
              background: T.bg.card,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${T.accent.purple}44`,
              borderRadius: `${T.radius.md}px`,
              padding: 'clamp(12px, 3vw, 15px)',
              textAlign: 'center',
              boxShadow: T.glow(T.accent.purple, 0.5),
            }}>
              <div style={{ color: T.accent.purple, fontSize: 'clamp(26px, 6.5vw, 32px)', marginBottom: 'clamp(4px, 1vw, 5px)', fontWeight: '900', fontFamily: T.font.display, textShadow: T.glow(T.accent.purple, 1) }}>
                {winRate}%
              </div>
              <div style={{ color: T.text.secondary, fontSize: 'clamp(11px, 2.75vw, 12px)', fontWeight: '600', letterSpacing: '1px' }}>
                WIN RATE
              </div>
            </div>
          </div>

          {/* Match History */}
          <div>
            <h3 style={{ color: T.accent.cyan, marginBottom: 'clamp(12px, 3vw, 15px)', fontSize: 'clamp(16px, 4vw, 20px)', fontWeight: '700', fontFamily: T.font.display, letterSpacing: '2px', textShadow: T.glow(T.accent.cyan, 1) }}>
              RECENT MATCHES
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
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#ffd700', fontSize: 'clamp(14px, 3.5vw, 16px)', fontWeight: '700', textShadow: '0 0 10px rgba(255, 215, 0, 0.6)' }}>
                            +{match.coinsEarned} 🪙
                          </div>
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
