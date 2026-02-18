import {
  createInitialGameState,
  createTetromino,
  movePiece,
  rotatePiece,
  lockPiece,
  clearLines,
  isValidPosition,
  getHardDropPosition,
  calculateStars,
  STAR_VALUES,
  SeededRandom,
  getRandomTetrominoSeeded,
  applyEarthquake,
  applyClearRows,
  applyRandomSpawner,
  applyRowRotate,
  applyDeathCross,
  applyGoldDigger,
  applyCircleBomb,
  applyCrossBomb,
  applyFillHoles,
  createMiniBlock,
  createWeirdShape,
  ABILITIES,
  type GameState,
  type Tetromino,
  type PlayerInputType,
} from '@tetris-battle/game-core';

/**
 * ServerGameState manages the authoritative game state for one player
 * on the server side. It processes inputs, runs the game loop, and
 * provides state for broadcasting to clients.
 */
export class ServerGameState {
  playerId: string;
  gameState: GameState;
  rng: SeededRandom;
  tickRate: number = 1000; // Base tick rate in ms, modified by abilities
  lastTickTime: number = Date.now();
  loadout: string[] = [];
  activeEffects: Map<string, number> = new Map(); // abilityType → endTime

  // Buff ability state
  private bombMode: { type: 'circle' | 'cross' } | null = null;
  private miniBlocksRemaining: number = 0;

  constructor(playerId: string, seed: number, loadout: string[]) {
    this.playerId = playerId;
    this.rng = new SeededRandom(seed + playerId.charCodeAt(0)); // Unique seed per player
    this.loadout = loadout;
    this.gameState = this.initializeGame();
  }

  private initializeGame(): GameState {
    const state = createInitialGameState();
    // Override nextPieces with seeded generation
    state.nextPieces = [
      getRandomTetrominoSeeded(this.rng),
      getRandomTetrominoSeeded(this.rng),
      getRandomTetrominoSeeded(this.rng),
      getRandomTetrominoSeeded(this.rng),
      getRandomTetrominoSeeded(this.rng),
    ];
    // Spawn first piece
    state.currentPiece = createTetromino(state.nextPieces[0], state.board.width);
    return state;
  }

  /**
   * Process player input and return true if state changed
   */
  processInput(input: PlayerInputType): boolean {
    if (!this.gameState.currentPiece || this.gameState.isGameOver) {
      return false;
    }

    // Check for rotation lock
    if (this.activeEffects.has('rotation_lock')) {
      const endTime = this.activeEffects.get('rotation_lock')!;
      if (Date.now() < endTime) {
        if (input === 'rotate_cw' || input === 'rotate_ccw') {
          return false; // Block rotation
        }
      } else {
        this.activeEffects.delete('rotation_lock');
      }
    }

    // Check for reverse controls
    let effectiveInput = input;
    if (this.activeEffects.has('reverse_controls')) {
      const endTime = this.activeEffects.get('reverse_controls')!;
      if (Date.now() < endTime) {
        if (input === 'move_left') effectiveInput = 'move_right';
        else if (input === 'move_right') effectiveInput = 'move_left';
      } else {
        this.activeEffects.delete('reverse_controls');
      }
    }

    let newPiece = this.gameState.currentPiece;
    let stateChanged = false;

    switch (effectiveInput) {
      case 'move_left':
        newPiece = movePiece(newPiece, -1, 0);
        if (isValidPosition(this.gameState.board, newPiece)) {
          this.gameState.currentPiece = newPiece;
          stateChanged = true;
        }
        break;

      case 'move_right':
        newPiece = movePiece(newPiece, 1, 0);
        if (isValidPosition(this.gameState.board, newPiece)) {
          this.gameState.currentPiece = newPiece;
          stateChanged = true;
        }
        break;

      case 'rotate_cw':
        newPiece = rotatePiece(newPiece, true);
        if (isValidPosition(this.gameState.board, newPiece)) {
          this.gameState.currentPiece = newPiece;
          stateChanged = true;
        }
        break;

      case 'rotate_ccw':
        newPiece = rotatePiece(newPiece, false);
        if (isValidPosition(this.gameState.board, newPiece)) {
          this.gameState.currentPiece = newPiece;
          stateChanged = true;
        }
        break;

      case 'soft_drop':
        return this.movePieceDown(); // Might lock piece

      case 'hard_drop':
        return this.hardDrop();
    }

    return stateChanged;
  }

