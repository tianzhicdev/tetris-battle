import type { Theme } from '../themes';

interface TouchControlsProps {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRotate: () => void;
  onSoftDrop: () => void;
  onHardDrop: () => void;
  theme: Theme;
}

export function TouchControls({
  onMoveLeft,
  onMoveRight,
  onRotate,
  onSoftDrop,
  onHardDrop,
  theme,
}: TouchControlsProps) {
  const buttonStyle = {
    padding: '10px',
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    touchAction: 'manipulation' as const,
    minWidth: '50px',
    minHeight: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        padding: '10px',
        backgroundColor: theme.uiBackgroundColor,
        borderTop: `2px solid ${theme.textColor}`,
        zIndex: 1000,
      }}
    >
      {/* Top row: Rotate and Hard Drop */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', justifyContent: 'center' }}>
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onRotate();
          }}
          style={{
            ...buttonStyle,
            backgroundColor: theme.colors.I,
            flex: 1,
            maxWidth: '120px',
          }}
        >
          ↻
        </button>
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onHardDrop();
          }}
          style={{
            ...buttonStyle,
            backgroundColor: theme.colors.O,
            flex: 1,
            maxWidth: '120px',
          }}
        >
          ⬇⬇
        </button>
      </div>

      {/* Bottom row: Left, Down, Right */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onMoveLeft();
          }}
          style={{
            ...buttonStyle,
            backgroundColor: theme.colors.T,
          }}
        >
          ←
        </button>
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onSoftDrop();
          }}
          style={{
            ...buttonStyle,
            backgroundColor: theme.colors.S,
          }}
        >
          ↓
        </button>
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onMoveRight();
          }}
          style={{
            ...buttonStyle,
            backgroundColor: theme.colors.T,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
