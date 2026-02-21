import {
  createInitialGameState,
  createTetromino,
  movePiece,
  rotatePiece,
  lockPiece,
  clearLines,
  isValidPosition,
  calculateStars,
  calculateLineClearBaseStars,
  STAR_VALUES,
  SeededRandom,
  getRandomTetrominoSeeded,
  applyEarthquake,
  applyClearRows,
  applyRandomSpawner,
  applyGoldDigger,
  applyCircleBomb,
  applyCrossBomb,
  applyFillHoles,
  applyAddJunkRows,
  createMiniBlock,
  createWeirdShape,
  ABILITIES,
  TETROMINO_SHAPES,
  TETROMINO_TYPES,
  type Board,
  type CellValue,
  type GameState,
  type PlayerInputType,
  type Tetromino,
  type TetrominoType,
} from '@tetris-battle/game-core';

const INFINITE_EFFECT = Number.POSITIVE_INFINITY;
const BASE_TICK_RATE_MS = 1000;
const STANDARD_BOARD_WIDTH = 10;
const WIDE_LOAD_BOARD_WIDTH = 12;

/**
 * ServerGameState manages the authoritative game state for one player
 * on the server side. It processes inputs, runs the game loop, and
 * provides state for broadcasting to clients.
 */
export class ServerGameState {
  playerId: string;
  gameState: GameState;
  rng: SeededRandom;
  tickRate: number = BASE_TICK_RATE_MS;
  lastTickTime: number = Date.now();
  loadout: string[] = [];
  activeEffects: Map<string, number> = new Map(); // abilityType → endTime

  // Piece/ability state
  private bombMode: { type: 'circle' | 'cross' } | null = null;
  private miniBlocksRemaining: number = 0;
  private weirdShapesRemaining: number = 0;
  private shapeshifterPiecesRemaining: number = 0;
  private magnetPiecesRemaining: number = 0;
  private currentPieceIsShapeshifter: boolean = false;
  private currentPieceIsMagnetized: boolean = false;
  private currentPieceMagnetTarget: { x: number; y: number; rotation: number } | null = null;
  private currentPieceSpawnedAtMs: number = 0;
  private currentPieceLastManualInputAtMs: number = 0;
  private currentPieceMorphLastMs: number = 0;
  private currentPieceRowsMovedSinceSpawn: number = 0;

  // Economy/combat state
  private currentPieceRotatedSinceSpawn: boolean = false;
  private backToBackChain: number = 0;
  private lastPassiveRegenTickMs: number = Date.now();
  private overchargeCharges: number = 0;

  // Timed/periodic effect state
  private quicksandRemainingSinks: number = 0;
  private quicksandNextSinkAtMs: number = 0;
  private tiltDirection: -1 | 1 = 1;

  // Geometry effect state
  private narrowEscapeStoredColumns: CellValue[][] | null = null;

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

    const now = Date.now();
    this.currentPieceLastManualInputAtMs = now;
    this.applyPassiveStarRegen(now);
    this.refreshEffects(now);
    this.maybeMorphCurrentPiece(now);

    // Check for reverse controls
    let effectiveInput = input;
    if (this.isEffectActive('reverse_controls', now)) {
      if (input === 'move_left') effectiveInput = 'move_right';
      else if (input === 'move_right') effectiveInput = 'move_left';
    }

    // Rotation lock prevents both clockwise/counter-clockwise rotation.
    if (
      this.isEffectActive('rotation_lock', now) &&
      (effectiveInput === 'rotate_cw' || effectiveInput === 'rotate_ccw')
    ) {
      return false;
    }

