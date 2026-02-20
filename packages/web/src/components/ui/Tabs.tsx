import { T } from '../../design-tokens';

interface TabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        marginBottom: 16,
        borderBottom: `1px solid ${T.border.subtle}`,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            flex: 1,
            padding: '10px 0',
            background: active === tab ? 'rgba(0,240,240,0.06)' : 'transparent',
            border: 'none',
            borderBottom:
              active === tab
                ? `2px solid ${T.accent.cyan}`
                : '2px solid transparent',
            color: active === tab ? T.accent.cyan : T.text.secondary,
            fontFamily: T.font.body,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 2,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
