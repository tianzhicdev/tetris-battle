import type * as Party from 'partykit/server';
import {
  DefenseLineGameState,
  type DefenseLinePlayer,
} from './DefenseLineGameState';

interface JoinPayload {
  playerId: string;
  player?: DefenseLinePlayer;
}

type DefenseLineInput =
  | { type: 'move'; direction: 'left' | 'right' }
  | { type: 'rotate'; direction: 'cw' | 'ccw' }
  | { type: 'soft_drop' }
  | { type: 'hard_drop' };

const TICK_MS = 700;

export default class DefenseLineServer implements Party.Server {
  private gameState: DefenseLineGameState;
  private readonly sideToConnection = new Map<DefenseLinePlayer, Party.Connection>();
  private readonly sideToPlayerId = new Map<DefenseLinePlayer, string>();
  private readonly connectionToSide = new Map<string, DefenseLinePlayer>();

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private gameLoop: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {
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
        this.maybeStartCountdown();
        return;
      case 'move':
      case 'rotate':
      case 'soft_drop':
      case 'hard_drop':
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
      this.stopGameLoop();
      this.stopCountdown();
      this.resetGameState();
    }

    this.broadcastRoomState();
    this.broadcastState();
  }

  private handleJoin(conn: Party.Connection, payload: JoinPayload): void {
    if (!payload.playerId) {
      conn.send(JSON.stringify({ type: 'error', message: 'missing_player_id' }));
      return;
    }

    const assigned = this.assignPlayer(conn, payload.playerId, payload.player);

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
    this.maybeStartCountdown();
  }

  private handleInput(sender: Party.Connection, input: DefenseLineInput): void {
    const side = this.connectionToSide.get(sender.id);
    if (!side) {
      sender.send(JSON.stringify({ type: 'error', message: 'not_joined' }));
      return;
    }

    if (this.gameState.status !== 'playing') {
      return;
    }

    const normalizedInput = this.normalizeInput(input);
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

  private normalizeInput(input: DefenseLineInput): 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'soft_drop' | 'hard_drop' {
    if (input.type === 'move') {
      return input.direction === 'left' ? 'move_left' : 'move_right';
    }

    if (input.type === 'rotate') {
      return input.direction === 'cw' ? 'rotate_cw' : 'rotate_ccw';
    }

    return input.type;
  }

  private maybeStartCountdown(): void {
    if (this.gameState.status === 'playing' || this.gameState.status === 'finished') {
      return;
    }

    const hasA = this.sideToConnection.has('a');
    const hasB = this.sideToConnection.has('b');

    if (!hasA || !hasB) {
      return;
    }

    if (this.countdownTimer) {
      return;
    }

    this.gameState.setStatus('countdown');
    let seconds = 3;

    this.broadcast({ type: 'countdown', seconds });
    this.broadcastState();

    this.countdownTimer = setInterval(() => {
      seconds -= 1;

      if (seconds <= 0) {
        this.stopCountdown();
        this.startGame();
        return;
      }

      this.broadcast({ type: 'countdown', seconds });
    }, 1000);
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
  }

  private finishGame(winner: DefenseLinePlayer): void {
    this.stopCountdown();
    this.stopGameLoop();

    this.broadcast({
      type: 'win',
      winner,
    });
    this.broadcastState();
  }

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

  private assignPlayer(conn: Party.Connection, playerId: string, preferred?: DefenseLinePlayer): DefenseLinePlayer | null {
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

    if (preferred && this.canTakeSide(preferred)) {
      this.takeSide(preferred, playerId, conn);
      return preferred;
    }

    const fallback = this.canTakeSide('a') ? 'a' : this.canTakeSide('b') ? 'b' : null;
    if (!fallback) {
      return null;
    }

    this.takeSide(fallback, playerId, conn);
    return fallback;
  }

  private canTakeSide(side: DefenseLinePlayer): boolean {
    const conn = this.sideToConnection.get(side);
    const playerId = this.sideToPlayerId.get(side);
    return !conn && !playerId;
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
  }

  private stopGameLoop(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
  }

  private resetGameState(): void {
    const seed = parseInt(this.room.id.substring(0, 8), 36) || Date.now();
    this.gameState = new DefenseLineGameState(seed + Date.now());
  }
}
