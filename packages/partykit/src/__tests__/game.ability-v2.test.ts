import { describe, expect, it } from 'vitest';
import { createInitialPlayerMetrics } from '@tetris-battle/game-core';
import GameRoomServer from '../game';
import { ServerGameState } from '../ServerGameState';

class MockConnection {
  constructor(public id: string) {}
  messages: any[] = [];

  send(payload: string) {
    this.messages.push(JSON.parse(payload));
  }
}

class MockRoom {
  constructor(public id: string, private readonly connections: MockConnection[]) {}
  getConnections() {
    return this.connections.values();
  }
  broadcast(payload: string) {
    for (const conn of this.connections) {
      conn.send(payload);
    }
  }
}

function getMessages(conn: MockConnection, type: string): any[] {
  return conn.messages.filter((message) => message.type === type);
}

function createTwoPlayerServer(roomId: string = 'game_v2_test') {
  const p1Conn = new MockConnection('c1');
  const p2Conn = new MockConnection('c2');
  const room = new MockRoom(roomId, [p1Conn, p2Conn]) as any;
  const server = new GameRoomServer(room);

  server.players.set('p1', { playerId: 'p1', connectionId: p1Conn.id, metrics: createInitialPlayerMetrics() });
  server.players.set('p2', { playerId: 'p2', connectionId: p2Conn.id, metrics: createInitialPlayerMetrics() });

  return { server, p1Conn, p2Conn };
}

