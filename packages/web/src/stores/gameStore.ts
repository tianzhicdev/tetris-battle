import { create } from 'zustand';
import type { GameState, Tetromino, ActiveAbility } from '@tetris-battle/game-core';
import {
  createInitialGameState,
  createTetromino,
  getRandomTetromino,
  movePiece,
  rotatePiece,
  lockPiece,
  clearLines,
  isValidPosition,
  calculateStars,
  getHardDropPosition,
  STAR_VALUES,
  applyCrossBomb,
  applyCircleBomb,
  createMiniBlock,
  applyWeirdShapes,
} from '@tetris-battle/game-core';

interface GameStore {
  gameState: GameState;
  ghostPiece: Tetromino | null;
  activeAbilities: ActiveAbility[];
  isPaused: boolean;
  isCascadeMultiplierActive: boolean; // Track cascade multiplier state
  miniBlocksRemaining: number; // Track how many mini block pieces to spawn
  weirdShapesRemaining: number; // Track how many weird shape pieces to spawn
  shrinkCeilingRows: number; // Track number of rows blocked from top
  piecePreviewCount: number; // 1 = normal, 5 = piece preview+ active
  hasDeflectShield: boolean; // Active deflect shield that blocks next debuff
  onBombExplode: ((x: number, y: number, type: 'cross' | 'circle') => void) | null;

  // Actions
  initGame: () => void;
  spawnPiece: () => void;
  movePieceLeft: () => void;
  movePieceRight: () => void;
  movePieceDown: () => void;
  rotatePieceClockwise: () => void;
  rotatePieceCounterClockwise: () => void;
  hardDrop: () => void;
  updateGhostPiece: () => void;
  tick: () => void;
  togglePause: () => void;
  updateBoard: (newBoard: any) => void;
  deductStars: (cost: number) => void;
  setBombType: (bombType: 'cross' | 'circle' | null) => void;
  setCascadeMultiplier: (active: boolean) => void;
  setMiniBlocksRemaining: (count: number) => void;
  setWeirdShapesRemaining: (count: number) => void;
  setShrinkCeilingRows: (rows: number) => void;
  setPiecePreviewCount: (count: number) => void;
  setHasDeflectShield: (active: boolean) => void;
  setOnBombExplode: (callback: (x: number, y: number, type: 'cross' | 'circle') => void) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialGameState(),
  ghostPiece: null,
  activeAbilities: [],
  isPaused: false,
  isCascadeMultiplierActive: false,
  miniBlocksRemaining: 0,
  weirdShapesRemaining: 0,
  shrinkCeilingRows: 0,
  piecePreviewCount: 1,
  hasDeflectShield: false,
  onBombExplode: null,

  initGame: () => {
    const initialState = createInitialGameState();
    const firstPiece = initialState.nextPieces[0];

    // Check for test mode (URL parameter ?testMode=true)
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.get('testMode') === 'true';
    const startingStars = isTestMode ? STAR_VALUES.maxCapacity : STAR_VALUES.startingPool;

    set({
      gameState: {
        ...initialState,
        currentPiece: createTetromino(firstPiece, initialState.board.width),
        stars: startingStars,
      },
      activeAbilities: [],
      isPaused: false,
    });

    get().updateGhostPiece();
  },

  spawnPiece: () => {
    const { gameState, miniBlocksRemaining, weirdShapesRemaining, shrinkCeilingRows } = get();

    let newPiece: Tetromino;
    const nextType = gameState.nextPieces[0];

    // Check if we should spawn a mini block
    if (miniBlocksRemaining > 0) {
      newPiece = createMiniBlock();
      set({ miniBlocksRemaining: miniBlocksRemaining - 1 });
    }
    // Check if we should spawn a weird shape
    else if (weirdShapesRemaining > 0) {
      const basePiece = createTetromino(nextType, gameState.board.width);
      newPiece = applyWeirdShapes(basePiece);
      set({ weirdShapesRemaining: weirdShapesRemaining - 1 });
    }
    else {
      newPiece = createTetromino(nextType, gameState.board.width);
    }

    // Offset spawn position if ceiling is shrunk
    if (shrinkCeilingRows > 0) {
      newPiece = {
        ...newPiece,
        position: { ...newPiece.position, y: newPiece.position.y + shrinkCeilingRows },
      };
    }

    // Shift queue and add new piece to end
    const newNextPieces = [...gameState.nextPieces.slice(1), getRandomTetromino()];

    // Check game over
    if (!isValidPosition(gameState.board, newPiece)) {
      set({
        gameState: {
          ...gameState,
          isGameOver: true,
        },
      });
      return;
    }

    set({
      gameState: {
        ...gameState,
        currentPiece: newPiece,
        nextPieces: newNextPieces,
      },
    });

    get().updateGhostPiece();
  },

  movePieceLeft: () => {
    const { gameState } = get();
    if (!gameState.currentPiece || gameState.isGameOver) return;

    const newPiece = movePiece(gameState.currentPiece, -1, 0);
    if (isValidPosition(gameState.board, newPiece)) {
      set({
        gameState: {
          ...gameState,
          currentPiece: newPiece,
        },
      });
      get().updateGhostPiece();
    }
  },

  movePieceRight: () => {
    const { gameState } = get();
    if (!gameState.currentPiece || gameState.isGameOver) return;

    const newPiece = movePiece(gameState.currentPiece, 1, 0);
    if (isValidPosition(gameState.board, newPiece)) {
      set({
        gameState: {
          ...gameState,
          currentPiece: newPiece,
        },
      });
      get().updateGhostPiece();
    }
  },

