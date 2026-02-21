import type { Board, Tetromino } from '../types';
import type { AIDecision, AIWeights } from './aiPlayer';
import { findBestPlacement } from './aiPlayer';

export const STRONG_DETERMINISTIC_WEIGHTS: AIWeights = {
  aggregateHeight: -0.51,
  completeLines: 8.0,
  holes: -8.0,
  bumpiness: -0.18,
};

export class DeterministicBattleAI {
  private reactionCadenceMs: number;
  private readonly weights: AIWeights;

  constructor(reactionCadenceMs: number = 180, weights: AIWeights = STRONG_DETERMINISTIC_WEIGHTS) {
    this.reactionCadenceMs = this.clampCadence(reactionCadenceMs);
    this.weights = weights;
  }

  setReactionCadenceMs(reactionCadenceMs: number): void {
    this.reactionCadenceMs = this.clampCadence(reactionCadenceMs);
  }

  decideMoveDelay(): number {
    return this.reactionCadenceMs;
  }

  findMove(board: Board, piece: Tetromino): AIDecision {
    return findBestPlacement(board, piece, this.weights);
  }

  private clampCadence(value: number): number {
    if (!Number.isFinite(value)) return 180;
    return Math.max(60, Math.min(1200, Math.round(value)));
  }
}
