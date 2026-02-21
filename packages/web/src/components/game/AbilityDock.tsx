import { motion } from 'framer-motion';
import type { Ability } from '@tetris-battle/game-core';
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

const ABILITY_CHARS: Record<string, string> = {
  earthquake: '震',
  screen_shake: '揺',
  blind_spot: '墨',
  ink_splash: '墨',
  mini_blocks: '縮',
  fill_holes: '満',
  clear_rows: '消',
  speed_up_opponent: '速',
  reverse_controls: '逆',
  rotation_lock: '鎖',
  shrink_ceiling: '縮',
  random_spawner: '乱',
  gold_digger: '金',
  deflect_shield: '盾',
  cascade_multiplier: '倍',
  piece_preview_plus: '視',
  cross_firebomb: '爆',
  circle_bomb: '円',
  death_cross: '十',
  row_rotate: '回',
  weird_shapes: '奇',
};

function abilityChar(ability: Ability): string {
  return ABILITY_CHARS[ability.type] || '✨';
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
        const isActive = !!activeEffect;

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
              width: 44,
              height: 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: affordable ? 'pointer' : 'default',
              opacity: isActive ? 1 : affordable ? 0.3 : 0.12,
              transition: 'all 0.25s ease',
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            <div
              style={{
                fontSize: 24,
                color: isActive ? '#00f0f0' : '#ffffff',
                fontFamily: "'Noto Sans SC', sans-serif",
                lineHeight: 1,
                textShadow: isActive ? '0 0 16px #00f0f088, 0 0 30px #00f0f044' : 'none',
                transition: 'all 0.25s',
              }}
            >
              {abilityChar(ability)}
            </div>
            <div
              style={{
                fontSize: 8,
                color: isActive ? '#00f0f088' : '#ffffff33',
                marginTop: 3,
                fontFamily: "'Orbitron'",
                letterSpacing: 1,
              }}
            >
              ★{ability.cost}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
