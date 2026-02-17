import { useState, useEffect } from 'react';
import { progressionService } from '../lib/supabase';
import { mergeGlass, glassBlue, glassGold } from '../styles/glassUtils';

interface LeaderboardEntry {
  userId: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
}

interface LeaderboardProps {
  currentUserId: string;
  onClose: () => void;
}

export function Leaderboard({ currentUserId, onClose }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    progressionService.getLeaderboard(50).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const rankColor = (i: number) =>
    i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#aaa';
  const rankLabel = (i: number) =>
    i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={mergeGlass(glassBlue(), {
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          borderRadius: '16px',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        })}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
        }}>
          <div>
            <h2 style={{ color: '#00d4ff', fontFamily: 'monospace', margin: 0, fontSize: '1.3rem', letterSpacing: '2px' }}>
              LEADERBOARD
            </h2>
            <p style={{ color: '#666', fontFamily: 'monospace', margin: '2px 0 0', fontSize: '11px' }}>
              Top players by rating
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#aaa',
              cursor: 'pointer',
              borderRadius: '6px',
              padding: '6px 12px',
              fontFamily: 'monospace',
              fontSize: '16px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          >
            ✕
          </button>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '48px 1fr 60px 56px',
          gap: '8px',
          padding: '8px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#444', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '1px' }}>RANK</span>
          <span style={{ color: '#444', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '1px' }}>PLAYER</span>
          <span style={{ color: '#444', fontFamily: 'monospace', fontSize: '10px', textAlign: 'right', letterSpacing: '1px' }}>RATING</span>
          <span style={{ color: '#444', fontFamily: 'monospace', fontSize: '10px', textAlign: 'right', letterSpacing: '1px' }}>WIN%</span>
        </div>

        {/* Entries */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 16px 16px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px' }}>
              <p style={{ color: '#555', fontFamily: 'monospace', fontSize: '13px' }}>Loading...</p>
            </div>
          ) : entries.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px' }}>
              <p style={{ color: '#555', fontFamily: 'monospace', fontSize: '13px' }}>No matches played yet</p>
            </div>
          ) : (
            entries.map((entry, i) => {
              const isMe = entry.userId === currentUserId;
              const total = entry.wins + entry.losses;
              const winPct = total > 0 ? Math.round((entry.wins / total) * 100) : 0;

              return (
                <div
                  key={entry.userId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 60px 56px',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '8px',
                    marginBottom: '3px',
                    borderRadius: '8px',
                    background: isMe
                      ? 'rgba(0, 212, 255, 0.12)'
                      : i < 3
                      ? 'rgba(255, 215, 0, 0.04)'
                      : 'rgba(255,255,255,0.02)',
                    border: isMe
                      ? '1px solid rgba(0, 212, 255, 0.35)'
                      : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span style={{
                    color: rankColor(i),
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    fontSize: i < 3 ? '16px' : '12px',
                  }}>
                    {rankLabel(i)}
                  </span>
                  <span style={{
                    color: isMe ? '#00d4ff' : '#e0e0e0',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: isMe ? 'bold' : 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.username}
                    {isMe && <span style={{ color: '#555', fontSize: '11px' }}> (you)</span>}
                  </span>
                  <span style={mergeGlass(glassGold({ opacity: 0.4 }), {
                    color: '#ffd700',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    textAlign: 'right' as const,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                  })}>
                    {entry.rating}
                  </span>
                  <span style={{
                    color: winPct >= 60 ? '#00ff88' : winPct >= 40 ? '#aaa' : '#ff006e',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    textAlign: 'right',
                  }}>
                    {winPct}%
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
