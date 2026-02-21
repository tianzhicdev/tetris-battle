import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DefenseLineServer from '../defense-line-server';

class MockConnection {
  readonly id: string;
  sent: string[] = [];

  constructor(id: string) {
    this.id = id;
  }

  send(message: string): void {
    this.sent.push(message);
  }
}

class MockRoom {
  readonly id: string;
  readonly connections = new Set<MockConnection>();
  readonly broadcasts: string[] = [];

  constructor(id: string) {
    this.id = id;
  }

  getConnections(): IterableIterator<MockConnection> {
    return this.connections.values();
  }

  broadcast(message: string): void {
    this.broadcasts.push(message);
    for (const conn of this.connections) {
      conn.send(message);
    }
  }
}

function hasPlayingState(room: MockRoom): boolean {
  return room.broadcasts.some((raw) => {
    const message = JSON.parse(raw);
    return message.type === 'state' && message.state?.status === 'playing';
  });
}

function getLastBroadcast(room: MockRoom, type: string): any | null {
  for (let i = room.broadcasts.length - 1; i >= 0; i -= 1) {
    const message = JSON.parse(room.broadcasts[i]);
    if (message.type === type) {
      return message;
    }
  }
  return null;
}

describe('DefenseLineServer countdown start', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions to playing after countdown', () => {
    const room = new MockRoom('defenseline_test_room');
    const server = new DefenseLineServer(room as any);
    const c1 = new MockConnection('c1');
    const c2 = new MockConnection('c2');
    room.connections.add(c1);
    room.connections.add(c2);

    server.onConnect(c1 as any);
    server.onConnect(c2 as any);
    server.onMessage(JSON.stringify({ type: 'join', playerId: 'p1' }), c1 as any);
    server.onMessage(JSON.stringify({ type: 'join', playerId: 'p2' }), c2 as any);

    vi.advanceTimersByTime(3100);

    expect(hasPlayingState(room)).toBe(true);
  });

  it('safety fallback starts game when countdown interval stalls', () => {
    const room = new MockRoom('defenseline_test_room_safety');
    const server = new DefenseLineServer(room as any);
    const c1 = new MockConnection('c1');
    const c2 = new MockConnection('c2');
    room.connections.add(c1);
    room.connections.add(c2);

    server.onConnect(c1 as any);
    server.onConnect(c2 as any);
    server.onMessage(JSON.stringify({ type: 'join', playerId: 'p1' }), c1 as any);
    server.onMessage(JSON.stringify({ type: 'join', playerId: 'p2' }), c2 as any);

    // Simulate countdown timer loss/stall before it reaches zero.
    const internalServer = server as any;
    if (internalServer.countdownTimer) {
      clearInterval(internalServer.countdownTimer);
      internalServer.countdownTimer = null;
    }

    vi.advanceTimersByTime(4000);

    expect(hasPlayingState(room)).toBe(true);
  });

  it('treats disconnect during play as a forfeit and emits winner', () => {
    const room = new MockRoom('defenseline_test_room_disconnect_forfeit');
    const server = new DefenseLineServer(room as any);
    const c1 = new MockConnection('c1');
    const c2 = new MockConnection('c2');
    room.connections.add(c1);
    room.connections.add(c2);

    server.onConnect(c1 as any);
    server.onConnect(c2 as any);
    server.onMessage(JSON.stringify({ type: 'join', playerId: 'p1' }), c1 as any);
    server.onMessage(JSON.stringify({ type: 'join', playerId: 'p2' }), c2 as any);
    vi.advanceTimersByTime(3100);

    server.onClose(c1 as any);

    const winMessage = getLastBroadcast(room, 'win');
    const stateMessage = getLastBroadcast(room, 'state');
    const roomStateMessage = getLastBroadcast(room, 'room_state');
    expect(winMessage?.winner).toBe('b');
    expect(stateMessage?.state?.status).toBe('finished');
    expect(stateMessage?.state?.winner).toBe('b');
    expect(roomStateMessage?.status).toBe('finished');
    expect(roomStateMessage?.winner).toBe('b');
  });

  it('keeps finished state for remaining player and resets only when room is empty', () => {
    const room = new MockRoom('defenseline_test_room_finish_persist');
    const server = new DefenseLineServer(room as any);
    const c1 = new MockConnection('c1');
    const c2 = new MockConnection('c2');
    room.connections.add(c1);
    room.connections.add(c2);

    server.onConnect(c1 as any);
    server.onConnect(c2 as any);
    server.onMessage(JSON.stringify({ type: 'join', playerId: 'p1' }), c1 as any);
    server.onMessage(JSON.stringify({ type: 'join', playerId: 'p2' }), c2 as any);
    vi.advanceTimersByTime(3100);

    server.onClose(c1 as any);
    const stateAfterFirstClose = getLastBroadcast(room, 'state');
    expect(stateAfterFirstClose?.state?.status).toBe('finished');
    expect(stateAfterFirstClose?.state?.winner).toBe('b');

    room.connections.delete(c2);
    server.onClose(c2 as any);
    const stateAfterSecondClose = getLastBroadcast(room, 'state');
    expect(stateAfterSecondClose?.state?.status).toBe('waiting');
    expect(stateAfterSecondClose?.state?.winner).toBeNull();
  });
});
