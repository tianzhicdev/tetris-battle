import { T } from '../../design-tokens';

interface MatchRowProps {
  result: 'WIN' | 'LOSS';
  opponent: string;
  date: string;
  coins: number;
}

export function MatchRow({ result, opponent, date, coins }: MatchRowProps) {
  const isWin = result === 'WIN';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        background: T.bg.card,
        borderRadius: `${T.radius.md}px`,
        borderLeft: `3px solid ${isWin ? T.accent.green : T.accent.red}55`,
        marginBottom: 6,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: T.font.display,
            color: isWin ? T.accent.green : T.accent.red,
            letterSpacing: 2,
          }}
        >
          {result}
        </div>
        <div
          style={{
            fontSize: 10,
            color: T.text.secondary,
            fontFamily: T.font.mono,
            marginTop: 2,
          }}
        >
          vs {opponent}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: T.accent.yellow,
            fontFamily: T.font.mono,
          }}
        >
          +{coins}
        </div>
        <div
          style={{
            fontSize: 8,
            color: T.text.tertiary,
            marginTop: 2,
          }}
        >
          {date}
        </div>
      </div>
    </div>
  );
}
