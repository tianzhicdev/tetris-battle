import type { Ability, AbilityType } from './types';

// Cost factor to adjust all ability costs (1 = 10% of original design, 10 = 100%)
const COST_FACTOR = 1;

// Ability definitions based on tetris-pvp-abilities.md
export const ABILITIES: Record<AbilityType, Ability> = {
  // ========== BUFFS (8) ==========
  cross_firebomb: {
    id: 'cross_firebomb',
    type: 'cross_firebomb',
    name: 'Cross FireBomb',
    description: 'Piece becomes a bomb. Clears 3 rows and 3 columns in cross pattern',
    cost: 45 * COST_FACTOR,
    cooldown: 15000,
    powerRating: 7,
    category: 'buff',
    icon: 'IoAdd',
  },
  circle_bomb: {
    id: 'circle_bomb',
    type: 'circle_bomb',
    name: 'Circle Bomb',
    description: 'Piece becomes a bomb. Clears all blocks within radius of 3 cells',
    cost: 50 * COST_FACTOR,
    cooldown: 15000,
    powerRating: 7,
    category: 'buff',
    icon: 'IoRadioButtonOn',
  },
  clear_rows: {
    id: 'clear_rows',
    type: 'clear_rows',
    name: 'Clear 5 Rows',
    description: 'Instantly clear 5 rows from the bottom',
    cost: 60 * COST_FACTOR,
    cooldown: 15000,
    powerRating: 8,
    category: 'buff',
    icon: 'IoRemove',
  },
  cascade_multiplier: {
    id: 'cascade_multiplier',
    type: 'cascade_multiplier',
    name: 'Cascade Multiplier',
    description: 'Double all stars earned',
    cost: 90 * COST_FACTOR,
    duration: 20000,
    cooldown: 25000,
    powerRating: 9,
    category: 'buff',
    icon: 'IoStar',
  },
  mini_blocks: {
    id: 'mini_blocks',
    type: 'mini_blocks',
    name: 'Mini Blocks',
    description: 'Next 5 pieces are simple 2-cell dominoes',
    cost: 40 * COST_FACTOR,
    duration: 5,  // 5 pieces
    cooldown: 20000,
    powerRating: 5,
    category: 'buff',
    icon: 'IoEllipsisVertical',
  },

  // ========== DEBUFFS (10) ==========
  speed_up_opponent: {
    id: 'speed_up_opponent',
    type: 'speed_up_opponent',
    name: 'Speed Up',
    description: "Opponent's pieces fall 3x faster",
    cost: 35 * COST_FACTOR,
    duration: 15000,
    cooldown: 20000,
    powerRating: 5,
    category: 'debuff',
    icon: 'IoSpeedometerOutline',
  },
  weird_shapes: {
    id: 'weird_shapes',
    type: 'weird_shapes',
    name: 'Weird Shapes',
    description: "Opponent's next 3 pieces are big 5x5 random shapes",
    cost: 80 * COST_FACTOR,
    duration: 3,  // 3 pieces
    cooldown: 25000,
    powerRating: 8,
    category: 'debuff',
    icon: 'IoEllipse',
  },
  random_spawner: {
    id: 'random_spawner',
    type: 'random_spawner',
    name: 'Random Spawner',
    description: 'Random garbage blocks appear every 2 seconds',
    cost: 50 * COST_FACTOR,
    duration: 20000,
    cooldown: 20000,
    powerRating: 6,
    category: 'debuff',
    icon: 'IoDotChart',
  },
  rotation_lock: {
    id: 'rotation_lock',
    type: 'rotation_lock',
    name: 'Rotation Lock',
    description: "Opponent cannot rotate pieces",
    cost: 60 * COST_FACTOR,
    duration: 20000,
    cooldown: 20000,
    powerRating: 7,
    category: 'debuff',
    icon: 'IoLockClosed',
  },
  blind_spot: {
    id: 'blind_spot',
    type: 'blind_spot',
    name: 'Blind Spot',
    description: "Bottom 4 rows become invisible",
    cost: 85 * COST_FACTOR,
    duration: 20000,
    cooldown: 25000,
    powerRating: 8,
    category: 'debuff',
    icon: 'IoEyeOff',
  },
  reverse_controls: {
    id: 'reverse_controls',
    type: 'reverse_controls',
    name: 'Reverse Controls',
    description: "Opponent's left/right inputs are swapped",
    cost: 35 * COST_FACTOR,
    duration: 12000,
    cooldown: 15000,
    powerRating: 5,
    category: 'debuff',
    icon: 'IoSwapHorizontal',
  },
  earthquake: {
    id: 'earthquake',
    type: 'earthquake',
    name: 'Earthquake',
    description: 'Every row randomly shifts 1-2 cells, creating gaps',
    cost: 65 * COST_FACTOR,
    cooldown: 20000,
    powerRating: 7,
    category: 'debuff',
    icon: 'IoTrendingDown',
  },
  screen_shake: {
    id: 'screen_shake',
    type: 'screen_shake',
    name: 'Screen Shake',
    description: "Opponent's board vibrates violently. Visual chaos",
    cost: 25 * COST_FACTOR,
    duration: 10000,
    cooldown: 15000,
    powerRating: 3,
    category: 'debuff',
    icon: 'IoPhonePortraitOutline',
  },
  shrink_ceiling: {
    id: 'shrink_ceiling',
    type: 'shrink_ceiling',
    name: 'Shrink Ceiling',
    description: "Playable area shortened by 4 rows from top",
    cost: 50 * COST_FACTOR,
    duration: 15000,
    cooldown: 20000,
    powerRating: 7,
    category: 'debuff',
    icon: 'IoArrowDown',
  },
};

// Get random abilities for carousel (3 at a time)
export function getRandomAbilities(count: number = 3): Ability[] {
  const allAbilities = Object.values(ABILITIES);
  const shuffled = [...allAbilities].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Check if ability can be activated
export function canActivateAbility(
  ability: Ability,
  currentStars: number,
  lastUseTime: number | undefined,
  currentTime: number
): boolean {
  // Check star cost
  if (currentStars < ability.cost) {
    return false;
  }

  // Check cooldown
  if (lastUseTime && currentTime - lastUseTime < ability.cooldown) {
    return false;
  }

  return true;
}

// Calculate ability cooldown remaining
export function getCooldownRemaining(
  cooldown: number,
  lastUseTime: number | undefined,
  currentTime: number
): number {
  if (!lastUseTime) return 0;
  const remaining = cooldown - (currentTime - lastUseTime);
  return Math.max(0, remaining);
}
