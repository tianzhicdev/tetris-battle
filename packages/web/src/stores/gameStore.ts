import { create } from 'zustand';
import type { GameState, Tetromino, ActiveAbility, PlayerInputType } from '@tetris-battle/game-core';
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
import { audioManager } from '../services/audioManager';
import type { PendingInput } from '../types/prediction';
import { MAX_PENDING_INPUTS } from '../types/prediction';
import { applyInputAction, areStatesEqual } from '../utils/predictionHelpers';

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

  // Client-side prediction (server-auth mode only)
  serverState: GameState | null;    // Last confirmed state from server
  predictedState: GameState | null; // Current optimistic state (rendered)
  pendingInputs: PendingInput[];    // Queue of inputs awaiting confirmation
  inputSequence: number;             // Monotonic counter for input sequencing
  isPredictionMode: boolean;         // Whether prediction is active
  onMisprediction: (() => void) | null;

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

  // Prediction methods
  setPredictionMode: (enabled: boolean) => void;
  setServerState: (state: GameState) => void;
  setPredictedState: (state: GameState) => void;
  predictInput: (action: PlayerInputType) => number | null; // Returns seq number
  reconcileWithServer: (confirmedSeq: number, serverState: any) => void;
  handleInputRejection: (rejectedSeq: number, serverState: any) => void;
  setOnMisprediction: (callback: () => void) => void;
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

  // Prediction state
  serverState: null,
  predictedState: null,
  pendingInputs: [],
  inputSequence: 0,
  isPredictionMode: false,
  onMisprediction: null,

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

      // Play line clear sound based on number of lines
      if (linesCleared > 0) {
        if (linesCleared === 1) {
          audioManager.playSfx('line_clear_single');
        } else if (linesCleared === 2) {
          audioManager.playSfx('line_clear_double');
        } else if (linesCleared === 3) {
          audioManager.playSfx('line_clear_triple');
        } else if (linesCleared >= 4) {
          audioManager.playSfx('line_clear_tetris');
        }
      }

      // Calculate stars and check combo
      const now = Date.now();
      const isCombo = now - gameState.lastClearTime < STAR_VALUES.comboWindow;
      const comboCount = linesCleared > 0 && isCombo ? gameState.comboCount + 1 : 0;
      let starsEarned = calculateStars(linesCleared, comboCount);

      // Play combo sound
      if (comboCount > 0) {
        audioManager.playSfx('combo');
      }

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

  // Prediction methods (placeholder implementations)
  setPredictionMode: (enabled: boolean) => {
    set({ isPredictionMode: enabled });
  },

  setServerState: (state: GameState) => {
    set({ serverState: state });
  },

  setPredictedState: (state: GameState) => {
    set({ predictedState: state });
  },

  predictInput: (action: PlayerInputType) => {
    const { isPredictionMode, predictedState, pendingInputs, inputSequence, gameState } = get();

    // If prediction mode not enabled, return null
    if (!isPredictionMode) {
      return null;
    }

    // Use predicted state if available, otherwise use game state
    const currentState = predictedState || gameState;

    // Generate next sequence number
    const seq = inputSequence + 1;

    // Apply action using helper
    const newState = applyInputAction(currentState, action);

    // If action failed validation, don't predict (return null)
    if (!newState) {
      console.warn('[PREDICTION] Action failed validation:', action);
      return null;
    }

    // Create pending input entry
    const pendingInput: PendingInput = {
      seq,
      action,
      predictedState: newState,
      timestamp: Date.now(),
    };

    // Check queue limit
    let newPendingInputs = [...pendingInputs, pendingInput];
    if (newPendingInputs.length > MAX_PENDING_INPUTS) {
      console.warn('[PREDICTION] Queue overflow, dropping oldest input');
      newPendingInputs = newPendingInputs.slice(1);
    }

    // Update store
    set({
      predictedState: newState,
      pendingInputs: newPendingInputs,
      inputSequence: seq,
    });

    return seq;
  },

  reconcileWithServer: (confirmedSeq: number, serverState: any) => {
    const { pendingInputs, predictedState, onMisprediction } = get();

    // Remove all inputs with seq <= confirmedSeq
    const remainingInputs = pendingInputs.filter(input => input.seq > confirmedSeq);

    // Update server state
    set({ serverState });

    // Compare server state to predicted state
    const statesMatch = predictedState && areStatesEqual(predictedState, serverState);

    if (statesMatch) {
      // Perfect prediction! No visual change needed
      console.log('[PREDICTION] Perfect match for seq', confirmedSeq);
      set({ pendingInputs: remainingInputs });
      return;
    }

    // Misprediction detected
    console.warn('[MISPREDICTION] Server state differs from prediction', {
      seq: confirmedSeq,
      predicted: predictedState?.currentPiece,
      actual: serverState.currentPiece,
      pendingCount: remainingInputs.length,
    });

    // Snap to server state
    let reconciledState = serverState;

    // Replay remaining pending inputs
    for (const input of remainingInputs) {
      const newState = applyInputAction(reconciledState, input.action);
      if (newState) {
        reconciledState = newState;
        // Update the pending input's predicted state
        input.predictedState = newState;
      } else {
        // Input no longer valid, remove it
        console.warn('[PREDICTION] Replay failed for action:', input.action);
      }
    }

    // Update state and trigger misprediction callback
    set({
      predictedState: reconciledState,
      pendingInputs: remainingInputs.filter(input =>
        applyInputAction(reconciledState, input.action) !== null
      ),
    });

    // Trigger visual feedback
    if (onMisprediction) {
      onMisprediction();
    }
  },

  handleInputRejection: (rejectedSeq: number, serverState: any) => {
    const { pendingInputs, onMisprediction } = get();

    console.error('[INPUT REJECTED] Seq:', rejectedSeq, 'Reason:', serverState.reason || 'unknown');

    // Remove the rejected input and all older inputs
    const remainingInputs = pendingInputs.filter(input => input.seq > rejectedSeq);

    // Snap to server state (same as misprediction)
    let reconciledState = serverState;

    // Replay remaining inputs
    for (const input of remainingInputs) {
      const newState = applyInputAction(reconciledState, input.action);
      if (newState) {
        reconciledState = newState;
        input.predictedState = newState;
      }
    }

    set({
      serverState,
      predictedState: reconciledState,
      pendingInputs: remainingInputs,
    });

    // Trigger visual feedback
    if (onMisprediction) {
      onMisprediction();
    }
  },

  setOnMisprediction: (callback: () => void) => {
    set({ onMisprediction: callback });
  },
}));
