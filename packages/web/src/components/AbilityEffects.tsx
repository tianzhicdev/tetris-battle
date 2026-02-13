import { useEffect, useState } from 'react';
import type { ActiveAbilityEffect } from '@tetris-battle/game-core';
import type { Theme } from '../themes';

interface AbilityEffectsProps {
  activeEffects: ActiveAbilityEffect[];
  theme: Theme;
}

export function AbilityEffects({ activeEffects, theme }: AbilityEffectsProps) {
  const [effects, setEffects] = useState<ActiveAbilityEffect[]>(activeEffects);

  useEffect(() => {
    setEffects(activeEffects);
  }, [activeEffects]);

  if (effects.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        pointerEvents: 'none',
      }}
    >
      {effects.map((effect) => {
        const remaining = effect.endTime - Date.now();
        const duration = effect.endTime - effect.startTime;
        const progress = remaining / duration;

        return (
          <div
            key={effect.abilityType}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: '8px 12px',
              borderRadius: '5px',
              color: theme.textColor,
              fontSize: '12px',
              minWidth: '150px',
              border: `2px solid ${theme.colors.I}`,
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              {effect.abilityType.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div
              style={{
                height: '4px',
                backgroundColor: '#3a3a3a',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  backgroundColor: theme.colors.I,
                  width: `${progress * 100}%`,
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
            <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.7 }}>
              {Math.ceil(remaining / 1000)}s remaining
            </div>
          </div>
        );
      })}
    </div>
  );
}
