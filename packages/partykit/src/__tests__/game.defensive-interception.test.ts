import { describe, it, expect } from 'vitest';
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

describe('GameRoomServer defensive interception', () => {
  it('shield blocks incoming debuff before application', () => {
    const p1Conn = new MockConnection('c1');
    const p2Conn = new MockConnection('c2');
    const room = new MockRoom('game_test_room', [p1Conn, p2Conn]) as any;
    const server = new GameRoomServer(room);

    server.players.set('p1', { playerId: 'p1', connectionId: p1Conn.id, metrics: createInitialPlayerMetrics() });
    server.players.set('p2', { playerId: 'p2', connectionId: p2Conn.id, metrics: createInitialPlayerMetrics() });

    const p1State = new ServerGameState('p1', 12345, ['earthquake']);
    const p2State = new ServerGameState('p2', 12345, ['shield']);
    server.serverGameStates.set('p1', p1State);
    server.serverGameStates.set('p2', p2State);

    p2State.applyAbility('shield');
    const starsBefore = p1State.gameState.stars;

    server.handleAbilityActivation('p1', 'earthquake', 'p2', 'req_shield');

    const activationResults = getMessages(p1Conn, 'ability_activation_result');
    expect(activationResults.length).toBeGreaterThan(0);
    const latestResult = activationResults[activationResults.length - 1];
    expect(latestResult.accepted).toBe(false);
    expect(latestResult.reason).toBe('blocked_by_shield');
    expect(latestResult.interceptedBy).toBe('shield');
    expect(p1State.gameState.stars).toBeLessThan(starsBefore);
  });

  it('reflect bounces incoming debuff back to caster', () => {
    const p1Conn = new MockConnection('c1');
    const p2Conn = new MockConnection('c2');
    const room = new MockRoom('game_test_room_2', [p1Conn, p2Conn]) as any;
    const server = new GameRoomServer(room);

    server.players.set('p1', { playerId: 'p1', connectionId: p1Conn.id, metrics: createInitialPlayerMetrics() });
    server.players.set('p2', { playerId: 'p2', connectionId: p2Conn.id, metrics: createInitialPlayerMetrics() });

    const p1State = new ServerGameState('p1', 12345, ['earthquake']);
    const p2State = new ServerGameState('p2', 12345, ['reflect']);
    server.serverGameStates.set('p1', p1State);
    server.serverGameStates.set('p2', p2State);

    p2State.applyAbility('reflect');

    server.handleAbilityActivation('p1', 'earthquake', 'p2', 'req_reflect');

    const activationResults = getMessages(p1Conn, 'ability_activation_result');
    expect(activationResults.length).toBeGreaterThan(0);
    const latestResult = activationResults[activationResults.length - 1];
    expect(latestResult.accepted).toBe(false);
    expect(latestResult.reason).toBe('reflected_by_opponent');
    expect(latestResult.interceptedBy).toBe('reflect');
    expect(latestResult.finalTargetPlayerId).toBe('p1');

    const receivedOnCaster = getMessages(p1Conn, 'ability_received');
    expect(receivedOnCaster.length).toBeGreaterThan(0);
    const latestReceived = receivedOnCaster[receivedOnCaster.length - 1];
    expect(latestReceived.abilityType).toBe('earthquake');
    expect(latestReceived.fromPlayerId).toBe('p2');
  });
});
