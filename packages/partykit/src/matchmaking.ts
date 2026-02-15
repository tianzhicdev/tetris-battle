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

  // Configure server options to prevent hibernation
  static options: Party.ServerOptions = {
    hibernate: false, // Disable hibernation to keep matchmaking state
  };

  constructor(readonly room: Party.Room) {
    console.log('[MATCHMAKING] Server initialized at', new Date().toISOString());
    console.log('[MATCHMAKING] Hibernation disabled - server will persist');

    // Check for AI fallback every 2 seconds
    this.aiFallbackInterval = setInterval(() => {
      console.log(`[MATCHMAKING] AI fallback check - Queue size: ${this.queue.length}`);
      this.checkAIFallback();
    }, 2000);

    // Schedule initial alarm to keep server alive and process queue
    const nextAlarmTime = Date.now() + 5000;
    this.room.storage.setAlarm(nextAlarmTime).catch(err => {
      console.error('[MATCHMAKING] Failed to schedule initial alarm:', err);
    });
  }

  // Alarm API to prevent hibernation and process queue
  async onAlarm() {
    console.log(`[MATCHMAKING ALARM] Triggered at ${new Date().toISOString()} - Queue size: ${this.queue.length}`);

    try {
      // Process any pending matches
      if (this.queue.length >= 2) {
        console.log('[MATCHMAKING ALARM] Attempting to match players');
        this.tryMatch();
      }

      // Check for AI fallbacks
      this.checkAIFallback();

      // Schedule next alarm (must be done at END of alarm handler)
      const nextAlarmTime = Date.now() + 5000; // 5 seconds
      await this.room.storage.setAlarm(nextAlarmTime);
      console.log(`[MATCHMAKING ALARM] Next alarm scheduled for ${new Date(nextAlarmTime).toISOString()}`);
    } catch (error) {
      console.error('[MATCHMAKING ALARM] ERROR:', error);
      // Try to reschedule even if error occurs
      try {
        await this.room.storage.setAlarm(Date.now() + 5000);
      } catch (rescheduleError) {
        console.error('[MATCHMAKING ALARM] Failed to reschedule:', rescheduleError);
      }
    }
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[MATCHMAKING] Player connected: ${conn.id} at ${new Date().toISOString()}`);
    console.log(`[MATCHMAKING] Active connections: ${[...this.room.getConnections()].length}`);
    console.log(`[MATCHMAKING] Current queue size: ${this.queue.length}`);
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
    console.log(`[MATCHMAKING JOIN] Player ${playerId} (rank: ${rank}) joining queue at ${new Date().toISOString()}`);
    console.log(`[MATCHMAKING JOIN] Connection ID: ${conn.id}`);
    console.log(`[MATCHMAKING JOIN] Queue before join:`, this.queue.map(p => `${p.id} (${p.connectionId})`));

    // Check if already in queue
    if (this.queue.find(p => p.id === playerId)) {
      console.log(`[MATCHMAKING JOIN] Player ${playerId} already in queue - rejecting`);
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

    console.log(`[MATCHMAKING JOIN] Player ${playerId} added to queue. New queue size: ${this.queue.length}`);
    console.log(`[MATCHMAKING JOIN] Queue after join:`, this.queue.map(p => `${p.id} (${p.connectionId})`));

    // Send queue position
    conn.send(JSON.stringify({
      type: 'queue_joined',
      position: this.queue.length,
    }));

    // Try to match immediately
    console.log(`[MATCHMAKING JOIN] Calling tryMatch() with queue size ${this.queue.length}`);
    this.tryMatch();
  }

  handleLeaveQueue(playerId: string) {
    this.queue = this.queue.filter(p => p.id !== playerId);
  }

  tryMatch() {
    console.log(`[MATCHMAKING] tryMatch called - Queue size: ${this.queue.length}`);

    // Need at least 2 players
    if (this.queue.length < 2) {
      console.log('[MATCHMAKING] Not enough players for match, checking AI fallback');
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

    console.log(`[HUMAN MATCH] Matched ${player1.id} vs ${player2.id} in room ${roomId}`);

    // Create match message
    const matchMessage = JSON.stringify({
      type: 'match_found',
      roomId,
      player1: player1.id,
      player2: player2.id,
    });

    // Send to both players
    const allConnections = [...this.room.getConnections()];
    console.log(`[HUMAN MATCH] Total connections: ${allConnections.length}`);

    const conn1 = allConnections.find(c => c.id === player1.connectionId);
    if (conn1) {
      console.log(`[HUMAN MATCH] Sending match to player1: ${player1.id}`);
      conn1.send(matchMessage);
    } else {
      console.log(`[HUMAN MATCH] ERROR: Connection not found for player1: ${player1.id}`);
    }

    const conn2 = allConnections.find(c => c.id === player2.connectionId);
    if (conn2) {
      console.log(`[HUMAN MATCH] Sending match to player2: ${player2.id}`);
      conn2.send(matchMessage);
    } else {
      console.log(`[HUMAN MATCH] ERROR: Connection not found for player2: ${player2.id}`);
    }
  }

  checkAIFallback() {
    const now = Date.now();
    const AI_FALLBACK_TIMEOUT = 20000; // 20 seconds

    for (const player of this.queue) {
      const waitTime = now - player.joinedAt;
      console.log(`[AI FALLBACK] Player ${player.id} wait time: ${waitTime}ms (threshold: ${AI_FALLBACK_TIMEOUT}ms)`);

      if (waitTime >= AI_FALLBACK_TIMEOUT) {
        console.log(`[AI FALLBACK] Triggering for player ${player.id}`);
        console.log(`[AI FALLBACK] Creating AI for player rank: ${player.rank}`);

        // Remove from queue
        this.queue = this.queue.filter(p => p.id !== player.id);

        try {
          // Generate AI opponent matching player's rank
          const aiPersona = generateAIPersona(player.rank);
          const roomId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          console.log(`[AI FALLBACK] Matched ${player.id} vs ${aiPersona.id} (rank: ${aiPersona.rank})`);

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
    console.log(`[MATCHMAKING CLOSE] Connection closed: ${conn.id} at ${new Date().toISOString()}`);
    const removedPlayer = this.queue.find(p => p.connectionId === conn.id);
    if (removedPlayer) {
      console.log(`[MATCHMAKING CLOSE] Removing player ${removedPlayer.id} from queue`);
    }

    // Remove from queue if disconnected
    this.queue = this.queue.filter(p => p.connectionId !== conn.id);

    console.log(`[MATCHMAKING CLOSE] Queue size after removal: ${this.queue.length}`);
    console.log(`[MATCHMAKING CLOSE] Remaining active connections: ${[...this.room.getConnections()].length}`);
  }
}
