import type * as Party from 'partykit/server';
import { TETROMINO_SHAPES } from '@tetris-battle/game-core';
import {
  DefenseLineGameState,
  type DefenseLinePlayer,
} from './DefenseLineGameState';
import { DefenseLineAI } from './DefenseLineAI';

interface JoinPayload {
  playerId: string;
  aiOpponent?: {
    enabled?: boolean;
    reactionCadenceMs?: number;
  };
}

type DefenseLineInput =
  | { type: 'move'; direction: 'left' | 'right' }
  | { type: 'rotate'; direction: 'cw' | 'ccw' }
  | { type: 'soft_drop' }
  | { type: 'hard_drop' };

const TICK_MS = 700;
const AI_FALLBACK_MS = 10_000; // 10 seconds before AI joins
const DEFAULT_AI_MOVE_INTERVAL_MS = 180;

export default class DefenseLineServer implements Party.Server {
  readonly room: Party.Room;
  private gameState: DefenseLineGameState;
  private readonly sideToConnection = new Map<DefenseLinePlayer, Party.Connection>();
  private readonly sideToPlayerId = new Map<DefenseLinePlayer, string>();
  private readonly connectionToSide = new Map<string, DefenseLinePlayer>();

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private countdownSafetyTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownDeadlineAt: number | null = null;
  private gameLoop: ReturnType<typeof setInterval> | null = null;
  private aiFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private aiMoveTimer: ReturnType<typeof setInterval> | null = null;

  // AI state
  private aiSide: DefenseLinePlayer | null = null;
  private readonly ai = new DefenseLineAI();
  private aiMoveQueue: Array<'move_left' | 'move_right' | 'rotate_cw' | 'hard_drop'> = [];
  private aiMoveIntervalMs: number = DEFAULT_AI_MOVE_INTERVAL_MS;

