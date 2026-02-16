import type { Ability } from '@tetris-battle/game-core';

interface AbilityCopyProps {
  ability: Ability;
  accentColor: string;
  compact?: boolean;
  align?: 'left' | 'center';
  showDescription?: boolean;
}

export function AbilityCopy({
  ability,
  accentColor,
  compact = false,
  align = 'left',
  showDescription = true,
}: AbilityCopyProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '4px' : '6px', textAlign: align }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
        <span
          style={{
            padding: compact ? '2px 7px' : '3px 9px',
            borderRadius: '999px',
            border: `1px solid ${accentColor}`,
            color: accentColor,
            background: 'rgba(255, 255, 255, 0.04)',
            fontSize: compact ? '10px' : '11px',
            fontWeight: 800,
            letterSpacing: '0.4px',
            lineHeight: 1.2,
          }}
        >
          {ability.shortName}
        </span>
        <span
          style={{
            color: '#ffffff',
            fontSize: compact ? '13px' : '15px',
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {ability.name}
        </span>
      </div>
      {showDescription && (
        <div
          style={{
            fontSize: compact ? '11px' : '13px',
            color: 'rgba(255, 255, 255, 0.74)',
            lineHeight: 1.4,
          }}
        >
          {ability.description}
        </div>
      )}
    </div>
  );
}
