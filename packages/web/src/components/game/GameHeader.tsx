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
  notifications,
  isConnected,
  connectionStats,
}: GameHeaderProps) {
  const dot = connectionColor(connectionStats, isConnected);
  const latest = notifications[notifications.length - 1];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '8px 10px',
        background: 'linear-gradient(180deg, rgba(8, 10, 24, 0.92) 0%, rgba(5, 7, 18, 0.78) 100%)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.25)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 4px 18px rgba(0, 212, 255, 0.12)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: '#9ad2ff', fontWeight: 700 }}>Score {score}</div>
        <div style={{ fontSize: '12px', color: '#d88cff', fontWeight: 800 }}>⭐ {stars}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, maxWidth: '58%' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: '10px', color: '#d9e9ff', opacity: 0.9, flexShrink: 0 }}>
          {connectionStats ? `${Math.round(connectionStats.avgLatency)}ms` : isConnected ? 'sync' : 'offline'}
        </span>
        {latest && (
          <span
            style={{
              fontSize: '10px',
              color: latest.category === 'debuff' ? '#ff8db7' : '#8fffd7',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
            title={`${latest.name}: ${latest.description}`}
          >
            {latest.name}
          </span>
        )}
      </div>
    </div>
  );
}