  constructor(room: Party.Room) {
    this.room = room;
    const seed = parseInt(room.id.substring(0, 8), 36) || Date.now();
    this.gameState = new DefenseLineGameState(seed);
  }

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({
      type: 'room_state',
      status: this.gameState.status,
      players: {
        a: this.sideToPlayerId.get('a') ?? null,
        b: this.sideToPlayerId.get('b') ?? null,
      },
    }));

    conn.send(JSON.stringify({
      type: 'state',
      state: this.gameState.getPublicState(),
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: any;

    try {
      data = JSON.parse(message);
    } catch {
      sender.send(JSON.stringify({ type: 'error', message: 'invalid_json' }));
      return;
    }

    switch (data.type) {
      case 'join':
        this.handleJoin(sender, data);
        return;
      case 'ready':
        this.ensureCountdownStart();
        this.maybeStartCountdown();
        return;
      case 'move':
      case 'rotate':
      case 'soft_drop':
      case 'hard_drop':
        this.ensureCountdownStart();
        this.handleInput(sender, data as DefenseLineInput);
        return;
      default:
        sender.send(JSON.stringify({ type: 'error', message: `unsupported_message:${String(data.type)}` }));
    }
  }

  onClose(conn: Party.Connection) {
    const side = this.connectionToSide.get(conn.id);
    if (!side) {
      return;
    }

    const mapped = this.sideToConnection.get(side);
    if (mapped?.id === conn.id) {
      this.sideToConnection.delete(side);
    }

    this.connectionToSide.delete(conn.id);
    this.sideToPlayerId.delete(side);

    if (this.gameState.status === 'playing' || this.gameState.status === 'countdown' || this.gameState.status === 'finished') {
      this.stopAll();
      this.resetGameState();
    }

    this.cancelAIFallback();

    this.broadcastRoomState();
    this.broadcastState();
  }

  // ------- Join & Assignment -------

  private handleJoin(conn: Party.Connection, payload: JoinPayload): void {
    if (!payload.playerId) {
      conn.send(JSON.stringify({ type: 'error', message: 'missing_player_id' }));
      return;
    }

    // Auto-assign: first player gets 'a', second gets 'b'
    const assigned = this.assignPlayer(conn, payload.playerId);

    if (!assigned) {
      conn.send(JSON.stringify({ type: 'error', message: 'room_full' }));
      return;
    }

    conn.send(JSON.stringify({
      type: 'join_ack',
      player: assigned,
    }));

    this.broadcastRoomState();
    this.broadcastState();

    // Check if both sides are filled (human or AI)
    const aiOpponentOptions = payload.aiOpponent;
    const immediateAIRequested =
      aiOpponentOptions?.enabled === true &&
      this.room.id.startsWith('local_defenseline_');

    if (this.sideToPlayerId.has('a') && this.sideToPlayerId.has('b')) {
      this.maybeStartCountdown();
    } else if (immediateAIRequested) {
      this.aiMoveIntervalMs = this.sanitizeAIMoveInterval(aiOpponentOptions?.reactionCadenceMs);
      this.spawnAI();
    } else {
      // Only one human player — start AI fallback timer
      this.scheduleAIFallback();
    }
  }

  private assignPlayer(conn: Party.Connection, playerId: string): DefenseLinePlayer | null {
    // Reconnection: if playerId already has a side, rejoin
    const existingSide = this.getSideByPlayerId(playerId);
    if (existingSide) {
      const previousConn = this.sideToConnection.get(existingSide);
      if (previousConn) {
        this.connectionToSide.delete(previousConn.id);
      }
      this.sideToConnection.set(existingSide, conn);
      this.connectionToSide.set(conn.id, existingSide);
      return existingSide;
    }

    // Auto-assign: first available side
    const fallback = this.canTakeSide('a') ? 'a' : this.canTakeSide('b') ? 'b' : null;
    if (!fallback) {
      return null;
    }

    this.takeSide(fallback, playerId, conn);
    return fallback;
  }

  // ------- AI Fallback -------

  private scheduleAIFallback(): void {
    if (this.aiFallbackTimer) return;

    this.aiFallbackTimer = setTimeout(() => {
      this.aiFallbackTimer = null;

      // If both sides already filled, skip
      if (this.sideToPlayerId.has('a') && this.sideToPlayerId.has('b')) {
        return;
      }

      this.spawnAI();
    }, AI_FALLBACK_MS);
  }

  private cancelAIFallback(): void {
    if (this.aiFallbackTimer) {
      clearTimeout(this.aiFallbackTimer);
      this.aiFallbackTimer = null;
    }
  }

  private spawnAI(): void {
    // Find which side is empty
    const side: DefenseLinePlayer | null =
      !this.sideToPlayerId.has('a') ? 'a' :
      !this.sideToPlayerId.has('b') ? 'b' :
      null;

    if (!side) return;

    const aiPlayerId = `bot_${Date.now()}`;
    this.sideToPlayerId.set(side, aiPlayerId);
    // No connection for AI — sideToConnection stays empty for this side
    this.aiSide = side;

    console.log(`[DefenseLine] AI spawned as player ${side}`);

    this.broadcastRoomState();
    this.broadcastState();
    this.maybeStartCountdown();
  }

  // ------- Input Handling -------

  private handleInput(sender: Party.Connection, input: DefenseLineInput): void {
    const side = this.connectionToSide.get(sender.id);
    if (!side) {
      sender.send(JSON.stringify({ type: 'error', message: 'not_joined' }));
      return;
    }

    if (this.gameState.status !== 'playing') {
      return;
    }

    const normalizedInput = this.normalizeInput(input, side);
    const result = this.gameState.processInput(side, normalizedInput);
    if (!result.changed) {
      return;
    }

    if (result.clearedRows.length > 0) {
      this.broadcast({
        type: 'clear',
        player: side,
        rows: result.clearedRows,
      });
    }

    this.broadcastState();

    if (result.winner) {
      this.finishGame(result.winner);
    }
  }

  private normalizeInput(input: DefenseLineInput, player: DefenseLinePlayer): 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'soft_drop' | 'hard_drop' {
    if (input.type === 'move') {
      // Reverse left/right for player B (board is flipped 180°)
      if (player === 'b') {
        return input.direction === 'left' ? 'move_right' : 'move_left';
      }
      return input.direction === 'left' ? 'move_left' : 'move_right';
    }

    if (input.type === 'rotate') {
      return input.direction === 'cw' ? 'rotate_cw' : 'rotate_ccw';
    }

    return input.type;
  }

  // ------- Game Lifecycle -------

  private maybeStartCountdown(): void {
    if (this.gameState.status === 'playing' || this.gameState.status === 'finished') {
      return;
    }

    // Both sides need a player ID (human or AI)
    if (!this.sideToPlayerId.has('a') || !this.sideToPlayerId.has('b')) {
      return;
    }

    if (this.countdownTimer) {
      return;
    }

    this.cancelAIFallback(); // No longer need AI fallback

    this.gameState.setStatus('countdown');
    let seconds = 3;
    this.countdownDeadlineAt = Date.now() + (seconds * 1000);

    this.broadcast({ type: 'countdown', seconds });
    this.broadcastState();

    this.countdownTimer = setInterval(() => {
      seconds -= 1;

      if (seconds <= 0) {
        this.stopCountdown();
        this.startGameSafely('countdown_complete');
        return;
      }

      this.broadcast({ type: 'countdown', seconds });
    }, 1000);

    // Durable Object timers can stall under load; keep a deterministic fallback.
    this.countdownSafetyTimer = setTimeout(() => {
      this.ensureCountdownStart();
    }, (seconds * 1000) + 250);
  }

  private ensureCountdownStart(): void {
    if (this.gameState.status !== 'countdown') {
      return;
    }
    if (this.countdownDeadlineAt !== null && Date.now() < this.countdownDeadlineAt) {
      return;
    }
    this.stopCountdown();
    this.startGameSafely('countdown_safety_fallback');
  }

  private startGameSafely(trigger: string): void {
    if (this.gameState.status === 'playing' || this.gameState.status === 'finished') {
      return;
    }
    // Must still have two assigned sides (human or AI).
    if (!this.sideToPlayerId.has('a') || !this.sideToPlayerId.has('b')) {
      return;
    }

    try {
      this.startGame();
      console.log(`[DefenseLine] Game started (${trigger}) room=${this.room.id}`);
    } catch (error) {
      console.error(`[DefenseLine] Failed to start game (${trigger}) room=${this.room.id}:`, error);
      this.broadcast({
        type: 'error',
        message: 'game_start_failed',
      });
      this.stopAll();
      this.resetGameState();
      this.broadcastRoomState();
      this.broadcastState();
    }
  }

  private startGame(): void {
    this.gameState.startGame();
    this.broadcastState();

    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }

    this.gameLoop = setInterval(() => {
      const tick = this.gameState.tick();
      if (!tick.changed && !tick.winner) {
        return;
      }

      for (const clearEvent of tick.clearEvents) {
        this.broadcast({
          type: 'clear',
          player: clearEvent.player,
          rows: clearEvent.rows,
        });
      }

      this.broadcastState();

      if (tick.winner) {
        this.finishGame(tick.winner);
      }
    }, TICK_MS);

    // Start AI move loop if AI is present
    if (this.aiSide) {
      this.startAIMoveLoop();
    }
  }

  private startAIMoveLoop(): void {
    if (this.aiMoveTimer) {
      clearInterval(this.aiMoveTimer);
    }

    this.aiMoveTimer = setInterval(() => {
      if (!this.aiSide || this.gameState.status !== 'playing' || this.gameState.winner) {
        this.stopAIMoveLoop();
        return;
      }

      this.executeAIMove();
    }, this.aiMoveIntervalMs);
  }

  private executeAIMove(): void {
    if (!this.aiSide) return;

    const playerState = this.aiSide === 'a'
      ? this.gameState.playerA
      : this.gameState.playerB;

    const piece = playerState.activePiece;
    if (!piece) return;

    // If move queue is empty, compute new target placement
    if (this.aiMoveQueue.length === 0) {
      const target = this.ai.findBestPlacement(
        this.gameState.board,
        this.aiSide,
        piece,
      );

      // Generate moves: rotations first, then horizontal, then hard drop
      const shapes = TETROMINO_SHAPES[piece.type];
      const numRotations = shapes.length;
      const rotationDiff = ((target.targetRotation - piece.rotation) % numRotations + numRotations) % numRotations;

      for (let i = 0; i < rotationDiff; i++) {
        this.aiMoveQueue.push('rotate_cw');
      }

      const colDiff = target.targetCol - piece.col;
      if (colDiff > 0) {
        for (let i = 0; i < colDiff; i++) {
          this.aiMoveQueue.push('move_right');
        }
      } else if (colDiff < 0) {
        for (let i = 0; i < Math.abs(colDiff); i++) {
          this.aiMoveQueue.push('move_left');
        }
      }

      this.aiMoveQueue.push('hard_drop');
    }

    // Remember current piece identity to detect lock
    const pieceType = piece.type;
    const pieceRow = piece.row;

    // Execute next move from queue
    const nextMove = this.aiMoveQueue.shift();
    if (!nextMove) return;

    const result = this.gameState.processInput(this.aiSide, nextMove);
    if (result.changed) {
      if (result.clearedRows.length > 0) {
        this.broadcast({
          type: 'clear',
          player: this.aiSide,
          rows: result.clearedRows,
        });
      }

      this.broadcastState();

      if (result.winner) {
        this.finishGame(result.winner);
      }
    }

    // If the piece was locked (hard_drop or soft_drop that caused lock),
    // clear the move queue so AI recalculates for the new piece
    const newPiece = playerState.activePiece;
    if (!newPiece || newPiece.type !== pieceType || (nextMove === 'hard_drop' && newPiece.row !== pieceRow)) {
      this.aiMoveQueue = [];
    }
  }

  private finishGame(winner: DefenseLinePlayer): void {
    this.stopAll();

    this.broadcast({
      type: 'win',
      winner,
    });
    this.broadcastState();
  }

  // ------- Broadcasting -------

  private broadcastState(): void {
    this.broadcast({
      type: 'state',
      state: this.gameState.getPublicState(),
    });
  }

  private broadcastRoomState(): void {
    this.broadcast({
      type: 'room_state',
      status: this.gameState.status,
      players: {
        a: this.sideToPlayerId.get('a') ?? null,
        b: this.sideToPlayerId.get('b') ?? null,
      },
    });
  }

  private broadcast(payload: unknown): void {
    this.room.broadcast(JSON.stringify(payload));
  }

  // ------- Helpers -------

  private canTakeSide(side: DefenseLinePlayer): boolean {
    return !this.sideToPlayerId.has(side);
  }

  private takeSide(side: DefenseLinePlayer, playerId: string, conn: Party.Connection): void {
    this.sideToPlayerId.set(side, playerId);
    this.sideToConnection.set(side, conn);
    this.connectionToSide.set(conn.id, side);
  }

  private getSideByPlayerId(playerId: string): DefenseLinePlayer | null {
    for (const side of ['a', 'b'] as const) {
      if (this.sideToPlayerId.get(side) === playerId) {
        return side;
      }
    }
    return null;
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.countdownSafetyTimer) {
      clearTimeout(this.countdownSafetyTimer);
      this.countdownSafetyTimer = null;
    }
    this.countdownDeadlineAt = null;
  }

  private stopGameLoop(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
  }

  private stopAIMoveLoop(): void {
    if (this.aiMoveTimer) {
      clearInterval(this.aiMoveTimer);
      this.aiMoveTimer = null;
    }
  }

  private stopAll(): void {
    this.stopCountdown();
    this.stopGameLoop();
    this.stopAIMoveLoop();
    this.cancelAIFallback();
  }

  private resetGameState(): void {
    const seed = parseInt(this.room.id.substring(0, 8), 36) || Date.now();
    this.gameState = new DefenseLineGameState(seed + Date.now());
    this.aiSide = null;
    this.aiMoveQueue = [];
    this.aiMoveIntervalMs = DEFAULT_AI_MOVE_INTERVAL_MS;
  }

  private sanitizeAIMoveInterval(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return DEFAULT_AI_MOVE_INTERVAL_MS;
    }
    return Math.max(60, Math.min(1200, Math.round(value)));
  }
}