  movePieceDown: () => {
    const { gameState } = get();
    if (!gameState.currentPiece || gameState.isGameOver) return;

    const newPiece = movePiece(gameState.currentPiece, 0, 1);
    if (isValidPosition(gameState.board, newPiece)) {
      set({
        gameState: {
          ...gameState,
          currentPiece: newPiece,
        },
      });
    } else {
      // Lock piece
      let boardAfterLock = lockPiece(gameState.board, gameState.currentPiece);

      // Check if piece is a bomb - apply bomb effect at landing position
      if (gameState.bombType) {
        const centerX = gameState.currentPiece.position.x + Math.floor(gameState.currentPiece.shape[0].length / 2);
        const centerY = gameState.currentPiece.position.y + Math.floor(gameState.currentPiece.shape.length / 2);

        console.log(`Bomb landed at (${centerX}, ${centerY}) - Type: ${gameState.bombType}`);

        // Trigger explosion animation
        if (get().onBombExplode) {
          get().onBombExplode!(centerX, centerY, gameState.bombType);
        }

        if (gameState.bombType === 'cross') {
          boardAfterLock = applyCrossBomb(boardAfterLock, centerX, centerY);
        } else if (gameState.bombType === 'circle') {
          boardAfterLock = applyCircleBomb(boardAfterLock, centerX, centerY, 3);
        }
      }

      const { board: clearedBoard, linesCleared } = clearLines(boardAfterLock);

      // Calculate stars and check combo
      const now = Date.now();
      const isCombo = now - gameState.lastClearTime < STAR_VALUES.comboWindow;
      const comboCount = linesCleared > 0 && isCombo ? gameState.comboCount + 1 : 0;
      let starsEarned = calculateStars(linesCleared, comboCount);

      // Apply cascade multiplier (doubles stars earned)
      if (get().isCascadeMultiplierActive) {
        starsEarned *= 2;
      }

      const newStars = Math.min(
        gameState.stars + starsEarned,
        STAR_VALUES.maxCapacity
      );

      set({
        gameState: {
          ...gameState,
          board: clearedBoard,
          currentPiece: null,
          score: gameState.score + linesCleared * 100,
          stars: newStars,
          linesCleared: gameState.linesCleared + linesCleared,
          lastClearTime: linesCleared > 0 ? now : gameState.lastClearTime,
          comboCount,
          bombType: null, // Clear bomb flag after it lands
        },
      });

      // Spawn next piece
      setTimeout(() => get().spawnPiece(), 100);
    }
  },

  rotatePieceClockwise: () => {
    const { gameState } = get();
    if (!gameState.currentPiece || gameState.isGameOver) return;

    const newPiece = rotatePiece(gameState.currentPiece, true);
    if (isValidPosition(gameState.board, newPiece)) {
      set({
        gameState: {
          ...gameState,
          currentPiece: newPiece,
        },
      });
      get().updateGhostPiece();
    }
  },

  rotatePieceCounterClockwise: () => {
    const { gameState } = get();
    if (!gameState.currentPiece || gameState.isGameOver) return;

    const newPiece = rotatePiece(gameState.currentPiece, false);
    if (isValidPosition(gameState.board, newPiece)) {
      set({
        gameState: {
          ...gameState,
          currentPiece: newPiece,
        },
      });
      get().updateGhostPiece();
    }
  },

  hardDrop: () => {
    const { gameState } = get();
    if (!gameState.currentPiece || gameState.isGameOver) return;

    const dropPosition = getHardDropPosition(gameState.board, gameState.currentPiece);
    const droppedPiece = { ...gameState.currentPiece, position: dropPosition };

    set({
      gameState: {
        ...gameState,
        currentPiece: droppedPiece,
      },
    });

    // Immediately lock the piece
    setTimeout(() => get().movePieceDown(), 50);
  },

  updateGhostPiece: () => {
    const { gameState } = get();
    if (!gameState.currentPiece) {
      set({ ghostPiece: null });
      return;
    }

    const ghostPosition = getHardDropPosition(gameState.board, gameState.currentPiece);
    const ghostPiece = { ...gameState.currentPiece, position: ghostPosition };

    set({ ghostPiece });
  },

  tick: () => {
    const { isPaused } = get();
    if (!isPaused) {
      get().movePieceDown();
    }
  },

  togglePause: () => {
    set(state => ({ isPaused: !state.isPaused }));
  },

  updateBoard: (newBoard: any) => {
    const { gameState } = get();
    set({
      gameState: {
        ...gameState,
        board: newBoard,
      },
    });
  },

  deductStars: (cost: number) => {
    const { gameState } = get();
    set({
      gameState: {
        ...gameState,
        stars: Math.max(0, gameState.stars - cost),
      },
    });
  },

  setBombType: (bombType: 'cross' | 'circle' | null) => {
    const { gameState } = get();
    set({
      gameState: {
        ...gameState,
        bombType,
      },
    });
  },

  setCascadeMultiplier: (active: boolean) => {
    set({ isCascadeMultiplierActive: active });
  },

  setMiniBlocksRemaining: (count: number) => {
    set({ miniBlocksRemaining: count });
  },

  setWeirdShapesRemaining: (count: number) => {
    set({ weirdShapesRemaining: count });
  },

  setShrinkCeilingRows: (rows: number) => {
    set({ shrinkCeilingRows: rows });
  },

  setPiecePreviewCount: (count: number) => {
    set({ piecePreviewCount: count });
  },

  setHasDeflectShield: (active: boolean) => {
    set({ hasDeflectShield: active });
  },

  setOnBombExplode: (callback: (x: number, y: number, type: 'cross' | 'circle') => void) => {
    set({ onBombExplode: callback });
  },
}));
