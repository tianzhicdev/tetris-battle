import type * as Party from "partykit/server";
import { generateAIPersona } from '@tetris-battle/game-core';

interface QueuedPlayer {
  id: string;
  connectionId: string;
  rank?: number; // Player rank for AI difficulty matching
  mode?: 'normal' | 'defense'; // Game mode
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
      this.handleJoinQueue(data.playerId, data.rank, data.mode, sender);
    } else if (data.type === 'leave_queue') {
      this.handleLeaveQueue(data.playerId);
    }
  }

  handleJoinQueue(playerId: string, rank: number | undefined, mode: 'normal' | 'defense' | undefined, conn: Party.Connection) {
    const gameMode = mode || 'normal';

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
      mode: gameMode,
      aiFallbackTimer,
    });

    // Send queue position (count only same mode)
    const sameModeCount = this.queue.filter(p => p.mode === gameMode).length;
    conn.send(JSON.stringify({
      type: 'queue_joined',
      position: sameModeCount,
    }));

    // Try immediate human match first.
    this.tryMatch();
  }

  handleLeaveQueue(playerId: string) {
    this.removeFromQueue(playerId);
  }

  tryMatch() {
    // Group players by mode
    const normalPlayers = this.queue.filter(p => p.mode === 'normal' || !p.mode);
    const defensePlayers = this.queue.filter(p => p.mode === 'defense');

    // Try to match normal players
    if (normalPlayers.length >= 2) {
      this.matchPlayers(normalPlayers[0], normalPlayers[1], 'normal');
    }

    // Try to match defense players
    if (defensePlayers.length >= 2) {
      this.matchPlayers(defensePlayers[0], defensePlayers[1], 'defense');
    }
  }

  private matchPlayers(player1: QueuedPlayer, player2: QueuedPlayer, mode: 'normal' | 'defense'): void {
    // Remove from queue
    this.queue = this.queue.filter(p => p.id !== player1.id && p.id !== player2.id);
    this.clearPlayerTimer(player1);
    this.clearPlayerTimer(player2);

    // Generate room ID
    const roomId = mode === 'defense'
      ? `defenseline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create match message
    const matchMessage = JSON.stringify({
      type: 'match_found',
      roomId,
      player1: player1.id,
      player2: player2.id,
      mode,
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
      const mode = player.mode || 'normal';
      const aiPersona = mode === 'normal' ? generateAIPersona(player.rank) : null;
      const roomId = mode === 'defense'
        ? `defenseline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const conn = this.getConnection(player.connectionId);
      if (!conn) {
        console.warn(`[MATCHMAKING] Connection not found for AI fallback player ${player.id}`);
        return;
      }

      conn.send(JSON.stringify({
        type: 'match_found',
        roomId,
        player1: player.id,
        player2: mode === 'normal' ? aiPersona!.id : `ai_defense_${Date.now()}`,
        mode,
        aiOpponent: mode === 'normal' ? aiPersona : undefined,
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