    switch (effectiveInput) {
      case 'move_left': {
        const moved = movePiece(this.gameState.currentPiece, -1, 0);
        if (!isValidPosition(this.gameState.board, moved)) return false;
        this.gameState.currentPiece = moved;
        return true;
      }

      case 'move_right': {
        const moved = movePiece(this.gameState.currentPiece, 1, 0);
        if (!isValidPosition(this.gameState.board, moved)) return false;
        this.gameState.currentPiece = moved;
        return true;
      }

      case 'rotate_cw': {
        const rotated = rotatePiece(this.gameState.currentPiece, true);
        if (!isValidPosition(this.gameState.board, rotated)) return false;
        this.gameState.currentPiece = rotated;
        this.currentPieceRotatedSinceSpawn = true;
        return true;
      }

      case 'rotate_ccw': {
        const rotated = rotatePiece(this.gameState.currentPiece, false);
        if (!isValidPosition(this.gameState.board, rotated)) return false;
        this.gameState.currentPiece = rotated;
        this.currentPieceRotatedSinceSpawn = true;
        return true;
      }

      case 'soft_drop':
        return this.movePieceInGravityDirection(now);

      case 'hard_drop':
        return this.hardDrop(now);

      default:
        return false;
    }
  }

  /**
   * Tick: move piece in gravity direction or lock (called by game loop)
   */
  tick(): boolean {
    this.lastTickTime = Date.now();
    this.applyPassiveStarRegen(this.lastTickTime);
    this.refreshEffects(this.lastTickTime);
    return this.movePieceInGravityDirection(this.lastTickTime);
  }

  private movePieceInGravityDirection(now: number): boolean {
    if (!this.gameState.currentPiece || this.gameState.isGameOver) {
      return false;
    }

    this.maybeMorphCurrentPiece(now);
    if (this.shouldAutoPlaceMagnetPiece(now)) {
      this.snapToMagnetTarget();
      this.lockAndSpawn(now);
      return true;
    }

    const moved = movePiece(this.gameState.currentPiece, 0, 1);

    if (isValidPosition(this.gameState.board, moved)) {
      this.gameState.currentPiece = moved;
      this.applyTiltDriftForRows(1, now);
      return true;
    }

    this.lockAndSpawn(now);
    return true;
  }

  private hardDrop(now: number): boolean {
    if (!this.gameState.currentPiece || this.gameState.isGameOver) {
      return false;
    }

    this.maybeMorphCurrentPiece(now);

    let dropPiece = this.gameState.currentPiece;
    let movedRows = 0;

    while (true) {
      const candidate = movePiece(dropPiece, 0, 1);
      if (!isValidPosition(this.gameState.board, candidate)) break;
      dropPiece = candidate;
      movedRows++;
    }

    this.gameState.currentPiece = dropPiece;
    this.applyTiltDriftForRows(movedRows, now);
    this.lockAndSpawn(now);
    return true;
  }

  private lockAndSpawn(now: number): void {
    if (!this.gameState.currentPiece) return;
    const lockedPiece = this.gameState.currentPiece;

    // Lock piece to board
    this.gameState.board = lockPiece(this.gameState.board, this.gameState.currentPiece);

    // Check for bomb mode - apply bomb effect immediately after lock.
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

    const shrinkCeilingViolated =
      this.isEffectActive('shrink_ceiling', now) && this.isPieceAboveRow(lockedPiece, 3);

    const didTSpin = this.isTSpinLock(lockedPiece, this.gameState.board);

    // Clear lines and update score
    const { board, linesCleared } = clearLines(this.gameState.board);
    this.gameState.board = board;
    this.gameState.linesCleared += linesCleared;

    // Calculate score
    this.gameState.score += linesCleared * 100;

    // Award stars
    if (linesCleared > 0) {
      const comboWindow = STAR_VALUES.comboWindow;
      if (now - this.gameState.lastClearTime < comboWindow) {
        this.gameState.comboCount++;
      } else {
        this.gameState.comboCount = 0;
      }
      this.gameState.lastClearTime = now;

      const tSpinType =
        didTSpin && linesCleared >= 1 && linesCleared <= 3
          ? linesCleared === 1
            ? 'single'
            : linesCleared === 2
              ? 'double'
              : 'triple'
          : null;
      const difficultClear = linesCleared === 4 || tSpinType !== null;
      const backToBackBonusApplies = difficultClear && this.backToBackChain > 0;

      if (difficultClear) {
        this.backToBackChain++;
      } else {
        this.backToBackChain = 0;
      }

      const comboStars = this.gameState.comboCount * STAR_VALUES.comboBonus;
      const tSpinStars =
        calculateStars(linesCleared, {
          includeComboBonus: false,
          tSpin: tSpinType ?? false,
        }) - calculateLineClearBaseStars(linesCleared);
      const backToBackStars = backToBackBonusApplies ? STAR_VALUES.backToBackBonus : 0;
      const perfectClearStars = this.isBoardEmpty(this.gameState.board)
        ? STAR_VALUES.perfectClearBonus
        : 0;
      let baseLineClearStars = calculateLineClearBaseStars(linesCleared);

      // Cascade multiplier doubles base line-clear stars only.
      if (this.isEffectActive('cascade_multiplier', now)) {
        baseLineClearStars *= 2;
      }

      const starsEarned =
        baseLineClearStars +
        comboStars +
        tSpinStars +
        backToBackStars +
        perfectClearStars;

      this.gameState.stars = Math.min(
        STAR_VALUES.maxCapacity,
        this.gameState.stars + starsEarned
      );

    } else {
      this.gameState.comboCount = 0;
    }

    if (shrinkCeilingViolated) {
      this.gameState.isGameOver = true;
      this.gameState.currentPiece = null;
      return;
    }

    this.spawnNextPiece(now);

    // Check game over
    if (!this.gameState.currentPiece || !isValidPosition(this.gameState.board, this.gameState.currentPiece)) {
      this.gameState.isGameOver = true;
    }
  }

  private spawnNextPiece(now: number): void {
    let nextPiece: Tetromino;

    if (this.weirdShapesRemaining > 0) {
      nextPiece = createWeirdShape(this.gameState.board.width, this.rng);
      this.weirdShapesRemaining--;
      this.syncCounterEffect('weird_shapes', this.weirdShapesRemaining);
    } else if (this.miniBlocksRemaining > 0) {
      nextPiece = createMiniBlock(this.gameState.board.width);
      this.miniBlocksRemaining--;
      this.syncCounterEffect('mini_blocks', this.miniBlocksRemaining);
    } else {
      const nextType = this.gameState.nextPieces[0];
      nextPiece = createTetromino(nextType, this.gameState.board.width);
      this.gameState.nextPieces.shift();
      this.gameState.nextPieces.push(getRandomTetrominoSeeded(this.rng));
    }

    this.gameState.currentPiece = nextPiece;

    this.currentPieceIsShapeshifter = false;
    if (this.shapeshifterPiecesRemaining > 0) {
      this.currentPieceIsShapeshifter = true;
      this.shapeshifterPiecesRemaining--;
      this.currentPieceMorphLastMs = now;
      this.syncCounterEffect('shapeshifter', this.shapeshifterPiecesRemaining);
    }

    this.currentPieceIsMagnetized = false;
    this.currentPieceMagnetTarget = null;
    if (this.magnetPiecesRemaining > 0) {
      this.currentPieceIsMagnetized = true;
      this.magnetPiecesRemaining--;
      this.currentPieceMagnetTarget = this.findBestMagnetPlacement(this.gameState.currentPiece, this.gameState.board);
    }
    this.syncMagnetCounterEffect();

    this.currentPieceRotatedSinceSpawn = false;
    this.currentPieceRowsMovedSinceSpawn = 0;
    this.currentPieceSpawnedAtMs = now;
    this.currentPieceLastManualInputAtMs = now;
    this.ensureCurrentPieceWithinBoard();
  }

  private maybeMorphCurrentPiece(now: number): void {
    if (!this.currentPieceIsShapeshifter || !this.gameState.currentPiece) return;
    if (now - this.currentPieceMorphLastMs < 400) return;

    const currentPiece = this.gameState.currentPiece;
    const randomType = TETROMINO_TYPES[this.rng.nextInt(TETROMINO_TYPES.length)];
    const rotations = TETROMINO_SHAPES[randomType];
    const rotationIndex = currentPiece.rotation % rotations.length;

    const morphed: Tetromino = {
      ...currentPiece,
      type: randomType,
      rotation: rotationIndex,
      shape: rotations[rotationIndex],
    };

    if (isValidPosition(this.gameState.board, morphed)) {
      this.gameState.currentPiece = morphed;
    } else {
      const fallback: Tetromino = {
        ...morphed,
        rotation: 0,
        shape: rotations[0],
      };
      if (isValidPosition(this.gameState.board, fallback)) {
        this.gameState.currentPiece = fallback;
      }
    }

    this.currentPieceMorphLastMs = now;
  }

  private applyTiltDriftForRows(rowsMoved: number, now: number): void {
    if (rowsMoved <= 0 || !this.gameState.currentPiece) return;
    if (!this.isEffectActive('tilt', now)) return;

    this.currentPieceRowsMovedSinceSpawn += rowsMoved;

    while (this.currentPieceRowsMovedSinceSpawn >= 2 && this.gameState.currentPiece) {
      this.currentPieceRowsMovedSinceSpawn -= 2;
      const drifted = movePiece(this.gameState.currentPiece, this.tiltDirection, 0);
      if (!isValidPosition(this.gameState.board, drifted)) break;
      this.gameState.currentPiece = drifted;
    }
  }

  private ensureCurrentPieceWithinBoard(): void {
    const piece = this.gameState.currentPiece;
    if (!piece) return;

    const maxX = Math.max(0, this.gameState.board.width - piece.shape[0].length);
    const maxY = Math.max(0, this.gameState.board.height - piece.shape.length);

    let adjusted: Tetromino = {
      ...piece,
      position: {
        x: Math.max(0, Math.min(piece.position.x, maxX)),
        y: Math.max(0, Math.min(piece.position.y, maxY)),
      },
    };

    if (!isValidPosition(this.gameState.board, adjusted)) {
      // Try nudging upward to keep piece valid after geometry effects.
      while (adjusted.position.y > 0 && !isValidPosition(this.gameState.board, adjusted)) {
        adjusted = {
          ...adjusted,
          position: {
            ...adjusted.position,
            y: adjusted.position.y - 1,
          },
        };
      }
    }

    this.gameState.currentPiece = adjusted;
  }

  getAbilityCostForCast(baseCost: number): number {
    if (this.overchargeCharges <= 0) return baseCost;
    return Math.max(0, Math.floor(baseCost * 0.6));
  }

  consumeAbilityCastModifiers(): void {
    if (this.overchargeCharges <= 0) return;
    this.overchargeCharges = Math.max(0, this.overchargeCharges - 1);
    this.syncCounterEffect('overcharge', this.overchargeCharges);
  }

  clearTimedEffects(): string[] {
    const cleared: string[] = [];

    for (const [effect, endTime] of Array.from(this.activeEffects.entries())) {
      const shouldClear = endTime !== INFINITE_EFFECT || effect === 'overcharge';
      if (!shouldClear) continue;

      this.activeEffects.delete(effect);
      this.handleEffectExpired(effect);
      cleared.push(effect);
    }

    this.refreshEffects(Date.now());
    return cleared;
  }

  /**
   * Apply ability effect (can be buff or debuff).
   * To add a new ability: add one switch-case branch.
   */
  applyAbility(abilityType: string): void {
    const now = Date.now();

    switch (abilityType) {
      // Debuff board / control / visual
      case 'earthquake':
        this.gameState.board = applyEarthquake(this.gameState.board, this.rng);
        break;
      case 'screen_shake':
        this.setTimedEffect('screen_shake', 5000, now);
        break;
      case 'ink_splash':
        this.setTimedEffect('ink_splash', 4000, now);
        break;
      case 'random_spawner':
        this.gameState.board = applyRandomSpawner(this.gameState.board, 4, this.rng);
        break;
      case 'garbage_rain':
        this.gameState.board = applyAddJunkRows(this.gameState.board, 2);
        break;
      case 'speed_up_opponent':
        this.setTimedEffect('speed_up_opponent', 8000, now);
        break;
      case 'reverse_controls':
        this.setTimedEffect('reverse_controls', 6000, now);
        break;
      case 'mirage':
        this.setTimedEffect('mirage', 5000, now);
        break;
      case 'gold_digger': {
        let board = applyGoldDigger(this.gameState.board, 6, this.rng);
        board = this.applyGravityToBoard(board);
        this.gameState.board = this.clearLinesWithoutRewards(board, false);
        break;
      }
      case 'column_swap': {
        let board = this.applyColumnSwap(this.gameState.board);
        board = this.clearLinesWithoutRewards(board, false);
        this.gameState.board = board;
        break;
      }
      case 'fog_of_war':
        this.setTimedEffect('fog_of_war', 8000, now);
        break;
      case 'rotation_lock':
        this.setTimedEffect('rotation_lock', 4000, now);
        break;
      case 'blind_spot':
        this.setTimedEffect('blind_spot', 5000, now);
        break;
      case 'weird_shapes':
        this.weirdShapesRemaining = 1;
        this.syncCounterEffect('weird_shapes', this.weirdShapesRemaining);
        break;
      case 'shapeshifter':
        this.shapeshifterPiecesRemaining = this.getPieceCount('shapeshifter', 3);
        this.syncCounterEffect('shapeshifter', this.shapeshifterPiecesRemaining);
        break;
      case 'shrink_ceiling':
        this.setTimedEffect('shrink_ceiling', 12000, now);
        break;
      case 'wide_load':
        this.activateWideLoad(now);
        break;
      case 'tilt':
        this.tiltDirection = this.rng.nextInt(2) === 0 ? -1 : 1;
        this.setTimedEffect('tilt', 10000, now);
        break;
      case 'flip_board': {
        let board = this.applyFlipBoard(this.gameState.board);
        board = this.clearLinesWithoutRewards(board, false);
        this.gameState.board = board;
        break;
      }
      case 'death_cross': {
        let board = this.applyDeathCross(this.gameState.board);
        board = this.clearLinesWithoutRewards(board, false);
        this.gameState.board = board;
        break;
      }
      case 'gravity_well': {
        let board = this.applyGravityToBoard(this.gameState.board);
        board = this.clearLinesWithoutRewards(board, false);
        this.gameState.board = board;
        break;
      }
      case 'quicksand':
        this.quicksandRemainingSinks = 3;
        this.quicksandNextSinkAtMs = now + 4000;
        this.setTimedEffect('quicksand', 12000, now);
        break;

      // Buff board / pieces / economy
      case 'mini_blocks':
        this.miniBlocksRemaining = this.getPieceCount('mini_blocks', 5);
        this.syncCounterEffect('mini_blocks', this.miniBlocksRemaining);
        break;
      case 'fill_holes': {
        const board = applyFillHoles(this.gameState.board);
        this.gameState.board = this.clearLinesWithoutRewards(board, false);
        break;
      }
      case 'clear_rows': {
        const { board } = applyClearRows(this.gameState.board, 4);
        this.gameState.board = board;
        break;
      }
      case 'circle_bomb':
        this.bombMode = { type: 'circle' };
        break;
      case 'cross_firebomb':
        this.bombMode = { type: 'cross' };
        break;
      case 'cascade_multiplier':
        this.setTimedEffect('cascade_multiplier', 15000, now);
        break;
      case 'time_warp':
        this.setTimedEffect('time_warp', 10000, now);
        break;
      case 'narrow_escape':
        this.activateNarrowEscape(now);
        break;
      case 'overcharge':
        this.overchargeCharges = this.getPieceCount('overcharge', 3);
        this.syncCounterEffect('overcharge', this.overchargeCharges);
        break;
      case 'magnet':
        this.magnetPiecesRemaining = this.getPieceCount('magnet', 3);
        if (this.gameState.currentPiece && !this.gameState.isGameOver) {
          const immediateTarget = this.findBestMagnetPlacement(this.gameState.currentPiece, this.gameState.board);
          if (immediateTarget) {
            this.currentPieceIsMagnetized = true;
            this.currentPieceMagnetTarget = immediateTarget;
            this.currentPieceSpawnedAtMs = now;
            this.currentPieceLastManualInputAtMs = now;
            this.magnetPiecesRemaining = Math.max(0, this.magnetPiecesRemaining - 1);
          }
        }
        this.syncMagnetCounterEffect();
        break;

      // Defensive
      case 'shield':
        this.setTimedEffect('shield', 15000, now);
        break;
      case 'reflect':
        this.setTimedEffect('reflect', 12000, now);
        break;

      // Multi-player-special abilities are resolved in GameRoomServer.
      case 'purge':
      case 'clone':
        break;

      default:
        console.warn(`[ServerGameState] Unknown ability type: ${abilityType}`);
        break;
    }

    this.refreshEffects(now);
  }

  /**
   * Get currently active effects
   */
  getActiveEffects(): string[] {
    const now = Date.now();
    this.refreshEffects(now);

    const active: string[] = [];
    for (const [ability, endTime] of this.activeEffects) {
      if (endTime === INFINITE_EFFECT || endTime > now) {
        active.push(ability);
      }
    }

    return active;
  }

  getTimedEffectSnapshots(now: number = Date.now()): Array<{ abilityType: string; remainingMs: number; durationMs: number }> {
    this.refreshEffects(now);
    const snapshots: Array<{ abilityType: string; remainingMs: number; durationMs: number }> = [];

    for (const [abilityType, endTime] of this.activeEffects) {
      if (endTime === INFINITE_EFFECT) continue;
      const remainingMs = Math.max(0, endTime - now);
      if (remainingMs <= 0) continue;

      const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
      const configuredDuration = typeof ability?.duration === 'number' ? ability.duration : undefined;
      const durationMs = configuredDuration && configuredDuration > 0 ? configuredDuration : remainingMs;

      snapshots.push({ abilityType, remainingMs, durationMs });
    }

    snapshots.sort((a, b) => a.remainingMs - b.remainingMs);
    return snapshots;
  }

  getPieceCountEffects(): Array<{ abilityType: string; remaining: number; total: number }> {
    const effects: Array<{ abilityType: string; remaining: number; total: number }> = [];

    if (this.miniBlocksRemaining > 0) {
      effects.push({ abilityType: 'mini_blocks', remaining: this.miniBlocksRemaining, total: 5 });
    }
    if (this.weirdShapesRemaining > 0) {
      effects.push({ abilityType: 'weird_shapes', remaining: this.weirdShapesRemaining, total: 1 });
    }
    if (this.shapeshifterPiecesRemaining > 0 || this.currentPieceIsShapeshifter) {
      const remaining = this.shapeshifterPiecesRemaining + (this.currentPieceIsShapeshifter ? 1 : 0);
      effects.push({ abilityType: 'shapeshifter', remaining, total: 3 });
    }
    if (this.magnetPiecesRemaining > 0 || this.currentPieceIsMagnetized) {
      const remaining = this.magnetPiecesRemaining + (this.currentPieceIsMagnetized ? 1 : 0);
      effects.push({ abilityType: 'magnet', remaining, total: 3 });
    }
    if (this.overchargeCharges > 0) {
      effects.push({ abilityType: 'overcharge', remaining: this.overchargeCharges, total: 3 });
    }

    return effects;
  }

  consumeDefensiveInterception(now: number = Date.now()): 'shield' | 'reflect' | null {
    // Reflect has priority over shield.
    if (this.isEffectActive('reflect', now)) {
      this.activeEffects.delete('reflect');
      return 'reflect';
    }

    if (this.isEffectActive('shield', now)) {
      this.activeEffects.delete('shield');
      return 'shield';
    }

    return null;
  }

  private setTimedEffect(abilityType: string, fallbackMs: number, now: number): void {
    const duration = this.getDurationMs(abilityType, fallbackMs);
    this.activeEffects.set(abilityType, now + duration);
  }

  private syncCounterEffect(abilityType: string, remaining: number): void {
    if (remaining > 0) {
      this.activeEffects.set(abilityType, INFINITE_EFFECT);
    } else {
      this.activeEffects.delete(abilityType);
    }
  }

  private refreshEffects(now: number): void {
    for (const [effect, endTime] of Array.from(this.activeEffects.entries())) {
      if (endTime === INFINITE_EFFECT) continue;
      if (endTime > now) continue;

      this.activeEffects.delete(effect);
      this.handleEffectExpired(effect);
    }

    this.processPeriodicEffects(now);
    this.updateTickRate(now);
  }

  private isEffectActive(effect: string, now: number): boolean {
    const endTime = this.activeEffects.get(effect);
    if (typeof endTime !== 'number') return false;
    if (endTime === INFINITE_EFFECT) return true;
    if (endTime > now) return true;

    this.activeEffects.delete(effect);
    this.handleEffectExpired(effect);
    return false;
  }

  private handleEffectExpired(effect: string): void {
    switch (effect) {
      case 'narrow_escape':
        this.restoreNarrowEscape();
        break;
      case 'wide_load':
        this.collapseWideLoad();
        break;
      case 'quicksand':
        this.quicksandRemainingSinks = 0;
        this.quicksandNextSinkAtMs = 0;
        break;
      case 'mini_blocks':
        this.miniBlocksRemaining = 0;
        break;
      case 'weird_shapes':
        this.weirdShapesRemaining = 0;
        break;
      case 'shapeshifter':
        this.shapeshifterPiecesRemaining = 0;
        this.currentPieceIsShapeshifter = false;
        break;
      case 'magnet':
        this.magnetPiecesRemaining = 0;
        this.currentPieceIsMagnetized = false;
        this.currentPieceMagnetTarget = null;
        break;
      case 'overcharge':
        this.overchargeCharges = 0;
        break;
      default:
        break;
    }
  }

  private processPeriodicEffects(now: number): void {
    if (!this.isEffectActive('quicksand', now)) return;

    while (this.quicksandRemainingSinks > 0 && now >= this.quicksandNextSinkAtMs) {
      this.gameState.board = this.applyQuicksandSink(this.gameState.board, 2);
      this.quicksandRemainingSinks--;
      this.quicksandNextSinkAtMs += 4000;
    }

    if (this.quicksandRemainingSinks <= 0) {
      this.activeEffects.delete('quicksand');
    }
  }

  private updateTickRate(now: number): void {
    let gravityMultiplier = 1;

    if (this.isEffectActive('speed_up_opponent', now)) {
      gravityMultiplier *= 2.5;
    }

    if (this.isEffectActive('time_warp', now)) {
      gravityMultiplier *= 0.5;
    }

    const computedTickRate = BASE_TICK_RATE_MS / gravityMultiplier;
    this.tickRate = Math.max(80, Math.round(computedTickRate));
  }

  private getDurationMs(abilityType: string, fallbackMs: number): number {
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    return typeof ability?.duration === 'number' ? ability.duration : fallbackMs;
  }

  private getPieceCount(abilityType: string, fallbackCount: number): number {
    const ability = ABILITIES[abilityType as keyof typeof ABILITIES];
    if (typeof ability?.duration !== 'number') return fallbackCount;
    return Math.max(0, Math.floor(ability.duration));
  }

  private applyPassiveStarRegen(now: number): void {
    if (this.gameState.isGameOver) return;
    const elapsedMs = now - this.lastPassiveRegenTickMs;
    if (elapsedMs < 1000) return;

    const regenTicks = Math.floor(elapsedMs / 1000);
    if (regenTicks <= 0) return;

    const starsToAdd = regenTicks * STAR_VALUES.passiveRegenPerSecond;
    this.gameState.stars = Math.min(STAR_VALUES.maxCapacity, this.gameState.stars + starsToAdd);
    this.lastPassiveRegenTickMs += regenTicks * 1000;
  }

  private activateNarrowEscape(now: number): void {
    // Remove opposing geometry mode first for deterministic restore behavior.
    if (this.activeEffects.has('wide_load')) {
      this.activeEffects.delete('wide_load');
      this.handleEffectExpired('wide_load');
    }

    if (this.gameState.board.width > 7) {
      this.narrowEscapeStoredColumns = this.gameState.board.grid.map((row) => row.slice(7, STANDARD_BOARD_WIDTH));
      this.gameState.board = {
        ...this.gameState.board,
        width: 7,
        grid: this.gameState.board.grid.map((row) => row.slice(0, 7)),
      };
      this.ensureCurrentPieceWithinBoard();
    }

    this.activeEffects.set('narrow_escape', now + this.getDurationMs('narrow_escape', 15000));
  }

  private restoreNarrowEscape(): void {
    if (!this.narrowEscapeStoredColumns) return;

    const restoredGrid = this.gameState.board.grid.map((row, y) => {
      const hidden = this.narrowEscapeStoredColumns?.[y] ?? [null, null, null];
      return [...row.slice(0, 7), ...hidden];
    });

    let board: Board = {
      ...this.gameState.board,
      width: STANDARD_BOARD_WIDTH,
      grid: restoredGrid,
    };

    board = this.applyGravityToBoard(board);
    board = this.clearLinesWithoutRewards(board, false);
    this.gameState.board = board;
    this.narrowEscapeStoredColumns = null;
    this.ensureCurrentPieceWithinBoard();
  }

  private activateWideLoad(now: number): void {
    // Remove opposing geometry mode first for deterministic restore behavior.
    if (this.activeEffects.has('narrow_escape')) {
      this.activeEffects.delete('narrow_escape');
      this.handleEffectExpired('narrow_escape');
    }

    if (this.gameState.board.width < WIDE_LOAD_BOARD_WIDTH) {
      const extraColumns = WIDE_LOAD_BOARD_WIDTH - this.gameState.board.width;
      this.gameState.board = {
        ...this.gameState.board,
        width: WIDE_LOAD_BOARD_WIDTH,
        grid: this.gameState.board.grid.map((row) => [
          ...row,
          ...Array.from({ length: extraColumns }, () => null),
        ]),
      };
      this.ensureCurrentPieceWithinBoard();
    }

    this.activeEffects.set('wide_load', now + this.getDurationMs('wide_load', 15000));
  }

  private collapseWideLoad(): void {
    if (this.gameState.board.width <= STANDARD_BOARD_WIDTH) return;

    this.gameState.board = {
      ...this.gameState.board,
      width: STANDARD_BOARD_WIDTH,
      grid: this.gameState.board.grid.map((row) => row.slice(0, STANDARD_BOARD_WIDTH)),
    };
    this.ensureCurrentPieceWithinBoard();
  }

  private syncMagnetCounterEffect(): void {
    const remainingAffectedPieces =
      this.magnetPiecesRemaining + (this.currentPieceIsMagnetized ? 1 : 0);
    this.syncCounterEffect('magnet', remainingAffectedPieces);
  }

  private applyColumnSwap(board: Board): Board {
    if (board.width < 2) return board;

    const colA = this.rng.nextInt(board.width);
    let colB = this.rng.nextInt(board.width - 1);
    if (colB >= colA) colB += 1;

    const grid = board.grid.map((row) => {
      const nextRow = [...row];
      const temp = nextRow[colA];
      nextRow[colA] = nextRow[colB];
      nextRow[colB] = temp;
      return nextRow;
    });

    return { ...board, grid };
  }

  private applyFlipBoard(board: Board): Board {
    const grid: CellValue[][] = Array.from({ length: board.height }, () => Array(board.width).fill(null));

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const flippedY = board.height - 1 - y;
        const flippedX = board.width - 1 - x;
        grid[flippedY][flippedX] = board.grid[y][x];
      }
    }

    return this.dropBoardAsWhole({ ...board, grid });
  }

  private applyDeathCross(board: Board): Board {
    const grid: CellValue[][] = board.grid.map((row) =>
      row.map((cell) => (cell === null ? this.randomCellType() : null))
    );

    return this.applyGravityToBoard({ ...board, grid });
  }

  private dropBoardAsWhole(board: Board): Board {
    let maxFilledY = -1;
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (board.grid[y][x] !== null) {
          maxFilledY = Math.max(maxFilledY, y);
        }
      }
    }

    if (maxFilledY < 0) return board;

    const shiftDown = board.height - 1 - maxFilledY;
    if (shiftDown <= 0) return board;

    const grid: CellValue[][] = Array.from({ length: board.height }, () => Array(board.width).fill(null));
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.grid[y][x];
        if (cell === null) continue;
        const targetY = y + shiftDown;
        if (targetY >= 0 && targetY < board.height) {
          grid[targetY][x] = cell;
        }
      }
    }

    return { ...board, grid };
  }

  private shouldAutoPlaceMagnetPiece(now: number): boolean {
    if (!this.currentPieceIsMagnetized) return false;
    if (!this.currentPieceMagnetTarget || !this.gameState.currentPiece) return false;
    if (now - this.currentPieceSpawnedAtMs < 900) return false;
    if (now - this.currentPieceLastManualInputAtMs < 900) return false;
    return true;
  }

  private snapToMagnetTarget(): void {
    if (!this.gameState.currentPiece || !this.currentPieceMagnetTarget) return;

    this.gameState.currentPiece = {
      ...this.gameState.currentPiece,
      rotation: this.currentPieceMagnetTarget.rotation,
      shape: this.getShapeForRotation(this.gameState.currentPiece, this.currentPieceMagnetTarget.rotation),
      position: {
        x: this.currentPieceMagnetTarget.x,
        y: this.currentPieceMagnetTarget.y,
      },
    };
    this.currentPieceIsMagnetized = false;
    this.currentPieceMagnetTarget = null;
  }

  private getShapeForRotation(piece: Tetromino, rotation: number): number[][] {
    const variants = TETROMINO_SHAPES[piece.type];
    if (!Array.isArray(variants) || variants.length === 0) {
      return piece.shape;
    }
    const normalized = ((rotation % variants.length) + variants.length) % variants.length;
    return variants[normalized];
  }

  private countBoardHoles(board: Board): number {
    let holes = 0;
    for (let x = 0; x < board.width; x++) {
      let seenFilled = false;
      for (let y = 0; y < board.height; y++) {
        if (board.grid[y][x] !== null) {
          seenFilled = true;
        } else if (seenFilled) {
          holes++;
        }
      }
    }
    return holes;
  }

  private findBestMagnetPlacement(
    piece: Tetromino | null,
    board: Board
  ): { x: number; y: number; rotation: number } | null {
    if (!piece) return null;

    const rotationVariants = TETROMINO_SHAPES[piece.type] ?? [piece.shape];
    const holesBefore = this.countBoardHoles(board);

    let best: { x: number; y: number; rotation: number; score: number } | null = null;

    for (let rotation = 0; rotation < rotationVariants.length; rotation++) {
      const shape = rotationVariants[rotation];
      const maxX = board.width - shape[0].length;
      for (let x = 0; x <= maxX; x++) {
        let candidate: Tetromino = {
          ...piece,
          rotation,
          shape,
          position: { x, y: 0 },
        };
        if (!isValidPosition(board, candidate)) continue;

        while (true) {
          const down = movePiece(candidate, 0, 1);
          if (!isValidPosition(board, down)) break;
          candidate = down;
        }

        const locked = lockPiece(board, candidate);
        const { board: cleared, linesCleared } = clearLines(locked);
        const holesAfter = this.countBoardHoles(cleared);
        const holesFilled = Math.max(0, holesBefore - holesAfter);
        const newHoles = Math.max(0, holesAfter - holesBefore);
        const score = linesCleared * 10 + holesFilled * 5 - newHoles * 8;

        if (!best || score > best.score) {
          best = { x, y: candidate.position.y, rotation, score };
        }
      }
    }

    if (!best) return null;
    return { x: best.x, y: best.y, rotation: best.rotation };
  }

  private applyGravityToBoard(board: Board): Board {
    const grid: CellValue[][] = Array.from({ length: board.height }, () => Array(board.width).fill(null));

    for (let x = 0; x < board.width; x++) {
      const column: CellValue[] = [];
      for (let y = board.height - 1; y >= 0; y--) {
        const cell = board.grid[y][x];
        if (cell !== null) column.push(cell);
      }

      for (let y = board.height - 1, i = 0; i < column.length; y--, i++) {
        grid[y][x] = column[i];
      }
    }

    return { ...board, grid };
  }

  private applyQuicksandSink(board: Board, rows: number): Board {
    const rowsToSink = Math.max(0, Math.min(rows, board.height));
    if (rowsToSink === 0) return board;

    const emptyRows: CellValue[][] = Array.from({ length: rowsToSink }, () =>
      Array(board.width).fill(null)
    );

    const remainingRows = board.grid.slice(0, board.height - rowsToSink);
    return {
      ...board,
      grid: [...emptyRows, ...remainingRows],
    };
  }

  /**
   * Clear completed rows after ability-driven board mutations without star rewards.
   */
  private clearLinesWithoutRewards(board: Board, countLines: boolean): Board {
    let current = board;
    let totalCleared = 0;

    while (true) {
      const { board: nextBoard, linesCleared } = clearLines(current);
      if (linesCleared === 0) break;
      totalCleared += linesCleared;
      current = nextBoard;
    }

    if (countLines && totalCleared > 0) {
      this.gameState.linesCleared += totalCleared;
    }

    return current;
  }

  private randomCellType(): TetrominoType {
    return TETROMINO_TYPES[this.rng.nextInt(TETROMINO_TYPES.length)];
  }

  private isPieceAboveRow(piece: Tetromino, rowExclusive: number): boolean {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (!piece.shape[y][x]) continue;
        const boardY = piece.position.y + y;
        if (boardY < rowExclusive) {
          return true;
        }
      }
    }

    return false;
  }

  private isBoardEmpty(board: Board): boolean {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (board.grid[y][x] !== null) return false;
      }
    }
    return true;
  }

  private isTSpinLock(piece: Tetromino, board: Board): boolean {
    if (!this.currentPieceRotatedSinceSpawn) return false;
    if (piece.type !== 'T') return false;

    const centerX = piece.position.x + 1;
    const centerY = piece.position.y + 1;
    const corners = [
      { x: centerX - 1, y: centerY - 1 },
      { x: centerX + 1, y: centerY - 1 },
      { x: centerX - 1, y: centerY + 1 },
      { x: centerX + 1, y: centerY + 1 },
    ];

    let blockedCorners = 0;
    for (const corner of corners) {
      if (
        corner.x < 0 ||
        corner.x >= board.width ||
        corner.y < 0 ||
        corner.y >= board.height ||
        board.grid[corner.y][corner.x] !== null
      ) {
        blockedCorners++;
      }
    }

    return blockedCorners >= 3;
  }

  /**
   * Get state for broadcasting (sanitized for opponent view)
   */
  getPublicState() {
    const now = Date.now();
    this.refreshEffects(now);
    const magnetGhost =
      this.currentPieceIsMagnetized && this.currentPieceMagnetTarget && this.gameState.currentPiece
        ? {
            ...this.gameState.currentPiece,
            rotation: this.currentPieceMagnetTarget.rotation,
            shape: this.getShapeForRotation(this.gameState.currentPiece, this.currentPieceMagnetTarget.rotation),
            position: {
              x: this.currentPieceMagnetTarget.x,
              y: this.currentPieceMagnetTarget.y,
            },
          }
        : null;

    return {
      board: this.gameState.board.grid,
      boardWidth: this.gameState.board.width,
      boardHeight: this.gameState.board.height,
      currentPiece: this.gameState.currentPiece,
      magnetGhost,
      nextPieces: this.gameState.nextPieces.slice(0, 5),
      score: this.gameState.score,
      stars: this.gameState.stars,
      linesCleared: this.gameState.linesCleared,
      comboCount: this.gameState.comboCount,
      isGameOver: this.gameState.isGameOver,
      activeEffects: this.getActiveEffects(),
      timedEffects: this.getTimedEffectSnapshots(now),
      pieceCountEffects: this.getPieceCountEffects(),
      tiltDirection: this.isEffectActive('tilt', now) ? this.tiltDirection : 0,
    };
  }
}
