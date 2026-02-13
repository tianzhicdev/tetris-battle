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
} from '@tetris-battle/game-core';

interface GameStore {
  gameState: GameState;
  ghostPiece: Tetromino | null;
  activeAbilities: ActiveAbility[];
  isPaused: boolean;

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
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialGameState(),
  ghostPiece: null,
  activeAbilities: [],
  isPaused: false,

  initGame: () => {
    const initialState = createInitialGameState();
    const firstPiece = getRandomTetromino();
    const nextPiece = getRandomTetromino();

    // Check for test mode (URL parameter ?testMode=true)
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.get('testMode') === 'true';
    const startingStars = isTestMode ? STAR_VALUES.maxCapacity : STAR_VALUES.startingPool;

    set({
      gameState: {
        ...initialState,
        currentPiece: createTetromino(firstPiece, initialState.board.width),
        nextPiece,
        stars: startingStars,
      },
      activeAbilities: [],
      isPaused: false,
    });

    get().updateGhostPiece();
  },

  spawnPiece: () => {
    const { gameState } = get();
    const newPiece = createTetromino(gameState.nextPiece, gameState.board.width);
    const nextPiece = getRandomTetromino();

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
        nextPiece,
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
      const newBoard = lockPiece(gameState.board, gameState.currentPiece);
      const { board: clearedBoard, linesCleared } = clearLines(newBoard);

      // Calculate stars and check combo
      const now = Date.now();
      const isCombo = now - gameState.lastClearTime < STAR_VALUES.comboWindow;
      const comboCount = linesCleared > 0 && isCombo ? gameState.comboCount + 1 : 0;
      const starsEarned = calculateStars(linesCleared, comboCount);
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
}));
