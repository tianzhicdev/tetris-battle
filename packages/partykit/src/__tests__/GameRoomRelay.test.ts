import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInitialPlayerMetrics, STAR_VALUES, ABILITIES } from '@tetris-battle/game-core';
import GameRoomRelay from '../GameRoomRelay';

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
  return conn.messages.filter((m) => m.type === type);
}

function clearMessages(conn: MockConnection): void {
  conn.messages = [];
}

function createRelay(roomId: string = 'relay_test') {
  const p1Conn = new MockConnection('c1');
  const p2Conn = new MockConnection('c2');
  const room = new MockRoom(roomId, [p1Conn, p2Conn]) as any;
  const relay = new GameRoomRelay(room);
  return { relay, p1Conn, p2Conn, room };
}

function joinTwoPlayers(relay: GameRoomRelay, p1Conn: MockConnection, p2Conn: MockConnection) {
  relay.onConnect(p1Conn as any, {} as any);
  relay.onMessage(JSON.stringify({
    type: 'join_game',
    playerId: 'p1',
    loadout: ['earthquake', 'shield'],
  }), p1Conn as any);

  relay.onConnect(p2Conn as any, {} as any);
  relay.onMessage(JSON.stringify({
    type: 'join_game',
    playerId: 'p2',
    loadout: ['earthquake', 'reflect'],
  }), p2Conn as any);
}

