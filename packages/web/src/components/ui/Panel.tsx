import type { ReactNode } from 'react';
import { T } from '../../design-tokens';

interface PanelProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
}

export function Panel({ title, onClose, children, width = 480 }: PanelProps) {
  return (
    <div
      style={{
        width,
        maxWidth: '95vw',
        background: T.bg.panel,
        backdropFilter: 'blur(20px)',
        borderRadius: `${T.radius.xl}px`,
        border: `1px solid ${T.border.accent}`,
        boxShadow: T.panelGlow,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px 12px',
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            fontFamily: T.font.display,
            color: T.accent.cyan,
            letterSpacing: 4,
            textShadow: `0 0 20px ${T.accent.cyan}44`,
          }}
        >
          {title}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: T.bg.button,
              border: `1px solid ${T.border.subtle}`,
              borderRadius: `${T.radius.sm}px`,
              color: T.text.secondary,
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontFamily: 'system-ui',
            }}
          >
            ✕
          </button>
        )}
      </div>
      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${T.accent.cyan}22, transparent)`,
        }}
      />
      <div style={{ padding: '16px 20px 20px' }}>{children}</div>
    </div>
  );
}
