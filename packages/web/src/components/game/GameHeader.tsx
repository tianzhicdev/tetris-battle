import type { ConnectionStats } from '../../services/ConnectionMonitor';

interface AbilityNotification {
  id: number;
  name: string;
  description: string;
  category: 'buff' | 'debuff';
}

interface GameHeaderProps {
  score: number;
  stars: number;
  linesCleared?: number;
  comboCount?: number;
  notifications: AbilityNotification[];
  isConnected: boolean;
  connectionStats: ConnectionStats | null;
}

function connectionColor(stats: ConnectionStats | null, isConnected: boolean): string {
  if (!isConnected) return '#ef4444';
  if (!stats) return '#fbbf24';
  if (stats.quality === 'excellent') return '#4ade80';
  if (stats.quality === 'good') return '#fbbf24';
  if (stats.quality === 'poor') return '#fb923c';
  return '#ef4444';
}

export function GameHeader({
  score,
  stars,
  linesCleared = 0,
  comboCount = 0,
  notifications: _notifications,
  isConnected,
  connectionStats,
}: GameHeaderProps) {
  const dot = connectionColor(connectionStats, isConnected);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: '32px',
        padding: '10px',
        position: 'relative',
      }}
    >
      {/* SCORE - Hero stat */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '8px', color: '#00f0f044', letterSpacing: '4px', marginBottom: '2px' }}>
          SCORE
        </div>
        <div
          style={{
            fontSize: '30px',
            fontWeight: 900,
            color: '#00f0f0',
            textShadow: '0 0 20px #00f0f066, 0 0 50px #00f0f022',
            lineHeight: 1,
            fontFamily: 'Orbitron',
          }}
        >
          {score.toLocaleString()}
        </div>
      </div>

      {/* STARS - Secondary stat */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '8px', color: '#b040f044', letterSpacing: '4px', marginBottom: '2px' }}>
          STARS
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#b040f0',
            textShadow: '0 0 12px #b040f044',
            lineHeight: 1,
            fontFamily: 'Orbitron',
          }}
        >
          {stars}
        </div>
      </div>

      {/* LINES - Secondary stat */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '8px', color: '#f0a02044', letterSpacing: '4px', marginBottom: '2px' }}>
          LINES
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#f0a020',
            textShadow: '0 0 12px #f0a02044',
            lineHeight: 1,
            fontFamily: 'Orbitron',
          }}
        >
          {linesCleared}
        </div>
      </div>

      {/* COMBO - Conditional, only when combo > 0 */}
      {comboCount > 0 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '8px', color: '#ff208044', letterSpacing: '4px', marginBottom: '2px' }}>
            COMBO
          </div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 900,
              color: '#ff2080',
              textShadow: '0 0 20px #ff208088',
              lineHeight: 1,
              fontFamily: 'Orbitron',
              animation: 'comboPulse 0.4s ease',
            }}
          >
            {comboCount}×
          </div>
        </div>
      )}

      {/* Latency indicator - tiny corner element */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '8px',
          fontFamily: 'Orbitron',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot }} />
        <span style={{ color: '#ffffff44' }}>
          {connectionStats ? `${Math.round(connectionStats.avgLatency)}ms` : isConnected ? 'sync' : 'off'}
        </span>
      </div>

      {/* Combo pulse animation */}
      <style>{`
        @keyframes comboPulse {
          0% { transform: scale(1.4); }
          50% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
