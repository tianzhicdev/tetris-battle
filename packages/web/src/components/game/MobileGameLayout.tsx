import type { ReactNode } from 'react';

interface MobileGameLayoutProps {
  header: ReactNode;
  nextQueue: ReactNode;
  board: ReactNode;
  opponentPreview: ReactNode;
  abilityDock: ReactNode;
  controls: ReactNode;
}

export function MobileGameLayout({
  header,
  nextQueue,
  board,
  opponentPreview,
  abilityDock,
  controls,
}: MobileGameLayoutProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          height: '48px',
        }}
      >
        {header}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          padding: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '72px',
            flexShrink: 0,
            minHeight: 0,
          }}
        >
          {nextQueue}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {board}
        </div>

        <div
          style={{
            width: '92px',
            flexShrink: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflow: 'hidden',
          }}
        >
          <div style={{ flexShrink: 0 }}>{opponentPreview}</div>
          <div style={{ flex: 1, minHeight: 0 }}>{abilityDock}</div>
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          height: '96px',
        }}
      >
        {controls}
      </div>
    </div>
  );
}
