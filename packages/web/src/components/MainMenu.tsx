interface MainMenuProps {
  onSelectMode: (mode: 'solo' | 'multiplayer') => void;
  theme: any;
}

export function MainMenu({ onSelectMode, theme }: MainMenuProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: theme.backgroundColor,
        color: theme.textColor,
        fontFamily: 'monospace',
      }}
    >
      <h1
        style={{
          fontSize: '4rem',
          marginBottom: '2rem',
          textShadow: `3px 3px 0 ${theme.colors.I}`,
        }}
      >
        TETRIS BATTLE
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <button
          onClick={() => onSelectMode('solo')}
          style={{
            padding: '20px 60px',
            fontSize: '24px',
            backgroundColor: theme.colors.T,
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            transition: 'transform 0.1s',
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          SOLO PLAY
        </button>

        <button
          onClick={() => onSelectMode('multiplayer')}
          style={{
            padding: '20px 60px',
            fontSize: '24px',
            backgroundColor: theme.colors.L,
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            transition: 'transform 0.1s',
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          MULTIPLAYER
        </button>
      </div>

      <p style={{ marginTop: '3rem', opacity: 0.6 }}>
        Press any button to start
      </p>
    </div>
  );
}
