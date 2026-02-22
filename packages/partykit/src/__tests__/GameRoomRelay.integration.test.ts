import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ABILITIES, STAR_VALUES, createInitialPlayerMetrics } from '@tetris-battle/game-core';
import { ServerGameState } from '../ServerGameState';
import GameRoomRelay from '../GameRoomRelay';

/**
 * Integration tests for the client-authoritative architecture.
 *
 * These tests simulate the full flow:
 * 1. Client connects to GameRoomRelay
 * 2. Server sends game_start with seed
 * 3. Client initializes local ServerGameState with that seed
 * 4. Client runs game locally (inputs processed locally)
 * 5. Client sends state summaries to server
 * 6. Server relays summaries to opponent
 * 7. Abilities go through the server for validation
 */

class MockConnection {
  constructor(public id: string) {}
  messages: any[] = [];
  send(payload: string) {
    this.messages.push(JSON.parse(payload));
  }
}

class MockRoom {
  constructor(public id: string, private readonly connections: MockConnection[]) {}
  getConnections() { return this.connections.values(); }
  broadcast(payload: string) {
    for (const conn of this.connections) {
      conn.send(payload);
    }
  }
}

function getMessages(conn: MockConnection, type: string): any[] {
  return conn.messages.filter((m) => m.type === type);
}

function clearMessages(conn: MockConnection): void {
  conn.messages = [];
}

