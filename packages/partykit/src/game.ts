import type * as Party from "partykit/server";

interface GameState {
  board: any;
  score: number;
  stars: number;
  linesCleared: number;
  comboCount: number;
  isGameOver: boolean;
}

interface PlayerState {
  playerId: string;
  connectionId: string;
  gameState: GameState | null;
}

export default class GameRoomServer implements Party.Server {
  players: Map<string, PlayerState> = new Map();
  roomStatus: 'waiting' | 'playing' | 'finished' = 'waiting';
  winnerId: string | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connected to game room ${this.room.id}: ${conn.id}`);

    // Send current room state
    conn.send(JSON.stringify({
      type: 'room_state',
      status: this.roomStatus,
      playerCount: this.players.size,
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'join_game':
        this.handleJoinGame(data.playerId, sender);
        break;
      case 'game_state_update':
        this.handleGameStateUpdate(data.playerId, data.state, sender);
        break;
      case 'game_event':
        this.handleGameEvent(data.playerId, data.event, sender);
        break;
      case 'ability_activation':
        this.handleAbilityActivation(data.playerId, data.abilityType, data.targetPlayerId);
        break;
      case 'game_over':
        this.handleGameOver(data.playerId);
        break;
    }
  }

  handleJoinGame(playerId: string, conn: Party.Connection) {
    this.players.set(playerId, {
      playerId,
      connectionId: conn.id,
      gameState: null,
    });

    console.log(`Player ${playerId} joined. Total players: ${this.players.size}`);

    // If we have 2 players, start the game
    if (this.players.size === 2 && this.roomStatus === 'waiting') {
      this.roomStatus = 'playing';
      this.broadcast({
        type: 'game_start',
        players: Array.from(this.players.keys()),
      });
    }

    // Send opponent info if available
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      conn.send(JSON.stringify({
        type: 'opponent_info',
        opponentId: opponent.playerId,
        opponentState: opponent.gameState,
      }));
    }
  }

  handleGameStateUpdate(playerId: string, state: GameState, sender: Party.Connection) {
    const player = this.players.get(playerId);
    if (!player) return;

    player.gameState = state;

    // Broadcast to opponent
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      const opponentConn = this.getConnection(opponent.connectionId);
      if (opponentConn) {
        opponentConn.send(JSON.stringify({
          type: 'opponent_state_update',
          state,
        }));
      }
    }
  }

  handleGameEvent(playerId: string, event: any, sender: Party.Connection) {
    // Broadcast event to opponent
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      const opponentConn = this.getConnection(opponent.connectionId);
      if (opponentConn) {
        opponentConn.send(JSON.stringify({
          type: 'opponent_event',
          event,
        }));
      }
    }
  }

  handleAbilityActivation(playerId: string, abilityType: string, targetPlayerId: string) {
    const targetPlayer = this.players.get(targetPlayerId);
    if (!targetPlayer) return;

    const targetConn = this.getConnection(targetPlayer.connectionId);
    if (targetConn) {
      targetConn.send(JSON.stringify({
        type: 'ability_received',
        abilityType,
        fromPlayerId: playerId,
      }));
    }
  }

  handleGameOver(playerId: string) {
    const player = this.players.get(playerId);
    if (!player || !player.gameState) return;

    player.gameState.isGameOver = true;

    // Determine winner
    const opponent = this.getOpponent(playerId);
    if (opponent) {
      this.winnerId = opponent.playerId;
      this.roomStatus = 'finished';

      this.broadcast({
        type: 'game_finished',
        winnerId: this.winnerId,
        loserId: playerId,
      });
    }
  }

  getOpponent(playerId: string): PlayerState | null {
    for (const [id, player] of this.players) {
      if (id !== playerId) return player;
    }
    return null;
  }

  getConnection(connectionId: string): Party.Connection | null {
    for (const conn of this.room.getConnections()) {
      if (conn.id === connectionId) return conn;
    }
    return null;
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.room.broadcast(message);
  }

  onClose(conn: Party.Connection) {
    // Find and remove player
    for (const [playerId, player] of this.players) {
      if (player.connectionId === conn.id) {
        this.players.delete(playerId);
        console.log(`Player ${playerId} disconnected`);

        // Notify opponent
        const opponent = this.getOpponent(playerId);
        if (opponent) {
          const opponentConn = this.getConnection(opponent.connectionId);
          if (opponentConn) {
            opponentConn.send(JSON.stringify({
              type: 'opponent_disconnected',
            }));
          }
        }
        break;
      }
    }
  }
}
