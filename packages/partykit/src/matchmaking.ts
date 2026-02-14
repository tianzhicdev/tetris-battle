import type * as Party from "partykit/server";
import { generateAIPersona } from '@tetris-battle/game-core';

interface QueuedPlayer {
  id: string;
  connectionId: string;
  joinedAt: number;
  rank?: number; // Player rank for AI difficulty matching
}

export default class MatchmakingServer implements Party.Server {
  queue: QueuedPlayer[] = [];
  aiFallbackInterval: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {
    console.log('[MATCHMAKING] Server initialized');
    // Check for AI fallback every 2 seconds
    this.aiFallbackInterval = setInterval(() => {
      console.log(`[MATCHMAKING] AI fallback check - Queue size: ${this.queue.length}`);
      this.checkAIFallback();
    }, 2000);
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connected: ${conn.id}`);
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);

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

    // Add to queue
    this.queue.push({
      id: playerId,
      connectionId: conn.id,
      joinedAt: Date.now(),
      rank,
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
    if (this.queue.length < 2) {
      // Check if anyone has been waiting long enough for AI fallback
      this.checkAIFallback();
      return;
    }

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

  checkAIFallback() {
    const now = Date.now();
    const AI_FALLBACK_TIMEOUT = 20000; // 20 seconds

    for (const player of this.queue) {
      const waitTime = now - player.joinedAt;
      console.log(`[AI FALLBACK] Player ${player.id} wait time: ${waitTime}ms (threshold: ${AI_FALLBACK_TIMEOUT}ms)`);

      if (waitTime >= AI_FALLBACK_TIMEOUT) {
        console.log(`[AI FALLBACK] Triggering for player ${player.id}`);

        // Remove from queue
        this.queue = this.queue.filter(p => p.id !== player.id);

        try {
          // Generate AI opponent matching player's rank
          const aiPersona = generateAIPersona(player.rank);
          const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          console.log(`[AI FALLBACK] Matched ${player.id} vs ${aiPersona.id} (${aiPersona.difficulty}, rank: ${aiPersona.rank})`);

          // Send match_found with AI opponent data
          const conn = [...this.room.getConnections()].find(c => c.id === player.connectionId);
          if (conn) {
            console.log(`[AI FALLBACK] Sending match_found to player`);
            conn.send(JSON.stringify({
              type: 'match_found',
              roomId,
              player1: player.id,
              player2: aiPersona.id,
              aiOpponent: aiPersona, // Include full AI persona for client
            }));
          } else {
            console.log(`[AI FALLBACK] ERROR: Connection not found for player ${player.id}`);
          }
        } catch (error) {
          console.error('[AI FALLBACK] ERROR generating AI persona:', error);
        }

        // Only process one AI fallback per check
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    // Remove from queue if disconnected
    this.queue = this.queue.filter(p => p.connectionId !== conn.id);
  }
}
