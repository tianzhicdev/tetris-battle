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
  private readonly nonPlayingFeedbackAt = new Map<string, number>();

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private countdownSafetyTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownDeadlineAt: number | null = null;
  private gameLoop: ReturnType<typeof setInterval> | null = null;
  private tickWatchdog: ReturnType<typeof setInterval> | null = null;
  private aiFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private aiMoveTimer: ReturnType<typeof setInterval> | null = null;

  // AI state
  private aiSide: DefenseLinePlayer | null = null;
  private readonly ai = new DefenseLineAI();
  private aiMoveQueue: Array<'move_left' | 'move_right' | 'rotate_cw' | 'hard_drop'> = [];
  private aiMoveIntervalMs: number = DEFAULT_AI_MOVE_INTERVAL_MS;
  private tickCounter = 0;
  private inputCounter = 0;
  private lastTickAt: number | null = null;

  constructor(room: Party.Room) {
    this.room = room;
    const seed = parseInt(room.id.substring(0, 8), 36) || Date.now();
    this.gameState = new DefenseLineGameState(seed);
  }

  onConnect(conn: Party.Connection) {
    this.log('connect', `conn=${conn.id} ${this.summarizeState()}`);
    conn.send(JSON.stringify({
      type: 'room_state',
      status: this.gameState.status,
      winner: this.gameState.winner,
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
        this.log('message', `type=join conn=${sender.id} playerId=${String(data.playerId ?? 'unknown')}`);
        this.handleJoin(sender, data);
        return;
      case 'ready':
        this.log('message', `type=ready conn=${sender.id}`);
        this.ensureCountdownStart();
        this.maybeStartCountdown();
        return;
      case 'move':
      case 'rotate':
      case 'soft_drop':
      case 'hard_drop':
        this.log('message', `type=${data.type} conn=${sender.id} payload=${JSON.stringify(data)}`);
        this.ensureCountdownStart();
        this.handleInput(sender, data as DefenseLineInput);
        return;
      default:
        sender.send(JSON.stringify({ type: 'error', message: `unsupported_message:${String(data.type)}` }));
    }
  }

  onClose(conn: Party.Connection) {
    this.log('close', `conn=${conn.id}`);
    this.nonPlayingFeedbackAt.delete(conn.id);
    const side = this.connectionToSide.get(conn.id);
    if (!side) {
      this.log('close', `conn=${conn.id} had_no_side`);
      return;
    }
    const statusBeforeClose = this.gameState.status;
    const opponentSide: DefenseLinePlayer = side === 'a' ? 'b' : 'a';
    const opponentWasAssigned = this.sideToPlayerId.has(opponentSide);

    const mapped = this.sideToConnection.get(side);
    if (mapped?.id === conn.id) {
      this.sideToConnection.delete(side);
    }

    this.connectionToSide.delete(conn.id);
    this.sideToPlayerId.delete(side);
    this.cancelAIFallback();

    // Match disconnect handling follows the main game: disconnect during a live
    // round/countdown is an immediate loss for the disconnected side.
    if ((statusBeforeClose === 'playing' || statusBeforeClose === 'countdown') && opponentWasAssigned) {
      this.gameState.setStatus('finished');
      this.gameState.winner = opponentSide;
      this.finishGame(opponentSide);
      this.broadcastRoomState();
      return;
    }

    // Keep finished winner state visible to any remaining player. Only recycle
    // room state once all human connections are gone.
    if (this.gameState.status === 'finished') {
      if (this.sideToConnection.size === 0) {
        this.stopAll();
        this.resetGameState();
      }
      this.broadcastRoomState();
      this.broadcastState();
      return;
    }

    if (this.sideToConnection.size === 0) {
      if (this.gameState.status === 'playing' || this.gameState.status === 'countdown') {
        this.stopAll();
      }
      if (this.gameState.status !== 'waiting') {
        this.resetGameState();
      }
    } else if (this.sideToPlayerId.size === 1 && this.gameState.status === 'waiting') {
      this.scheduleAIFallback();
    }

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

    this.log('join', `conn=${conn.id} assigned=${assigned} playerId=${payload.playerId} ${this.summarizeState()}`);

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
      this.log('input_ignored', `reason=not_playing side=${side} status=${this.gameState.status} input=${JSON.stringify(input)}`);
      this.sendNonPlayingFeedback(sender);
      return;
    }

    const normalizedInput = this.normalizeInput(input, side);
    this.inputCounter += 1;
    this.log('input', `n=${this.inputCounter} side=${side} raw=${JSON.stringify(input)} normalized=${normalizedInput} ${this.describePieces()}`);
    const result = this.gameState.processInput(side, normalizedInput);
    if (!result.changed) {
      this.log('input_no_change', `n=${this.inputCounter} side=${side} normalized=${normalizedInput} ${this.describePieces()}`);
      return;
    }

    this.log(
      'input_result',
      `n=${this.inputCounter} side=${side} changed=true clears=${result.clearedSegments.length} winner=${result.winner ?? 'none'} ${this.describePieces()}`
    );

    if (result.clearedRows.length > 0) {
      this.log('clear_event', `source=input side=${side} rows=${JSON.stringify(result.clearedRows)} segments=${JSON.stringify(result.clearedSegments)}`);
      this.broadcast({
        type: 'clear',
        player: side,
        rows: result.clearedRows,
        segments: result.clearedSegments,
        cells: result.clearedCells,
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
    this.log('countdown_start', `seconds=${seconds} ${this.summarizeState()}`);

    this.broadcast({ type: 'countdown', seconds });
    this.broadcastState();

    this.countdownTimer = setInterval(() => {
      seconds -= 1;

      if (seconds <= 0) {
        this.stopCountdown();
        this.startGameSafely('countdown_complete');
        return;
      }

      this.log('countdown_tick', `seconds=${seconds}`);
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
    this.log('countdown_force_start', 'reason=safety_fallback');
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
      this.log('game_started', `trigger=${trigger} ${this.describePieces()}`);
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

    if (this.gameState.winner) {
      this.log('game_end_immediate', `winner=${this.gameState.winner}`);
      this.finishGame(this.gameState.winner);
      return;
    }

    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }

    this.tickCounter = 0;
    this.lastTickAt = Date.now();
    this.startTickWatchdog();

    this.gameLoop = setInterval(() => {
      const now = Date.now();
      const gapMs = this.lastTickAt === null ? 0 : now - this.lastTickAt;
      this.lastTickAt = now;
      this.tickCounter += 1;
      this.log('tick_start', `n=${this.tickCounter} gapMs=${gapMs} ${this.describePieces()}`);

      const tick = this.gameState.tick();
      if (!tick.changed && !tick.winner) {
        this.log('tick_no_change', `n=${this.tickCounter}`);
        return;
      }

      this.log(
        'tick_result',
        `n=${this.tickCounter} changed=${tick.changed} clearEvents=${tick.clearEvents.length} winner=${tick.winner ?? 'none'} ${this.describePieces()}`
      );

      for (const clearEvent of tick.clearEvents) {
        this.log('clear_event', `source=tick side=${clearEvent.player} rows=${JSON.stringify(clearEvent.rows)} segments=${JSON.stringify(clearEvent.segments)}`);
        this.broadcast({
          type: 'clear',
          player: clearEvent.player,
          rows: clearEvent.rows,
          segments: clearEvent.segments,
          cells: clearEvent.cells,
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
    this.log('ai_move', `side=${this.aiSide} move=${nextMove} changed=${result.changed} winner=${result.winner ?? 'none'} ${this.describePieces()}`);
    if (result.changed) {
      if (result.clearedRows.length > 0) {
        this.log('clear_event', `source=ai side=${this.aiSide} rows=${JSON.stringify(result.clearedRows)} segments=${JSON.stringify(result.clearedSegments)}`);
        this.broadcast({
          type: 'clear',
          player: this.aiSide,
          rows: result.clearedRows,
          segments: result.clearedSegments,
          cells: result.clearedCells,
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
    this.log('game_finished', `winner=${winner} ${this.summarizeState()}`);

    this.broadcast({
      type: 'win',
      winner,
    });
    this.broadcast({
      type: 'game_finished',
      winner,
    });
    this.broadcastRoomState();
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
      winner: this.gameState.winner,
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
    this.stopTickWatchdog();
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
    this.stopTickWatchdog();
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

  private startTickWatchdog(): void {
    this.stopTickWatchdog();
    this.tickWatchdog = setInterval(() => {
      if (this.gameState.status !== 'playing' || !this.gameLoop) {
        return;
      }
      const now = Date.now();
      const gapMs = this.lastTickAt === null ? 0 : now - this.lastTickAt;
      if (gapMs > TICK_MS * 2.5) {
        this.log('tick_gap_warning', `gapMs=${gapMs} threshold=${Math.round(TICK_MS * 2.5)} ${this.describePieces()}`);
      }
    }, 1000);
  }

  private stopTickWatchdog(): void {
    if (this.tickWatchdog) {
      clearInterval(this.tickWatchdog);
      this.tickWatchdog = null;
    }
  }

  private summarizeState(): string {
    return `status=${this.gameState.status} winner=${this.gameState.winner ?? 'none'} players=a:${this.sideToPlayerId.get('a') ?? 'none'},b:${this.sideToPlayerId.get('b') ?? 'none'}`;
  }

  private describePieces(): string {
    const aPiece = this.gameState.playerA.activePiece;
    const bPiece = this.gameState.playerB.activePiece;
    const a = aPiece ? `${aPiece.type}@r${aPiece.row}:c${aPiece.col}:rot${aPiece.rotation}` : 'none';
    const b = bPiece ? `${bPiece.type}@r${bPiece.row}:c${bPiece.col}:rot${bPiece.rotation}` : 'none';
    return `pieces=a:${a},b:${b}`;
  }

  private log(event: string, message: string): void {
    console.log(`[DefenseLine][${event}] room=${this.room.id} ${message}`);
  }

  private sendNonPlayingFeedback(conn: Party.Connection): void {
    const now = Date.now();
    const lastSent = this.nonPlayingFeedbackAt.get(conn.id) ?? 0;
    // Avoid flooding if client keeps pressing buttons after game end.
    if (now - lastSent < 500) {
      return;
    }

    this.nonPlayingFeedbackAt.set(conn.id, now);
    conn.send(JSON.stringify({
      type: 'state',
      state: this.gameState.getPublicState(),
    }));
    if (this.gameState.winner) {
      conn.send(JSON.stringify({
        type: 'win',
        winner: this.gameState.winner,
      }));
    }
    this.log('input_feedback', `conn=${conn.id} status=${this.gameState.status} winner=${this.gameState.winner ?? 'none'}`);
  }
}
