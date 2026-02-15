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

      const starsEarned = calculateStars(linesCleared, this.gameState.comboCount);
      this.gameState.stars = Math.min(
        STAR_VALUES.maxCapacity,
        this.gameState.stars + starsEarned
      );
    }

    // Spawn next piece
    const nextType = this.gameState.nextPieces[0];
    this.gameState.currentPiece = createTetromino(nextType, this.gameState.board.width);
    this.gameState.nextPieces.shift();
    this.gameState.nextPieces.push(getRandomTetrominoSeeded(this.rng));

    // Check game over
    if (!isValidPosition(this.gameState.board, this.gameState.currentPiece)) {
      this.gameState.isGameOver = true;
    }
  }

  /**
   * Apply ability effect from opponent
   */
  applyAbility(abilityType: string): void {
    switch (abilityType) {
      case 'earthquake':
        this.gameState.board = applyEarthquake(this.gameState.board);
        break;

      case 'clear_rows': {
        const { board: clearedBoard } = applyClearRows(this.gameState.board, 5);
        this.gameState.board = clearedBoard;
        break;
      }

      case 'random_spawner':
        this.gameState.board = applyRandomSpawner(this.gameState.board);
        break;

      case 'row_rotate':
        this.gameState.board = applyRowRotate(this.gameState.board);
        break;

      case 'death_cross':
        this.gameState.board = applyDeathCross(this.gameState.board);
        break;

      case 'gold_digger':
        this.gameState.board = applyGoldDigger(this.gameState.board);
        break;

      // Speed modifiers
      case 'speed_up_opponent':
        this.tickRate = 1000 / 3; // 3x faster
        this.activeEffects.set('speed_up_opponent', Date.now() + 10000);
        setTimeout(() => {
          this.tickRate = 1000;
          this.activeEffects.delete('speed_up_opponent');
        }, 10000);
        break;

      // Duration-based effects (tracked for client)
      case 'reverse_controls':
        this.activeEffects.set('reverse_controls', Date.now() + 8000);
        break;

      case 'rotation_lock':
        this.activeEffects.set('rotation_lock', Date.now() + 6000);
        break;

      case 'blind_spot':
        this.activeEffects.set('blind_spot', Date.now() + 10000);
        break;

      case 'screen_shake':
        this.activeEffects.set('screen_shake', Date.now() + 12000);
        break;

      case 'shrink_ceiling':
        this.activeEffects.set('shrink_ceiling', Date.now() + 8000);
        break;

      case 'weird_shapes':
        this.activeEffects.set('weird_shapes', Date.now() + 1); // Next piece only
        break;

      default:
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
      if (endTime > now) {
        active.push(ability);
      } else {
        this.activeEffects.delete(ability);
      }
    }

    return active;
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