describe('GameRoomServer v2 ability behaviors', () => {
  it('applies overcharge discount to next 3 ability casts', () => {
    const { server, p1Conn } = createTwoPlayerServer('game_v2_overcharge');

    const p1State = new ServerGameState('p1', 12345, ['overcharge', 'earthquake']);
    const p2State = new ServerGameState('p2', 12345, ['earthquake']);
    p1State.gameState.stars = 300;
    server.serverGameStates.set('p1', p1State);
    server.serverGameStates.set('p2', p2State);

    server.handleAbilityActivation('p1', 'overcharge', 'p1', 'req_overcharge');
    server.handleAbilityActivation('p1', 'earthquake', 'p2', 'req_eq_1');
    server.handleAbilityActivation('p1', 'earthquake', 'p2', 'req_eq_2');
    server.handleAbilityActivation('p1', 'earthquake', 'p2', 'req_eq_3');
    server.handleAbilityActivation('p1', 'earthquake', 'p2', 'req_eq_4');

    const results = getMessages(p1Conn, 'ability_activation_result');
    const byReq = new Map(results.map((r) => [r.requestId, r]));

    expect(byReq.get('req_overcharge')?.chargedCost).toBe(30);
    expect(byReq.get('req_eq_1')?.chargedCost).toBe(18);
    expect(byReq.get('req_eq_2')?.chargedCost).toBe(18);
    expect(byReq.get('req_eq_3')?.chargedCost).toBe(18);
    expect(byReq.get('req_eq_4')?.chargedCost).toBe(30);
    expect(p1State.gameState.stars).toBe(186);
  });

  it('clone fails with refund if opponent has no cloneable ability yet', () => {
    const { server, p1Conn } = createTwoPlayerServer('game_v2_clone_refund');

    const p1State = new ServerGameState('p1', 12345, ['clone']);
    const p2State = new ServerGameState('p2', 12345, ['earthquake']);
    server.serverGameStates.set('p1', p1State);
    server.serverGameStates.set('p2', p2State);

    const starsBefore = p1State.gameState.stars;
    server.handleAbilityActivation('p1', 'clone', 'p2', 'req_clone_refund');

    const results = getMessages(p1Conn, 'ability_activation_result');
    const latest = results[results.length - 1];

    expect(latest.accepted).toBe(false);
    expect(latest.reason).toBe('clone_no_ability');
    expect(latest.chargedCost).toBe(0);
    expect(p1State.gameState.stars).toBe(starsBefore);
  });

  it('clone copies opponent last non-clone ability and applies copied effect', () => {
    const { server, p1Conn, p2Conn } = createTwoPlayerServer('game_v2_clone_copy');

    const p1State = new ServerGameState('p1', 12345, ['clone']);
    const p2State = new ServerGameState('p2', 12345, ['earthquake']);
    server.serverGameStates.set('p1', p1State);
    server.serverGameStates.set('p2', p2State);

    server.handleAbilityActivation('p2', 'earthquake', 'p1', 'req_p2_eq');
    server.handleAbilityActivation('p1', 'clone', 'p2', 'req_p1_clone');

    const p1Results = getMessages(p1Conn, 'ability_activation_result');
    const cloneResult = p1Results.find((result) => result.requestId === 'req_p1_clone');

    expect(cloneResult?.accepted).toBe(true);
    expect(cloneResult?.appliedAbilityType).toBe('earthquake');

    const p2Received = getMessages(p2Conn, 'ability_received');
    const cloneReceive = p2Received.find((event) => event.fromPlayerId === 'p1');

    expect(cloneReceive?.abilityType).toBe('earthquake');
  });

  it('purge clears timed effects on both players', () => {
    const { server, p1Conn } = createTwoPlayerServer('game_v2_purge');

    const p1State = new ServerGameState('p1', 12345, ['purge']);
    const p2State = new ServerGameState('p2', 12345, ['screen_shake']);
    server.serverGameStates.set('p1', p1State);
    server.serverGameStates.set('p2', p2State);

    p1State.applyAbility('time_warp');
    p2State.applyAbility('screen_shake');
    expect(p1State.getActiveEffects()).toContain('time_warp');
    expect(p2State.getActiveEffects()).toContain('screen_shake');

    server.handleAbilityActivation('p1', 'purge', 'p1', 'req_purge');

    expect(p1State.getActiveEffects()).not.toContain('time_warp');
    expect(p2State.getActiveEffects()).not.toContain('screen_shake');

    const results = getMessages(p1Conn, 'ability_activation_result');
    const purgeResult = results.find((result) => result.requestId === 'req_purge');
    expect(purgeResult?.accepted).toBe(true);
    expect(purgeResult?.appliedAbilityType).toBe('purge');
  });

  it('accepts cylinder_vision and applies it to opponent', () => {
    const { server, p1Conn } = createTwoPlayerServer('game_v2_cylinder_vision');

    const p1State = new ServerGameState('p1', 12345, ['cylinder_vision']);
    const p2State = new ServerGameState('p2', 12345, ['earthquake']);
    p1State.gameState.stars = 300;
    server.serverGameStates.set('p1', p1State);
    server.serverGameStates.set('p2', p2State);

    server.handleAbilityActivation('p1', 'cylinder_vision', 'p2', 'req_cylinder');

    const results = getMessages(p1Conn, 'ability_activation_result');
    const cylinderResult = results.find((result) => result.requestId === 'req_cylinder');

    expect(cylinderResult?.accepted).toBe(true);
    expect(cylinderResult?.appliedAbilityType).toBe('cylinder_vision');
    expect(p2State.getActiveEffects()).toContain('cylinder_vision');
  });

  it('resolves blackhole when target client reports piece end', () => {
    const { server, p1Conn, p2Conn } = createTwoPlayerServer('game_v2_blackhole');

    const p1State = new ServerGameState('p1', 12345, ['blackhole']);
    const p2State = new ServerGameState('p2', 12345, ['earthquake']);
    p1State.gameState.stars = 300;
    server.serverGameStates.set('p1', p1State);
    server.serverGameStates.set('p2', p2State);

    server.handleAbilityActivation('p1', 'blackhole', 'p2', 'req_blackhole');
    expect(p2State.getActiveEffects()).toContain('blackhole');

    server.onMessage(
      JSON.stringify({
        type: 'blackhole_piece_end',
        playerId: 'p2',
        reason: 'edge_contact',
      }),
      p2Conn as any
    );

    expect(p2State.getActiveEffects()).not.toContain('blackhole');
    const ack = getMessages(p2Conn, 'blackhole_piece_end_ack');
    expect(ack.length).toBeGreaterThan(0);
    expect(ack[ack.length - 1]?.reason).toBe('edge_contact');

    const casterResult = getMessages(p1Conn, 'ability_activation_result').find(
      (result) => result.requestId === 'req_blackhole'
    );
    expect(casterResult?.accepted).toBe(true);
    expect(casterResult?.appliedAbilityType).toBe('blackhole');
  });
});