  /**
   * Tick: move piece down or lock (called by game loop)
   */
  tick(): boolean {
    return this.movePieceDown();
  }

  private movePieceDown(): boolean {
    if (!this.gameState.currentPiece || this.gameState.isGameOver) {
      return false;
    }

    const newPiece = movePiece(this.gameState.currentPiece, 0, 1);

    if (isValidPosition(this.gameState.board, newPiece)) {
      // Move down
      this.gameState.currentPiece = newPiece;
      return true;
    } else {
      // Lock and spawn next
      this.lockAndSpawn();
      return true;
    }
  }

  private hardDrop(): boolean {
    if (!this.gameState.currentPiece || this.gameState.isGameOver) {
      return false;
    }

    // Move to hard drop position
    this.gameState.currentPiece = {
      ...this.gameState.currentPiece,
      position: getHardDropPosition(this.gameState.board, this.gameState.currentPiece),
    };

    // Lock and spawn next
    this.lockAndSpawn();
    return true;
  }

  private lockAndSpawn(): void {
    if (!this.gameState.currentPiece) return;

    // Lock piece to board
    this.gameState.board = lockPiece(this.gameState.board, this.gameState.currentPiece);

    // Check for bomb mode - apply bomb effect
    if (this.bombMode) {
      const centerX = this.gameState.currentPiece.position.x + 1;
      const centerY = this.gameState.currentPiece.position.y + 1;

      if (this.bombMode.type === 'circle') {
        this.gameState.board = applyCircleBomb(this.gameState.board, centerX, centerY, 3);
      } else {
        this.gameState.board = applyCrossBomb(this.gameState.board, centerX, centerY);
      }

      this.bombMode = null;
    }

    // Clear lines and update score
    const { board, linesCleared } = clearLines(this.gameState.board);
    this.gameState.board = board;
    this.gameState.linesCleared += linesCleared;

    // Calculate score
    this.gameState.score += linesCleared * 100;

    // Award stars
    const now = Date.now();
    if (linesCleared > 0) {
      const comboWindow = STAR_VALUES.comboWindow;
      if (now - this.gameState.lastClearTime < comboWindow) {
        this.gameState.comboCount++;
      } else {
        this.gameState.comboCount = 0;
      }
      this.gameState.lastClearTime = now;

      let starsEarned = calculateStars(linesCleared, this.gameState.comboCount);

      // Check for cascade multiplier
      if (this.activeEffects.has('cascade_multiplier')) {
        const endTime = this.activeEffects.get('cascade_multiplier')!;
        if (Date.now() < endTime) {
          starsEarned *= 2;
        } else {
          this.activeEffects.delete('cascade_multiplier');
        }
      }

      this.gameState.stars = Math.min(
        STAR_VALUES.maxCapacity,
        this.gameState.stars + starsEarned
      );
    }

    // Spawn next piece - check for special piece modifiers
    if (this.activeEffects.has('weird_shapes')) {
      this.gameState.currentPiece = createWeirdShape(this.gameState.board.width, this.rng);
      this.activeEffects.delete('weird_shapes');
    } else if (this.miniBlocksRemaining > 0) {
      this.gameState.currentPiece = createMiniBlock(this.gameState.board.width);
      this.miniBlocksRemaining--;
    } else {
      const nextType = this.gameState.nextPieces[0];
      this.gameState.currentPiece = createTetromino(nextType, this.gameState.board.width);
      this.gameState.nextPieces.shift();
      this.gameState.nextPieces.push(getRandomTetrominoSeeded(this.rng));
    }

    // Check game over
    if (!isValidPosition(this.gameState.board, this.gameState.currentPiece)) {
      this.gameState.isGameOver = true;
    }
  }

