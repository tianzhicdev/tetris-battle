import { motion } from 'framer-motion';
import type { Ability } from '@tetris-battle/game-core';
import { isDebuffAbility } from '@tetris-battle/game-core';
import { buttonVariants, springs } from '../../utils/animations';

interface TimedEffectEntry {
  abilityType: string;
  remainingMs: number;
  durationMs: number;
}

interface AbilityDockProps {
  abilities: Ability[];
  stars: number;
  timedEffects: TimedEffectEntry[];
  onActivate: (ability: Ability) => void;
}

function abilityIcon(ability: Ability): string {
  if (ability.type.includes('bomb') || ability.type.includes('fire')) return '💥';
  if (ability.type.includes('shield') || ability.type.includes('reflect')) return '🛡️';
  if (ability.type.includes('speed') || ability.type.includes('slow')) return '⚡';
  if (ability.type.includes('ink') || ability.type.includes('blind') || ability.type.includes('fog')) return '🌫️';
  return isDebuffAbility(ability) ? '⚠️' : '✨';
}

export function AbilityDock({ abilities, stars, timedEffects, onActivate }: AbilityDockProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        overflowY: 'auto',
        padding: '2px',
      }}
    >
      {abilities.slice(0, 8).map((ability) => {
        const affordable = stars >= ability.cost;
        const activeEffect = timedEffects.find((effect) => effect.abilityType === ability.type);
        const cooldownProgress = activeEffect
          ? Math.max(0, Math.min(1, activeEffect.remainingMs / activeEffect.durationMs))
          : 0;
        const debuff = isDebuffAbility(ability);

        return (
          <motion.button
            key={ability.id}
            whileTap={affordable ? 'tap' : undefined}
            variants={buttonVariants}
            transition={springs.snappy}
            onClick={() => {
              if (affordable) onActivate(ability);
            }}
            disabled={!affordable}
            title={`${ability.name}: ${ability.description}`}
            style={{
              border: `1px solid ${debuff ? 'rgba(255, 0, 110, 0.35)' : 'rgba(0, 212, 255, 0.35)'}`,
              borderRadius: '9px',
              background: affordable ? 'rgba(9, 12, 30, 0.82)' : 'rgba(9, 12, 30, 0.35)',
              color: '#fff',
              padding: '6px 5px',
              opacity: affordable ? 1 : 0.45,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: '4px',
              boxShadow: affordable
                ? debuff
                  ? '0 0 10px rgba(255, 0, 110, 0.18)'
                  : '0 0 10px rgba(0, 212, 255, 0.18)'
                : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <span style={{ fontSize: '12px' }}>{abilityIcon(ability)}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: debuff ? '#ff7ca8' : '#7de3ff' }}>
                {ability.cost}
              </span>
            </div>
            <div
              style={{
                fontSize: '8px',
                fontWeight: 700,
                letterSpacing: '0.2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'left',
              }}
            >
              {ability.shortName}
            </div>
            <div style={{ height: '3px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${cooldownProgress * 100}%`,
                  background: debuff
                    ? 'linear-gradient(90deg, #ff2f7c 0%, #ff8a74 100%)'
                    : 'linear-gradient(90deg, #00d4ff 0%, #7effd7 100%)',
                  transition: 'width 120ms linear',
                }}
              />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