describe('Client-Authoritative Integration Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('both clients get the same deterministic piece sequence from the shared seed', () => {
    const p1Conn = new MockConnection('c1');
    const p2Conn = new MockConnection('c2');
    const room = new MockRoom('integration_seed_test', [p1Conn, p2Conn]) as any;
    const relay = new GameRoomRelay(room);

    // Join both players
    relay.onConnect(p1Conn as any, {} as any);
    relay.onMessage(JSON.stringify({
      type: 'join_game', playerId: 'p1', loadout: [],
    }), p1Conn as any);
    relay.onConnect(p2Conn as any, {} as any);
    relay.onMessage(JSON.stringify({
      type: 'join_game', playerId: 'p2', loadout: [],
    }), p2Conn as any);

    // Extract seed from game_start
    const p1Start = getMessages(p1Conn, 'game_start')[0];
    const p2Start = getMessages(p2Conn, 'game_start')[0];
    expect(p1Start.seed).toBe(p2Start.seed);

    const seed = p1Start.seed;

    // Both clients create local game state with the same seed
    const client1State = new ServerGameState('p1', seed, []);
    const client2State = new ServerGameState('p2', seed, []);

    // Each player gets their own deterministic piece sequence
    // (different because seed is offset by playerId char code)
    expect(client1State.gameState.currentPiece).toBeTruthy();
    expect(client2State.gameState.currentPiece).toBeTruthy();
    expect(client1State.gameState.nextPieces.length).toBe(5);
    expect(client2State.gameState.nextPieces.length).toBe(5);

    // Same player ID + same seed = same sequence (deterministic)
    const verifyState = new ServerGameState('p1', seed, []);
    expect(verifyState.gameState.nextPieces).toEqual(client1State.gameState.nextPieces);
    expect(verifyState.gameState.currentPiece?.type).toBe(client1State.gameState.currentPiece?.type);
  });

  it('client processes inputs locally without server round-trip', () => {
    // This test verifies that the client can process inputs locally
    // using the same ServerGameState class used by the server
    const localState = new ServerGameState('p1', 12345, []);

    const initialX = localState.gameState.currentPiece!.position.x;

    // Process input locally - no network needed!
    const changed = localState.processInput('move_left');
    expect(changed).toBe(true);
    expect(localState.gameState.currentPiece!.position.x).toBe(initialX - 1);

    // Hard drop - also local
    const dropped = localState.processInput('hard_drop');
    expect(dropped).toBe(true);
    // After hard drop, new piece spawned
    expect(localState.gameState.currentPiece).toBeTruthy();
  });

  it('gravity tick runs locally without server', () => {
    const localState = new ServerGameState('p1', 12345, []);

    const initialY = localState.gameState.currentPiece!.position.y;

    // Tick runs gravity locally
    const changed = localState.tick();
    expect(changed).toBe(true);
    expect(localState.gameState.currentPiece!.position.y).toBe(initialY + 1);
  });

  it('client state summary is relayed to opponent', () => {
    const p1Conn = new MockConnection('c1');
    const p2Conn = new MockConnection('c2');
    const room = new MockRoom('integration_summary_test', [p1Conn, p2Conn]) as any;
    const relay = new GameRoomRelay(room);

    // Setup game
    relay.onConnect(p1Conn as any, {} as any);
    relay.onMessage(JSON.stringify({ type: 'join_game', playerId: 'p1', loadout: [] }), p1Conn as any);
    relay.onConnect(p2Conn as any, {} as any);
    relay.onMessage(JSON.stringify({ type: 'join_game', playerId: 'p2', loadout: [] }), p2Conn as any);

    const seed = getMessages(p1Conn, 'game_start')[0].seed;

    // Client 1 creates local state and plays
    const client1State = new ServerGameState('p1', seed, []);
    client1State.processInput('hard_drop');
    client1State.processInput('hard_drop');

    // Client 1 sends state summary
    const summary = client1State.getPublicState();
    clearMessages(p2Conn);

    relay.onMessage(JSON.stringify({
      type: 'state_summary',
      playerId: 'p1',
      summary,
    }), p1Conn as any);

    // p2 receives opponent state
    const opponentStates = getMessages(p2Conn, 'opponent_state');
    expect(opponentStates).toHaveLength(1);
    expect(opponentStates[0].summary.score).toBe(summary.score);
    expect(opponentStates[0].summary.linesCleared).toBe(summary.linesCleared);
    expect(opponentStates[0].summary.board).toEqual(summary.board);
  });

  it('ability activation flows from client through relay to target', () => {
    const p1Conn = new MockConnection('c1');
    const p2Conn = new MockConnection('c2');
    const room = new MockRoom('integration_ability_test', [p1Conn, p2Conn]) as any;
    const relay = new GameRoomRelay(room);

    // Setup
    relay.onConnect(p1Conn as any, {} as any);
    relay.onMessage(JSON.stringify({ type: 'join_game', playerId: 'p1', loadout: ['earthquake'] }), p1Conn as any);
    relay.onConnect(p2Conn as any, {} as any);
    relay.onMessage(JSON.stringify({ type: 'join_game', playerId: 'p2', loadout: [] }), p2Conn as any);

    const seed = getMessages(p1Conn, 'game_start')[0].seed;

    // Client 1 creates local state
    const client1State = new ServerGameState('p1', seed, ['earthquake']);

    // Client 1 has stars (starting pool)
    expect(client1State.gameState.stars).toBe(STAR_VALUES.startingPool);

    // Sync stars to server
    relay.onMessage(JSON.stringify({
      type: 'stars_update', playerId: 'p1', stars: client1State.gameState.stars,
    }), p1Conn as any);

    clearMessages(p1Conn);
    clearMessages(p2Conn);

    // Client 1 sends ability activation
    relay.onMessage(JSON.stringify({
      type: 'ability_activation',
      playerId: 'p1',
      abilityType: 'earthquake',
      targetPlayerId: 'p2',
      requestId: 'req_eq_1',
    }), p1Conn as any);

    // Client 1 receives activation result
    const results = getMessages(p1Conn, 'ability_activation_result');
    expect(results).toHaveLength(1);
    expect(results[0].accepted).toBe(true);
    expect(results[0].chargedCost).toBe(ABILITIES.earthquake.cost);

    // Client 2 receives ability_received
    const received = getMessages(p2Conn, 'ability_received');
    expect(received).toHaveLength(1);
    expect(received[0].abilityType).toBe('earthquake');

    // Client 2 applies ability locally
    const client2State = new ServerGameState('p2', seed, []);
    client2State.applyAbility('earthquake');
    // Earthquake modifies the board
    expect(client2State.getActiveEffects()).toEqual([]); // Earthquake is instant, no timed effect
  });

  it('full game lifecycle: join, play, game over', () => {
    const p1Conn = new MockConnection('c1');
    const p2Conn = new MockConnection('c2');
    const room = new MockRoom('integration_lifecycle_test', [p1Conn, p2Conn]) as any;
    const relay = new GameRoomRelay(room);

    // Setup
    relay.onConnect(p1Conn as any, {} as any);
    relay.onMessage(JSON.stringify({ type: 'join_game', playerId: 'p1', loadout: [] }), p1Conn as any);
    relay.onConnect(p2Conn as any, {} as any);
    relay.onMessage(JSON.stringify({ type: 'join_game', playerId: 'p2', loadout: [] }), p2Conn as any);

    expect(relay.roomStatus).toBe('playing');

    const seed = getMessages(p1Conn, 'game_start')[0].seed;

    // Both clients run their games locally
    const client1 = new ServerGameState('p1', seed, []);
    const client2 = new ServerGameState('p2', seed, []);

    // Play some moves locally (no server communication needed!)
    for (let i = 0; i < 5; i++) {
      client1.processInput('hard_drop');
      client2.processInput('hard_drop');
    }

    // Periodically share summaries
    relay.onMessage(JSON.stringify({
      type: 'state_summary',
      playerId: 'p1',
      summary: client1.getPublicState(),
    }), p1Conn as any);

    relay.onMessage(JSON.stringify({
      type: 'state_summary',
      playerId: 'p2',
      summary: client2.getPublicState(),
    }), p2Conn as any);

    clearMessages(p1Conn);
    clearMessages(p2Conn);

    // Client 1 reports game over (their board filled up)
    relay.onMessage(JSON.stringify({
      type: 'game_over',
      playerId: 'p1',
    }), p1Conn as any);

    expect(relay.roomStatus).toBe('finished');

    const p1Finished = getMessages(p1Conn, 'game_finished');
    const p2Finished = getMessages(p2Conn, 'game_finished');
    expect(p1Finished).toHaveLength(1);
    expect(p2Finished).toHaveLength(1);
    expect(p1Finished[0].winnerId).toBe('p2');
  });

  it('network traffic is minimal: no input messages, only summaries and abilities', () => {
    const p1Conn = new MockConnection('c1');
    const p2Conn = new MockConnection('c2');
    const room = new MockRoom('integration_traffic_test', [p1Conn, p2Conn]) as any;
    const relay = new GameRoomRelay(room);

    relay.onConnect(p1Conn as any, {} as any);
    relay.onMessage(JSON.stringify({ type: 'join_game', playerId: 'p1', loadout: [] }), p1Conn as any);
    relay.onConnect(p2Conn as any, {} as any);
    relay.onMessage(JSON.stringify({ type: 'join_game', playerId: 'p2', loadout: [] }), p2Conn as any);

    const seed = getMessages(p1Conn, 'game_start')[0].seed;
    const client1 = new ServerGameState('p1', seed, []);

    clearMessages(p1Conn);
    clearMessages(p2Conn);

    // Simulate 100 inputs locally (in old system, each would be a network message)
    for (let i = 0; i < 100; i++) {
      // Alternate between different inputs
      if (i % 4 === 0) client1.processInput('move_left');
      else if (i % 4 === 1) client1.processInput('move_right');
      else if (i % 4 === 2) client1.processInput('rotate_cw');
      else client1.processInput('hard_drop');
    }

    // After 100 local inputs, the server received ZERO messages
    // (we didn't send anything to the relay)
    expect(p1Conn.messages).toHaveLength(0);
    expect(p2Conn.messages).toHaveLength(0);

    // Now send a single summary (equivalent of 100+ old state_update messages)
    relay.onMessage(JSON.stringify({
      type: 'state_summary',
      playerId: 'p1',
      summary: client1.getPublicState(),
    }), p1Conn as any);

    // Opponent receives just 1 message
    expect(getMessages(p2Conn, 'opponent_state')).toHaveLength(1);
  });

  it('AI opponent game works with relay', () => {
    const p1Conn = new MockConnection('c1');
    const room = new MockRoom('integration_ai_test', [p1Conn]) as any;
    const relay = new GameRoomRelay(room);

    relay.onConnect(p1Conn as any, {} as any);
    relay.onMessage(JSON.stringify({
      type: 'join_game',
      playerId: 'p1',
      loadout: [],
      aiOpponent: {
        id: 'ai_bot',
        name: 'Bot',
        difficulty: 'medium',
        reactionCadenceMs: 200,
      },
    }), p1Conn as any);

    // Game should start with AI + human
    expect(relay.roomStatus).toBe('playing');
    expect(relay.players.size).toBe(2);
    expect(relay.aiPlayer?.id).toBe('ai_bot');

    const starts = getMessages(p1Conn, 'game_start');
    expect(starts).toHaveLength(1);
    expect(starts[0].players).toContain('p1');
    expect(starts[0].players).toContain('ai_bot');
    expect(starts[0].seed).toBeTypeOf('number');

    // AI state should be initialized
    expect(relay.aiServerState).toBeTruthy();
    expect(relay.aiServerState?.gameState.currentPiece).toBeTruthy();

    // Clean up AI intervals
    relay.handleGameOver('p1');
  });

  it('defensive effects work across the relay', () => {
    const p1Conn = new MockConnection('c1');
    const p2Conn = new MockConnection('c2');
    const room = new MockRoom('integration_defense_test', [p1Conn, p2Conn]) as any;
    const relay = new GameRoomRelay(room);

    relay.onConnect(p1Conn as any, {} as any);
    relay.onMessage(JSON.stringify({
      type: 'join_game', playerId: 'p1', loadout: ['earthquake'],
    }), p1Conn as any);
    relay.onConnect(p2Conn as any, {} as any);
    relay.onMessage(JSON.stringify({
      type: 'join_game', playerId: 'p2', loadout: ['shield'],
    }), p2Conn as any);

    const seed = getMessages(p1Conn, 'game_start')[0].seed;

    // Client 2 activates shield locally and reports it
    const client2 = new ServerGameState('p2', seed, ['shield']);
    client2.gameState.stars = 300;
    client2.applyAbility('shield');

    // Report defensive effect to server
    relay.onMessage(JSON.stringify({
      type: 'defensive_effect_update',
      playerId: 'p2',
      effect: 'shield',
      endTime: Date.now() + 15000,
    }), p2Conn as any);

    // Client 1 tries to earthquake Client 2
    relay.onMessage(JSON.stringify({ type: 'stars_update', playerId: 'p1', stars: 300 }), p1Conn as any);

    clearMessages(p1Conn);
    clearMessages(p2Conn);

    relay.onMessage(JSON.stringify({
      type: 'ability_activation',
      playerId: 'p1',
      abilityType: 'earthquake',
      targetPlayerId: 'p2',
      requestId: 'req_blocked',
    }), p1Conn as any);

    const results = getMessages(p1Conn, 'ability_activation_result');
    expect(results).toHaveLength(1);
    expect(results[0].interceptedBy).toBe('shield');

    // p2 should NOT receive the earthquake
    const received = getMessages(p2Conn, 'ability_received');
    expect(received).toHaveLength(0);

    // p2 should get blocked notification
    const blocked = getMessages(p2Conn, 'ability_blocked');
    expect(blocked).toHaveLength(1);
  });
});