  // ============================================================================
  // Ability dispatch table — add a new entry here to register a new ability.
  // Static so it is allocated once; private so only this class can mutate it.
  // Each handler receives the instance (s) to access any field, including
  // private ones (TypeScript allows static members to access private fields).
  // ============================================================================
  private static readonly ABILITY_HANDLERS: Record<string, (s: ServerGameState) => void> = {
    // ── Debuff abilities (applied to opponent's state) ──────────────────────
    earthquake:  (s) => { s.gameState.board = applyEarthquake(s.gameState.board, s.rng); },
    row_rotate:  (s) => { s.gameState.board = applyRowRotate(s.gameState.board); },
    death_cross: (s) => { s.gameState.board = applyDeathCross(s.gameState.board); },
    fill_holes:  (s) => { s.gameState.board = s.clearAndReward(applyFillHoles(s.gameState.board)); },

    clear_rows: (s) => {
      const { board } = applyClearRows(s.gameState.board, 5);
      s.gameState.board = board;
    },

    random_spawner: (s) => { s.gameState.board = clearLines(applyRandomSpawner(s.gameState.board, 5, s.rng)).board; },

    gold_digger: (s) => { s.gameState.board = applyGoldDigger(s.gameState.board, 5, s.rng); },

    speed_up_opponent: (s) => {
      const dur = s.getDurationMs('speed_up_opponent', 10000);
      s.tickRate = 1000 / 3; // 3× faster
      s.activeEffects.set('speed_up_opponent', Date.now() + dur);
      setTimeout(() => {
        s.tickRate = 1000;
        s.activeEffects.delete('speed_up_opponent');
      }, dur);
    },

    // Timed active-effect debuffs
    reverse_controls:   (s) => { s.activeEffects.set('reverse_controls',   Date.now() + s.getDurationMs('reverse_controls',   8000)); },
    rotation_lock:      (s) => { s.activeEffects.set('rotation_lock',      Date.now() + s.getDurationMs('rotation_lock',      6000)); },
    blind_spot:         (s) => { s.activeEffects.set('blind_spot',         Date.now() + s.getDurationMs('blind_spot',         10000)); },
    screen_shake:       (s) => { s.activeEffects.set('screen_shake',       Date.now() + s.getDurationMs('screen_shake',       12000)); },
    shrink_ceiling:     (s) => { s.activeEffects.set('shrink_ceiling',     Date.now() + s.getDurationMs('shrink_ceiling',     8000)); },
    cascade_multiplier: (s) => { s.activeEffects.set('cascade_multiplier', Date.now() + s.getDurationMs('cascade_multiplier', 15000)); },

    // Single-use pending effect — consumed at next piece spawn
    weird_shapes: (s) => { s.activeEffects.set('weird_shapes', Number.POSITIVE_INFINITY); },

    // ── Buff abilities (applied to self) ────────────────────────────────────
    circle_bomb:    (s) => { s.bombMode = { type: 'circle' }; },
    cross_firebomb: (s) => { s.bombMode = { type: 'cross' }; },
    mini_blocks:    (s) => { s.miniBlocksRemaining = s.getDurationMs('mini_blocks', 5); },
  };

  /**
   * Apply ability effect (can be buff or debuff).
   * To add a new ability: add one entry to ABILITY_HANDLERS above.
   */
  applyAbility(abilityType: string): void {
    const handler = ServerGameState.ABILITY_HANDLERS[abilityType];
    if (handler) {
      handler(this);
    } else {
      console.warn(`[ServerGameState] Unknown ability type: ${abilityType}`);
    }
  }

  /**
   * Get currently active effects
   */
  getActiveEffects(): string[] {
    const now = Date.now();
    const active: string[] = [];

    for (const [ability, endTime] of this.activeEffects) {
      if (ability === 'weird_shapes') {
        active.push(ability);
        continue;
      }
      if (endTime > now) {
        active.push(ability);
      } else {
        this.activeEffects.delete(ability);
      }
    }

    return active;
  }

  /**
   * Clear any completed rows after a self-buff board mutation, and award stars.
   * Do NOT call this for opponent-targeted abilities (opponent would get free stars).
   */
  private clearAndReward(board: Board): Board {
    const { board: cleared, linesCleared } = clearLines(board);
    if (linesCleared > 0) {
      this.gameState.linesCleared += linesCleared;
      const starsEarned = calculateStars(linesCleared, 0); // no combo credit for ability clears
      this.gameState.stars = Math.min(STAR_VALUES.maxCapacity, this.gameState.stars + starsEarned);
    }
    return cleared;
  }

  private getDurationMs(abilityType: string, fallbackMs: number): number {
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    return typeof ability?.duration === 'number' ? ability.duration : fallbackMs;
  }

  /**
   * Get state for broadcasting (sanitized for opponent view)
   */
  getPublicState() {
    return {
      board: this.gameState.board.grid,
      currentPiece: this.gameState.currentPiece,
      score: this.gameState.score,
      stars: this.gameState.stars,
      linesCleared: this.gameState.linesCleared,
      comboCount: this.gameState.comboCount,
      isGameOver: this.gameState.isGameOver,
      activeEffects: this.getActiveEffects(),
    };
  }

}
