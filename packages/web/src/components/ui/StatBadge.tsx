import type { ReactNode } from 'react';
import { T } from '../../design-tokens';

interface StatBadgeProps {
  value: ReactNode;
  label: string;
  color?: string;
}

export function StatBadge({ value, label, color = T.accent.cyan }: StatBadgeProps) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          fontFamily: T.font.display,
          color,
          textShadow: `0 0 14px ${color}44`,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 8,
          color: T.text.tertiary,
          letterSpacing: 2,
          marginTop: 6,
          fontFamily: T.font.body,
        }}
      >
        {label}
      </div>
    </div>
  );
}
