import { describe, it, expect } from 'vitest';
import { AdaptiveAI } from '../adaptiveAI';
import { createInitialPlayerMetrics } from '../../types';
import { createTetromino } from '../../tetrominos';
import { createBoard } from '../../engine';

describe('AdaptiveAI', () => {
  it('should calculate move delay based on player metrics', () => {
    const metrics = createInitialPlayerMetrics();
    metrics.averageLockTime = 2000; // 2 seconds

    const ai = new AdaptiveAI(metrics);
    const delay = ai.decideMoveDelay();

    // Should be within ±20% of base delay (2000ms), then slowed by 10%
    // So: 2000 * 1.1 = 2200, with variance of ±400
    expect(delay).toBeGreaterThanOrEqual(1760);
    expect(delay).toBeLessThanOrEqual(2640);
  });

  it('should make mistakes at base rate (~35%)', () => {
    const metrics = createInitialPlayerMetrics();

    const ai = new AdaptiveAI(metrics);

    // Test 1000 decisions, expect ~35% mistakes (base rate)
    let mistakeCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (ai.shouldMakeMistake()) {
        mistakeCount++;
      }
    }

    // Should be around 300-400 mistakes (35% ± tolerance)
    expect(mistakeCount).toBeGreaterThanOrEqual(280);
    expect(mistakeCount).toBeLessThanOrEqual(420);
  });

  it('should find reasonable moves (not optimal)', () => {
    const board = createBoard(10, 20);
    const piece = createTetromino('I', 10);
    const metrics = createInitialPlayerMetrics();

    const ai = new AdaptiveAI(metrics);
    const decision = ai.findReasonableMove(board, piece);

    expect(decision).toBeDefined();
    expect(decision.moves.length).toBeGreaterThan(0); // AI will position piece
    expect(decision.targetPosition).toBeDefined();
  });

  it('should make random placement mistakes', () => {
    const board = createBoard(10, 20);
    const piece = createTetromino('T', 10);
    const metrics = createInitialPlayerMetrics();

    const ai = new AdaptiveAI(metrics);
    const decision = ai.makeIntentionalMistake(board, piece);

    expect(decision).toBeDefined();
    expect(decision.score).toBeLessThanOrEqual(0); // Mistakes have negative or zero score
  });

  it('should update player metrics', () => {
    const metrics1 = createInitialPlayerMetrics();
    metrics1.averageLockTime = 2000;

    const ai = new AdaptiveAI(metrics1);
    expect(ai.playerMetrics.averageLockTime).toBe(2000);

    const metrics2 = createInitialPlayerMetrics();
    metrics2.averageLockTime = 1000;

    ai.updatePlayerMetrics(metrics2);
    expect(ai.playerMetrics.averageLockTime).toBe(1000);
  });
});
