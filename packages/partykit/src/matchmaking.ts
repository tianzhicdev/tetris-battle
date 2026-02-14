import type * as Party from "partykit/server";

interface QueuedPlayer {
  id: string;
  connectionId: string;
  joinedAt: number;
  elo?: number; // Optional: for future Elo-based matching when population is higher
}

export default class MatchmakingServer implements Party.Server {
  queue: QueuedPlayer[] = [];

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connected: ${conn.id}`);
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);

    if (data.type === 'join_queue') {
      this.handleJoinQueue(data.playerId, sender);
    } else if (data.type === 'leave_queue') {
      this.handleLeaveQueue(data.playerId);
    }
  }

  handleJoinQueue(playerId: string, conn: Party.Connection) {
    // Check if already in queue
    if (this.queue.find(p => p.id === playerId)) {
      conn.send(JSON.stringify({ type: 'already_in_queue' }));
      return;
    }

    // Add to queue
    this.queue.push({
      id: playerId,
      connectionId: conn.id,
      joinedAt: Date.now(),
    });

    console.log(`Queue size: ${this.queue.length}`);

    // Send queue position
    conn.send(JSON.stringify({
      type: 'queue_joined',
      position: this.queue.length,
    }));

    // Try to match
    this.tryMatch();
  }

  handleLeaveQueue(playerId: string) {
    this.queue = this.queue.filter(p => p.id !== playerId);
  }

  tryMatch() {
    // Need at least 2 players
    if (this.queue.length < 2) return;

    // MATCHMAKING STRATEGY: Prioritize speed over Elo matching
    // For low-population games, instant matches are more important than perfect skill matching
    // Match first two players in queue regardless of Elo difference
    // This prevents long wait times and abandoned queues
    // Future enhancement: When population is high (queue > 10 players), implement Elo-based matching
    const player1 = this.queue.shift()!;
    const player2 = this.queue.shift()!;

    // Generate room ID
    const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Matched ${player1.id} vs ${player2.id} in room ${roomId}`);

    // Create match message
    const matchMessage = JSON.stringify({
      type: 'match_found',
      roomId,
      player1: player1.id,
      player2: player2.id,
    });

    // Send to both players
    const conn1 = [...this.room.getConnections()].find(c => c.id === player1.connectionId);
    if (conn1) conn1.send(matchMessage);

    const conn2 = [...this.room.getConnections()].find(c => c.id === player2.connectionId);
    if (conn2) conn2.send(matchMessage);
  }

  onClose(conn: Party.Connection) {
    // Remove from queue if disconnected
    this.queue = this.queue.filter(p => p.connectionId !== conn.id);
  }
}
