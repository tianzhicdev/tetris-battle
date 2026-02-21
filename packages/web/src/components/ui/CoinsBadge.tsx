import { T } from '../../design-tokens';

interface CoinsBadgeProps {
  amount: number;
}

export function CoinsBadge({ amount }: CoinsBadgeProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        background: `${T.accent.yellow}0f`,
        border: `1px solid ${T.accent.yellow}22`,
        borderRadius: 20,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.accent.yellow,
          fontFamily: T.font.mono,
          textShadow: `0 0 8px ${T.accent.yellow}33`,
        }}
      >
        {amount.toLocaleString()}
      </span>
      <span style={{ fontSize: 8, color: `${T.accent.yellow}88` }}>✦</span>
    </div>
  );
}
