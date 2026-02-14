import type { AIWeights } from './aiPlayer';

export type AIDifficultyLevel = 'easy' | 'medium' | 'hard';

export interface AIDifficultyConfig {
  weights: AIWeights;
  moveDelay: number; // milliseconds between moves
  randomMoveChance: number; // 0-1 probability
  useAbilities: 'never' | 'random' | 'strategic';
  abilityThreshold: number; // stars needed to consider using ability
}

export const AI_DIFFICULTIES: Record<AIDifficultyLevel, AIDifficultyConfig> = {
  easy: {
    weights: { aggregateHeight: -0.3, completeLines: 5, holes: -3, bumpiness: -0.2 },
    moveDelay: 300,
    randomMoveChance: 0.3,
    useAbilities: 'never',
    abilityThreshold: 999,
  },
  medium: {
    weights: { aggregateHeight: -0.5, completeLines: 8, holes: -7, bumpiness: -0.4 },
    moveDelay: 150,
    randomMoveChance: 0.1,
    useAbilities: 'random',
    abilityThreshold: 200,
  },
  hard: {
    weights: { aggregateHeight: -0.8, completeLines: 10, holes: -10, bumpiness: -0.6 },
    moveDelay: 80,
    randomMoveChance: 0,
    useAbilities: 'strategic',
    abilityThreshold: 150,
  },
};

export function shouldMakeRandomMove(difficulty: AIDifficultyLevel): boolean {
  return Math.random() < AI_DIFFICULTIES[difficulty].randomMoveChance;
}
