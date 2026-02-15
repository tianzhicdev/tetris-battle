interface NetworkStatsProps {
  pingHistory: number[];
  onPingTest: () => void;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

export function NetworkStats({ pingHistory, onPingTest, connectionStatus }: NetworkStatsProps) {
  const currentRTT = pingHistory[pingHistory.length - 1];
  const avgRTT = pingHistory.length > 0
    ? Math.round(pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length)
    : 0;
  const minRTT = pingHistory.length > 0 ? Math.min(...pingHistory) : 0;
  const maxRTT = pingHistory.length > 0 ? Math.max(...pingHistory) : 0;

  const statusColor = {
    connected: '#00ff00',
    connecting: '#ffaa00',
    disconnected: '#ff0000',
  }[connectionStatus];

  return (
    <div style={{ marginBottom: '12px', fontSize: '11px' }}>
      <div style={{ marginBottom: '6px' }}>
        <div style={{ color: '#aaa' }}>Connection: <span style={{ color: statusColor }}>{connectionStatus.toUpperCase()}</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
        <div>RTT: <span style={{ color: '#00ff9d' }}>{currentRTT || '--'}ms</span></div>
        <div>Avg: <span style={{ color: '#00aaff' }}>{avgRTT || '--'}ms</span></div>
        <div>Min: <span style={{ color: '#00ff00' }}>{minRTT || '--'}ms</span></div>
        <div>Max: <span style={{ color: '#ff6600' }}>{maxRTT || '--'}ms</span></div>
      </div>
      <button onClick={onPingTest} style={buttonStyle}>
        Ping Test
      </button>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '10px',
  border: '1px solid rgba(0, 255, 0, 0.5)',
  borderRadius: '4px',
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
  color: '#00ff00',
  cursor: 'pointer',
  width: '100%',
};
