import { describe, it, expect } from 'vitest';
import { AI_DIFFICULTIES, shouldMakeRandomMove } from '../aiDifficulty';

describe('AI Difficulty', () => {
  it('contains all three difficulty levels', () => {
    expect(AI_DIFFICULTIES.easy).toBeDefined();
    expect(AI_DIFFICULTIES.medium).toBeDefined();
    expect(AI_DIFFICULTIES.hard).toBeDefined();
  });

  it('easy has higher randomMoveChance than hard', () => {
    expect(AI_DIFFICULTIES.easy.randomMoveChance).toBeGreaterThan(
      AI_DIFFICULTIES.hard.randomMoveChance
    );
  });

  it('shouldMakeRandomMove produces ~30% for easy over 1000 trials', () => {
    let randomCount = 0;
    const trials = 1000;

    for (let i = 0; i < trials; i++) {
      if (shouldMakeRandomMove('easy')) {
        randomCount++;
      }
    }

    const percentage = randomCount / trials;
    // Should be around 0.3, allow ±0.05 tolerance
    expect(percentage).toBeGreaterThan(0.25);
    expect(percentage).toBeLessThan(0.35);
  });

  it('hard difficulty never makes random moves', () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldMakeRandomMove('hard')).toBe(false);
    }
  });

  it('easy AI uses different weights than hard AI', () => {
    // Verify that difficulty levels have different configurations
    expect(AI_DIFFICULTIES.easy.weights.holes).not.toBe(AI_DIFFICULTIES.hard.weights.holes);
    expect(AI_DIFFICULTIES.easy.weights.aggregateHeight).not.toBe(AI_DIFFICULTIES.hard.weights.aggregateHeight);

    // Verify penalties are stronger for hard difficulty
    expect(Math.abs(AI_DIFFICULTIES.hard.weights.holes)).toBeGreaterThan(
      Math.abs(AI_DIFFICULTIES.easy.weights.holes)
    );
  });
});
