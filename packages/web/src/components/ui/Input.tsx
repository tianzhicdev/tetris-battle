import { T } from '../../design-tokens';

interface InputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  button?: string;
  onButtonClick?: () => void;
}

export function Input({ placeholder, value, onChange, button, onButtonClick }: InputProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          flex: 1,
          background: T.bg.input,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: `${T.radius.md}px`,
          padding: '10px 14px',
          color: T.text.primary,
          fontFamily: T.font.mono,
          fontSize: 12,
          outline: 'none',
        }}
      />
      {button && (
        <button
          onClick={onButtonClick}
          style={{
            background: T.bg.button,
            border: `1px solid ${T.accent.cyan}33`,
            borderRadius: `${T.radius.md}px`,
            color: T.accent.cyan,
            fontFamily: T.font.display,
            fontSize: 10,
            fontWeight: 700,
            padding: '0 18px',
            cursor: 'pointer',
            letterSpacing: 2,
          }}
        >
          {button}
        </button>
      )}
    </div>
  );
}