describe('GameRoomRelay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('join/start', () => {
    it('should send room_state on connect', () => {
      const { relay, p1Conn } = createRelay();
      relay.onConnect(p1Conn as any, {} as any);

      const roomStates = getMessages(p1Conn, 'room_state');
      expect(roomStates).toHaveLength(1);
      expect(roomStates[0].status).toBe('waiting');
    });

    it('should broadcast game_start with seed when 2 players join', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      const p1Starts = getMessages(p1Conn, 'game_start');
      const p2Starts = getMessages(p2Conn, 'game_start');

      expect(p1Starts).toHaveLength(1);
      expect(p2Starts).toHaveLength(1);
      expect(p1Starts[0].players).toEqual(['p1', 'p2']);
      expect(p1Starts[0].seed).toBeTypeOf('number');
      expect(p1Starts[0].seed).toBe(p2Starts[0].seed);
    });

    it('should set room status to playing after 2 players join', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      expect(relay.roomStatus).toBe('playing');
    });

    it('should not start game with only 1 player', () => {
      const { relay, p1Conn } = createRelay();
      relay.onConnect(p1Conn as any, {} as any);
      relay.onMessage(JSON.stringify({
        type: 'join_game',
        playerId: 'p1',
        loadout: [],
      }), p1Conn as any);

      expect(relay.roomStatus).toBe('waiting');
    });
  });

  describe('state summaries', () => {
    it('should relay state summary from player to opponent', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      clearMessages(p2Conn);

      const summary = {
        board: [[null]],
        boardWidth: 10,
        boardHeight: 20,
        currentPiece: null,
        nextPieces: ['I', 'O'],
        score: 500,
        stars: 150,
        linesCleared: 5,
        comboCount: 0,
        isGameOver: false,
        activeEffects: [],
      };

      relay.onMessage(JSON.stringify({
        type: 'state_summary',
        playerId: 'p1',
        summary,
      }), p1Conn as any);

      const opponentStates = getMessages(p2Conn, 'opponent_state');
      expect(opponentStates).toHaveLength(1);
      expect(opponentStates[0].summary.score).toBe(500);
      expect(opponentStates[0].summary.stars).toBe(150);
    });

    it('should update server-tracked stars from state summary', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      relay.onMessage(JSON.stringify({
        type: 'state_summary',
        playerId: 'p1',
        summary: {
          board: [], boardWidth: 10, boardHeight: 20,
          currentPiece: null, nextPieces: [],
          score: 0, stars: 200, linesCleared: 0,
          comboCount: 0, isGameOver: false, activeEffects: [],
        },
      }), p1Conn as any);

      const player = relay.players.get('p1');
      expect(player?.stars).toBe(200);
    });
  });

  describe('stars update', () => {
    it('should update server-tracked stars', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      relay.onMessage(JSON.stringify({
        type: 'stars_update',
        playerId: 'p1',
        stars: 250,
      }), p1Conn as any);

      const player = relay.players.get('p1');
      expect(player?.stars).toBe(250);
    });
  });

  describe('ability activation', () => {
    it('should relay ability activation to target player', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      // Give p1 enough stars
      relay.onMessage(JSON.stringify({
        type: 'stars_update',
        playerId: 'p1',
        stars: 300,
      }), p1Conn as any);

      clearMessages(p1Conn);
      clearMessages(p2Conn);

      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p1',
        abilityType: 'earthquake',
        targetPlayerId: 'p2',
        requestId: 'req_1',
      }), p1Conn as any);

      // Target should receive ability_received
      const received = getMessages(p2Conn, 'ability_received');
      expect(received).toHaveLength(1);
      expect(received[0].abilityType).toBe('earthquake');
      expect(received[0].fromPlayerId).toBe('p1');

      // Source should receive activation result
      const results = getMessages(p1Conn, 'ability_activation_result');
      expect(results).toHaveLength(1);
      expect(results[0].requestId).toBe('req_1');
      expect(results[0].accepted).toBe(true);
    });

    it('should reject ability when insufficient stars', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      // Set stars to 0
      relay.onMessage(JSON.stringify({
        type: 'stars_update',
        playerId: 'p1',
        stars: 0,
      }), p1Conn as any);

      clearMessages(p1Conn);

      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p1',
        abilityType: 'earthquake',
        targetPlayerId: 'p2',
        requestId: 'req_fail',
      }), p1Conn as any);

      const results = getMessages(p1Conn, 'ability_activation_result');
      expect(results).toHaveLength(1);
      expect(results[0].accepted).toBe(false);
      expect(results[0].reason).toBe('insufficient_stars');
    });

    it('should reject unknown ability type', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      clearMessages(p1Conn);

      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p1',
        abilityType: 'nonexistent_ability',
        targetPlayerId: 'p2',
        requestId: 'req_unknown',
      }), p1Conn as any);

      const results = getMessages(p1Conn, 'ability_activation_result');
      expect(results).toHaveLength(1);
      expect(results[0].accepted).toBe(false);
      expect(results[0].reason).toBe('unknown_ability');
    });

    it('should deduct stars from server-tracked balance', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      relay.onMessage(JSON.stringify({
        type: 'stars_update',
        playerId: 'p1',
        stars: 300,
      }), p1Conn as any);

      const earthquakeCost = ABILITIES.earthquake.cost;

      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p1',
        abilityType: 'earthquake',
        targetPlayerId: 'p2',
        requestId: 'req_cost',
      }), p1Conn as any);

      const player = relay.players.get('p1');
      expect(player?.stars).toBe(300 - earthquakeCost);
    });
  });

  describe('defensive effects', () => {
    it('should block ability with shield', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      // Give p1 stars
      relay.onMessage(JSON.stringify({
        type: 'stars_update',
        playerId: 'p1',
        stars: 300,
      }), p1Conn as any);

      // p2 reports active shield
      relay.onMessage(JSON.stringify({
        type: 'defensive_effect_update',
        playerId: 'p2',
        effect: 'shield',
        endTime: Date.now() + 15000,
      }), p2Conn as any);

      clearMessages(p1Conn);
      clearMessages(p2Conn);

      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p1',
        abilityType: 'earthquake',
        targetPlayerId: 'p2',
        requestId: 'req_shield',
      }), p1Conn as any);

      // Ability should be blocked
      const results = getMessages(p1Conn, 'ability_activation_result');
      expect(results).toHaveLength(1);
      expect(results[0].accepted).toBe(false);
      expect(results[0].interceptedBy).toBe('shield');

      // Target should get ability_blocked notification
      const blocked = getMessages(p2Conn, 'ability_blocked');
      expect(blocked).toHaveLength(1);

      // Target should NOT get ability_received
      const received = getMessages(p2Conn, 'ability_received');
      expect(received).toHaveLength(0);
    });

    it('should reflect ability back to caster', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      // Give p1 stars
      relay.onMessage(JSON.stringify({
        type: 'stars_update',
        playerId: 'p1',
        stars: 300,
      }), p1Conn as any);

      // p2 reports active reflect
      relay.onMessage(JSON.stringify({
        type: 'defensive_effect_update',
        playerId: 'p2',
        effect: 'reflect',
        endTime: Date.now() + 12000,
      }), p2Conn as any);

      clearMessages(p1Conn);
      clearMessages(p2Conn);

      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p1',
        abilityType: 'earthquake',
        targetPlayerId: 'p2',
        requestId: 'req_reflect',
      }), p1Conn as any);

      // Ability should be reflected - p1 receives the ability
      const p1Received = getMessages(p1Conn, 'ability_received');
      expect(p1Received).toHaveLength(1);
      expect(p1Received[0].abilityType).toBe('earthquake');

      // Activation result should indicate reflection
      const results = getMessages(p1Conn, 'ability_activation_result');
      expect(results).toHaveLength(1);
      expect(results[0].interceptedBy).toBe('reflect');
    });
  });

  describe('game over', () => {
    it('should handle game_over and broadcast game_finished', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      clearMessages(p1Conn);
      clearMessages(p2Conn);

      relay.onMessage(JSON.stringify({
        type: 'game_over',
        playerId: 'p1',
      }), p1Conn as any);

      const p1Finished = getMessages(p1Conn, 'game_finished');
      const p2Finished = getMessages(p2Conn, 'game_finished');

      expect(p1Finished).toHaveLength(1);
      expect(p2Finished).toHaveLength(1);
      expect(p1Finished[0].winnerId).toBe('p2');
      expect(p1Finished[0].loserId).toBe('p1');
      expect(relay.roomStatus).toBe('finished');
    });

    it('should handle disconnect during game as game_over', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      clearMessages(p1Conn);
      clearMessages(p2Conn);

      relay.onClose(p1Conn as any);

      const p2Finished = getMessages(p2Conn, 'game_finished');
      expect(p2Finished).toHaveLength(1);
      expect(p2Finished[0].winnerId).toBe('p2');
      expect(relay.roomStatus).toBe('finished');
    });
  });

  describe('ping/pong', () => {
    it('should respond to ping with pong', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      clearMessages(p1Conn);

      relay.onMessage(JSON.stringify({
        type: 'ping',
        timestamp: 123456,
      }), p1Conn as any);

      const pongs = getMessages(p1Conn, 'pong');
      expect(pongs).toHaveLength(1);
      expect(pongs[0].timestamp).toBe(123456);
      expect(pongs[0].serverTime).toBeTypeOf('number');
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON', () => {
      const { relay, p1Conn } = createRelay();
      relay.onConnect(p1Conn as any, {} as any);

      relay.onMessage('not valid json', p1Conn as any);

      const errors = getMessages(p1Conn, 'server_error');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('invalid_json');
    });

    it('should handle unsupported message type', () => {
      const { relay, p1Conn } = createRelay();
      relay.onConnect(p1Conn as any, {} as any);

      relay.onMessage(JSON.stringify({ type: 'unknown_type' }), p1Conn as any);

      const errors = getMessages(p1Conn, 'server_error');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('unsupported_message_type');
    });
  });

  describe('clone ability', () => {
    it('should clone opponent last ability', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      // Give both players stars
      relay.onMessage(JSON.stringify({ type: 'stars_update', playerId: 'p1', stars: 300 }), p1Conn as any);
      relay.onMessage(JSON.stringify({ type: 'stars_update', playerId: 'p2', stars: 300 }), p2Conn as any);

      // p2 uses earthquake first
      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p2',
        abilityType: 'earthquake',
        targetPlayerId: 'p1',
        requestId: 'req_p2_eq',
      }), p2Conn as any);

      clearMessages(p1Conn);
      clearMessages(p2Conn);

      // p1 uses clone targeting p2
      // We need loadout to include clone
      const p1Player = relay.players.get('p1');
      if (p1Player) p1Player.loadout = ['clone', 'earthquake', 'shield'];

      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p1',
        abilityType: 'clone',
        targetPlayerId: 'p2',
        requestId: 'req_clone',
      }), p1Conn as any);

      const results = getMessages(p1Conn, 'ability_activation_result');
      expect(results).toHaveLength(1);
      expect(results[0].appliedAbilityType).toBe('earthquake');
    });

    it('should refund clone when no ability to copy', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      relay.onMessage(JSON.stringify({ type: 'stars_update', playerId: 'p1', stars: 300 }), p1Conn as any);
      const p1Player = relay.players.get('p1');
      if (p1Player) p1Player.loadout = ['clone'];

      clearMessages(p1Conn);

      relay.onMessage(JSON.stringify({
        type: 'ability_activation',
        playerId: 'p1',
        abilityType: 'clone',
        targetPlayerId: 'p2',
        requestId: 'req_clone_fail',
      }), p1Conn as any);

      const results = getMessages(p1Conn, 'ability_activation_result');
      expect(results).toHaveLength(1);
      expect(results[0].accepted).toBe(false);
      expect(results[0].reason).toBe('clone_no_ability');
      // Stars should be refunded
      expect(results[0].chargedCost).toBe(0);
    });
  });

  describe('no per-input communication', () => {
    it('should reject player_input messages (not supported in relay mode)', () => {
      const { relay, p1Conn, p2Conn } = createRelay();
      joinTwoPlayers(relay, p1Conn, p2Conn);

      clearMessages(p1Conn);

      relay.onMessage(JSON.stringify({
        type: 'player_input',
        playerId: 'p1',
        input: 'move_left',
      }), p1Conn as any);

      // Should get unsupported_message_type error since relay doesn't handle inputs
      const errors = getMessages(p1Conn, 'server_error');
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('unsupported_message_type');
    });
  });
});
