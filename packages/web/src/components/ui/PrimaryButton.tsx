import type { ReactNode } from 'react';
import { T } from '../../design-tokens';

interface PrimaryButtonProps {
  children: ReactNode;
  color?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function PrimaryButton({
  children,
  color = T.accent.cyan,
  onClick,
  disabled,
}: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '12px 0',
        background: T.bg.button,
        border: `1px solid ${color}33`,
        borderRadius: `${T.radius.md}px`,
        color,
        fontFamily: T.font.display,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textShadow: `0 0 10px ${color}44`,
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
