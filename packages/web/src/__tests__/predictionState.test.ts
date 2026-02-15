import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createInitialGameState, createTetromino } from '@tetris-battle/game-core';

describe('Prediction State Management', () => {
  beforeEach(() => {
    useGameStore.setState({
      serverState: null,
      predictedState: null,
      pendingInputs: [],
      inputSequence: 0,
      isPredictionMode: false,
      gameState: createInitialGameState(),
    });
  });

  it('should initialize with prediction mode disabled', () => {
    const { isPredictionMode } = useGameStore.getState();
    expect(isPredictionMode).toBe(false);
  });

  it('should enable prediction mode', () => {
    useGameStore.getState().setPredictionMode(true);
    expect(useGameStore.getState().isPredictionMode).toBe(true);
  });

  it('should set server state', () => {
    const mockState = { score: 100, stars: 50 } as any;
    useGameStore.getState().setServerState(mockState);
    expect(useGameStore.getState().serverState).toEqual(mockState);
  });

  describe('predictInput', () => {
    it('should return seq number when prediction enabled', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      useGameStore.setState({
        isPredictionMode: true,
        gameState,
        inputSequence: 0,
      });

      const seq = useGameStore.getState().predictInput('move_left');

      expect(seq).toBe(1);
    });

    it('should return null when prediction disabled', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      useGameStore.setState({
        isPredictionMode: false,
        gameState,
      });

      const seq = useGameStore.getState().predictInput('move_left');

      expect(seq).toBeNull();
    });

    it('should update predictedState', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      useGameStore.setState({
        isPredictionMode: true,
        gameState,
      });

      const originalX = gameState.currentPiece!.position.x;
      useGameStore.getState().predictInput('move_left');

      const { predictedState } = useGameStore.getState();
      expect(predictedState).not.toBeNull();
      expect(predictedState!.currentPiece!.position.x).toBe(originalX - 1);
    });

    it('should add to pendingInputs queue', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      useGameStore.setState({
        isPredictionMode: true,
        gameState,
      });

      useGameStore.getState().predictInput('move_left');

      const { pendingInputs } = useGameStore.getState();
      expect(pendingInputs.length).toBe(1);
      expect(pendingInputs[0].action).toBe('move_left');
      expect(pendingInputs[0].seq).toBe(1);
    });

    it('should increment inputSequence', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      useGameStore.setState({
        isPredictionMode: true,
        gameState,
        inputSequence: 5,
      });

      useGameStore.getState().predictInput('move_left');

      expect(useGameStore.getState().inputSequence).toBe(6);
    });

    it('should enforce MAX_PENDING_INPUTS limit', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      // Create 50 pending inputs (at the limit)
      const pendingInputs = Array.from({ length: 50 }, (_, i) => ({
        seq: i + 1,
        action: 'move_left' as const,
        predictedState: gameState,
        timestamp: Date.now(),
      }));

      useGameStore.setState({
        isPredictionMode: true,
        gameState,
        pendingInputs,
        inputSequence: 50,
      });

      useGameStore.getState().predictInput('move_right');

      const { pendingInputs: newPendingInputs } = useGameStore.getState();
      // Should still be at max (50), with oldest dropped
      expect(newPendingInputs.length).toBe(50);
      expect(newPendingInputs[0].seq).toBe(2); // First one was seq=1, now dropped
      expect(newPendingInputs[newPendingInputs.length - 1].seq).toBe(51);
    });

    it('should return null for invalid action', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: {
          ...createTetromino('I', 10),
          position: { x: 0, y: 0 }, // At left edge
        },
      };

      useGameStore.setState({
        isPredictionMode: true,
        gameState,
      });

      const seq = useGameStore.getState().predictInput('move_left');

      expect(seq).toBeNull();
    });
  });

  describe('reconcileWithServer', () => {
    it('should remove confirmed inputs from queue', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const pendingInputs = [
        { seq: 1, action: 'move_left' as const, predictedState: gameState, timestamp: Date.now() },
        { seq: 2, action: 'move_right' as const, predictedState: gameState, timestamp: Date.now() },
        { seq: 3, action: 'rotate_cw' as const, predictedState: gameState, timestamp: Date.now() },
      ];

      useGameStore.setState({
        pendingInputs,
        predictedState: gameState,
      });

      // Confirm seq 2
      useGameStore.getState().reconcileWithServer(2, gameState);

      const { pendingInputs: remaining } = useGameStore.getState();
      expect(remaining.length).toBe(1);
      expect(remaining[0].seq).toBe(3);
    });

    it('should not trigger callback with matching states', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
        score: 100,
        stars: 50,
      };

      const pendingInputs = [
        { seq: 1, action: 'move_left' as const, predictedState: gameState, timestamp: Date.now() },
      ];

      let callbackTriggered = false;

      useGameStore.setState({
        pendingInputs,
        predictedState: gameState,
        onMisprediction: () => { callbackTriggered = true; },
      });

      useGameStore.getState().reconcileWithServer(1, gameState);

      expect(callbackTriggered).toBe(false);
    });

    it('should trigger callback with misprediction', () => {
      const predictedState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
        score: 100,
      };

      const serverState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
        score: 200, // Different score!
      };

      let callbackTriggered = false;

      useGameStore.setState({
        pendingInputs: [],
        predictedState,
        onMisprediction: () => { callbackTriggered = true; },
      });

      useGameStore.getState().reconcileWithServer(1, serverState);

      expect(callbackTriggered).toBe(true);
    });

    it('should replay remaining pending inputs', () => {
      const serverState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
        score: 100,
      };

      const predictedState = {
        ...serverState,
        score: 200, // Mispredicted score
      };

      const pendingInputs = [
        { seq: 1, action: 'move_left' as const, predictedState, timestamp: Date.now() },
        { seq: 2, action: 'move_right' as const, predictedState, timestamp: Date.now() },
      ];

      useGameStore.setState({
        pendingInputs,
        predictedState,
      });

      // Confirm seq 1, but server state differs
      useGameStore.getState().reconcileWithServer(1, serverState);

      const { predictedState: newPredictedState, pendingInputs: remaining } = useGameStore.getState();

      // Should have replayed seq 2 (move_right)
      expect(remaining.length).toBe(1);
      expect(remaining[0].seq).toBe(2);

      // Predicted state should be server state + replayed move_right
      expect(newPredictedState!.currentPiece!.position.x).toBe(
        serverState.currentPiece!.position.x + 1
      );
    });

    it('should update serverState', () => {
      const serverState = {
        ...createInitialGameState(),
        score: 100,
      };

      useGameStore.setState({
        serverState: null,
      });

      useGameStore.getState().reconcileWithServer(1, serverState);

      expect(useGameStore.getState().serverState).toEqual(serverState);
    });

    it('should remove invalid inputs during replay', () => {
      const serverState = {
        ...createInitialGameState(),
        currentPiece: {
          ...createTetromino('I', 10),
          position: { x: 0, y: 0 }, // At left edge
        },
        score: 100,
      };

      const predictedState = {
        ...serverState,
        score: 200, // Different to trigger misprediction
      };

      const pendingInputs = [
        { seq: 1, action: 'move_left' as const, predictedState, timestamp: Date.now() },
        { seq: 2, action: 'move_left' as const, predictedState, timestamp: Date.now() }, // Invalid - would go off board
      ];

      useGameStore.setState({
        pendingInputs,
        predictedState,
      });

      useGameStore.getState().reconcileWithServer(1, serverState);

      const { pendingInputs: remaining } = useGameStore.getState();

      // Invalid input should be removed during replay
      expect(remaining.length).toBe(0);
    });
  });

  describe('handleInputRejection', () => {
    it('should remove rejected input from queue', () => {
      const gameState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const pendingInputs = [
        { seq: 1, action: 'move_left' as const, predictedState: gameState, timestamp: Date.now() },
        { seq: 2, action: 'move_right' as const, predictedState: gameState, timestamp: Date.now() },
        { seq: 3, action: 'rotate_cw' as const, predictedState: gameState, timestamp: Date.now() },
      ];

      useGameStore.setState({
        pendingInputs,
      });

      // Reject seq 2
      useGameStore.getState().handleInputRejection(2, gameState);

      const { pendingInputs: remaining } = useGameStore.getState();
      expect(remaining.length).toBe(1);
      expect(remaining[0].seq).toBe(3);
    });

    it('should snap to server state', () => {
      const serverState = {
        ...createInitialGameState(),
        score: 100,
        currentPiece: createTetromino('I', 10),
      };

      useGameStore.setState({
        predictedState: {
          ...serverState,
          score: 200,
        },
      });

      useGameStore.getState().handleInputRejection(1, serverState);

      expect(useGameStore.getState().serverState).toEqual(serverState);
      expect(useGameStore.getState().predictedState!.score).toBe(100);
    });

    it('should replay remaining inputs', () => {
      const serverState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      const pendingInputs = [
        { seq: 1, action: 'move_left' as const, predictedState: serverState, timestamp: Date.now() },
        { seq: 2, action: 'move_right' as const, predictedState: serverState, timestamp: Date.now() },
      ];

      useGameStore.setState({
        pendingInputs,
      });

      useGameStore.getState().handleInputRejection(1, serverState);

      const { predictedState } = useGameStore.getState();

      // Should have replayed seq 2 (move_right)
      expect(predictedState!.currentPiece!.position.x).toBe(
        serverState.currentPiece!.position.x + 1
      );
    });

    it('should trigger misprediction callback', () => {
      const serverState = {
        ...createInitialGameState(),
        currentPiece: createTetromino('I', 10),
      };

      let callbackTriggered = false;

      useGameStore.setState({
        onMisprediction: () => { callbackTriggered = true; },
      });

      useGameStore.getState().handleInputRejection(1, serverState);

      expect(callbackTriggered).toBe(true);
    });
  });
});
