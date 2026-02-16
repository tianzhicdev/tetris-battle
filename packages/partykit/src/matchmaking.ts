import type * as Party from "partykit/server";
import { generateAIPersona } from '@tetris-battle/game-core';

interface QueuedPlayer {
  id: string;
  connectionId: string;
  rank?: number; // Player rank for AI difficulty matching
  aiFallbackTimer: ReturnType<typeof setTimeout> | null;
}

export default class MatchmakingServer implements Party.Server {
  private static readonly AI_FALLBACK_TIMEOUT_MS = 20000;

  queue: QueuedPlayer[] = [];

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    void ctx;
    void conn;
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: any;
    try {
      data = JSON.parse(message);
    } catch (error) {
      console.warn('[MATCHMAKING] Ignoring non-JSON message:', message, error);
      return;
    }

    if (data.type === 'join_queue') {
      this.handleJoinQueue(data.playerId, data.rank, sender);
    } else if (data.type === 'leave_queue') {
      this.handleLeaveQueue(data.playerId);
    }
  }

  handleJoinQueue(playerId: string, rank: number | undefined, conn: Party.Connection) {
    // Check if already in queue
    if (this.queue.find(p => p.id === playerId)) {
      conn.send(JSON.stringify({ type: 'already_in_queue' }));
      return;
    }

    const aiFallbackTimer = setTimeout(() => {
      this.matchWithAI(playerId);
    }, MatchmakingServer.AI_FALLBACK_TIMEOUT_MS);

    // Add to queue
    this.queue.push({
      id: playerId,
      connectionId: conn.id,
      rank,
      aiFallbackTimer,
    });

    // Send queue position
    conn.send(JSON.stringify({
      type: 'queue_joined',
      position: this.queue.length,
    }));

    // Try immediate human match first.
    this.tryMatch();
  }

  handleLeaveQueue(playerId: string) {
    this.removeFromQueue(playerId);
  }

  tryMatch() {
    // Need at least 2 players
    if (this.queue.length < 2) {
      return;
    }

    const player1 = this.queue.shift()!;
    const player2 = this.queue.shift()!;
    this.clearPlayerTimer(player1);
    this.clearPlayerTimer(player2);

    // Generate room ID
    const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create match message
    const matchMessage = JSON.stringify({
      type: 'match_found',
      roomId,
      player1: player1.id,
      player2: player2.id,
    });

    // Send to both players
    const allConnections = [...this.room.getConnections()];
    const conn1 = allConnections.find(c => c.id === player1.connectionId);
    if (conn1) {
      conn1.send(matchMessage);
    } else {
      console.warn(`[MATCHMAKING] Connection not found for player ${player1.id}`);
    }

    const conn2 = allConnections.find(c => c.id === player2.connectionId);
    if (conn2) {
      conn2.send(matchMessage);
    } else {
      console.warn(`[MATCHMAKING] Connection not found for player ${player2.id}`);
    }
  }

  private matchWithAI(playerId: string): void {
    const playerIndex = this.queue.findIndex((p) => p.id === playerId);
    if (playerIndex < 0) return;

    const [player] = this.queue.splice(playerIndex, 1);
    this.clearPlayerTimer(player);

    try {
      const aiPersona = generateAIPersona(player.rank);
      const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const conn = this.getConnection(player.connectionId);
      if (!conn) {
        console.warn(`[MATCHMAKING] Connection not found for AI fallback player ${player.id}`);
        return;
      }

      conn.send(JSON.stringify({
        type: 'match_found',
        roomId,
        player1: player.id,
        player2: aiPersona.id,
        aiOpponent: aiPersona,
      }));
    } catch (error) {
      console.error('[MATCHMAKING] AI fallback failed:', error);
    }
  }

  onClose(conn: Party.Connection) {
    const player = this.queue.find((p) => p.connectionId === conn.id);
    if (!player) return;
    this.removeFromQueue(player.id);
  }

  private clearPlayerTimer(player: QueuedPlayer | undefined): void {
    if (!player?.aiFallbackTimer) return;
    clearTimeout(player.aiFallbackTimer);
    player.aiFallbackTimer = null;
  }

  private removeFromQueue(playerId: string): void {
    const player = this.queue.find((p) => p.id === playerId);
    this.clearPlayerTimer(player);
    this.queue = this.queue.filter((p) => p.id !== playerId);
  }

  private getConnection(connectionId: string): Party.Connection | undefined {
    return [...this.room.getConnections()].find((c) => c.id === connectionId);
  }
}
