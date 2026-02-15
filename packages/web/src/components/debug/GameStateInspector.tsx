import { useState } from 'react';
import { glassDark, mergeGlass } from '../../styles/glassUtils';

interface GameStateInspectorProps {
  yourState: any;
  opponentState: any;
}

export function GameStateInspector({ yourState, opponentState }: GameStateInspectorProps) {
  const [viewingState, setViewingState] = useState<'your' | 'opponent' | null>(null);

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('Copied to clipboard!');
  };

  return (
    <div style={{ marginBottom: '12px', fontSize: '10px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <button onClick={() => setViewingState('your')} style={buttonStyle}>
          View Your State
        </button>
        <button onClick={() => setViewingState('opponent')} style={buttonStyle}>
          View Opponent State
        </button>
      </div>

      {viewingState && (
        <div style={mergeGlass(glassDark(), {
          padding: '8px',
          borderRadius: '4px',
          maxHeight: '300px',
          overflowY: 'auto',
        })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ color: '#00ff00', fontWeight: 'bold' }}>
              {viewingState === 'your' ? 'Your State' : 'Opponent State'}
            </div>
            <button
              onClick={() => copyToClipboard(viewingState === 'your' ? yourState : opponentState)}
              style={{ ...buttonStyle, fontSize: '9px', padding: '2px 6px' }}
            >
              Copy
            </button>
          </div>
          <pre style={{ fontSize: '9px', color: '#aaa', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(viewingState === 'your' ? yourState : opponentState, null, 2)}
          </pre>
          <button onClick={() => setViewingState(null)} style={{ ...buttonStyle, marginTop: '8px' }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '10px',
  border: '1px solid rgba(0, 255, 0, 0.5)',
  borderRadius: '4px',
  backgroundColor: 'rgba(0, 255, 0, 0.1)',
  color: '#00ff00',
  cursor: 'pointer',
};
