#!/usr/bin/env node
/**
 * End-to-end deployed PartyKit integration test.
 *
 * What it does:
 * 1) Creates two synthetic players.
 * 2) Connects both to deployed matchmaking and gets matched together.
 * 3) Connects both to the returned game room.
 * 4) Sends live inputs + abilities for a configurable duration.
 * 5) Asserts match resolution (natural game-over by default).
 *
 * Usage examples:
 *   node test-two-player-game.mjs
 *   node test-two-player-game.mjs --host https://tetris-battle.tianzhicdev.partykit.dev
 *   node test-two-player-game.mjs --host tetris-battle.tianzhicdev.partykit.dev --play-ms 45000
 *
 * Optional env:
 *   PARTYKIT_HOST=https://your-project.partykit.dev
 */

import WebSocket from 'ws';

const DEFAULT_HOST =
  process.env.PARTYKIT_HOST || 'https://tetris-battle.tianzhicdev.partykit.dev';

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

function getIntArg(name, fallback) {
  const raw = getArg(name, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getBoolArg(name, fallback) {
  const raw = getArg(name, null);
  if (raw === null) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function toWsOrigin(rawHost) {
  const input = String(rawHost || '').trim();
  if (!input) {
    throw new Error('Missing PartyKit host');
  }

  const stripPath = (s) => s.replace(/\/+$/, '').split('/')[0];
  const isLocalHost = (host) =>
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (input.startsWith('ws://') || input.startsWith('wss://')) {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`;
  }

  if (input.startsWith('http://') || input.startsWith('https://')) {
    const u = new URL(input);
    return `${u.protocol === 'http:' ? 'ws' : 'wss'}://${u.host}`;
  }

  const host = stripPath(input);
  return `${isLocalHost(host) ? 'ws' : 'wss'}://${host}`;
}

function partyWsUrl(wsOrigin, partyName, roomName) {
  return `${wsOrigin}/parties/${partyName}/${roomName}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function safeParse(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

const ABILITY_META = {
  earthquake: { category: 'debuff' },
  screen_shake: { category: 'debuff' },
  speed_up_opponent: { category: 'debuff' },
  rotation_lock: { category: 'debuff' },
  fill_holes: { category: 'buff' },
  clear_rows: { category: 'buff' },
};

class BotPlayer {
  constructor(label, playerId, rank, loadout, strategy = 'chaos') {
    this.label = label;
    this.playerId = playerId;
    this.rank = rank;
    this.loadout = loadout;
    this.strategy = strategy;

    this.matchmakingWs = null;
    this.gameWs = null;
    this.roomId = null;
    this.opponentId = null;
    this.matchData = null;
    this.gameFinished = null;
    this.lastStateUpdateAt = null;

    this.inputTimer = null;
    this.abilityTimer = null;
    this.seq = 0;
    this.nextAbilityIndex = 0;
    this.prevOwnLinesCleared = null;
    this.loggedActionTypes = new Set();
    this.actionCounts = {
      move_left: 0,
      move_right: 0,
      rotate_cw: 0,
      rotate_ccw: 0,
      soft_drop: 0,
      hard_drop: 0,
    };
    this.suicidePattern = ['move_left', 'move_left', 'move_left', 'move_left', 'hard_drop'];
    this.suicideCursor = 0;
  }

  log(...parts) {
    console.log(`[${this.label}]`, ...parts);
  }

  connectMatchmaking(url) {
    return new Promise((resolve, reject) => {
      let settled = false;
      this.log('Connecting to matchmaking:', url);
      const ws = new WebSocket(url);
      this.matchmakingWs = ws;

      ws.on('open', () => {
        this.log('Connected. Sending join_queue');
        ws.send(
          JSON.stringify({
            type: 'join_queue',
            playerId: this.playerId,
            rank: this.rank,
          })
        );
      });

      ws.on('message', (raw) => {
        const msg = safeParse(raw);
        if (!msg) {
          this.log('Received non-JSON payload');
          return;
        }

        switch (msg.type) {
          case 'queue_joined':
            this.log(`Queue joined at position #${msg.position}`);
            break;
          case 'already_in_queue':
            this.log('Already in queue');
            break;
          case 'match_found':
            this.roomId = msg.roomId;
            this.matchData = msg;
            this.log(`Match found in room ${msg.roomId} (${msg.player1} vs ${msg.player2})`);
            settled = true;
            resolve(msg);
            ws.close(1000, 'matched');
            break;
          default:
            break;
        }
      });

      ws.on('error', (err) => {
        if (settled) return;
        settled = true;
        reject(new Error(`Matchmaking socket error: ${err.message}`));
      });

      ws.on('close', (code, reasonBuf) => {
        const reason = reasonBuf?.toString?.() || '';
        this.log(`Matchmaking closed (code=${code} reason=${reason || '(empty)'})`);
        if (!settled) {
          settled = true;
          reject(new Error('Matchmaking closed before match_found'));
        }
      });
    });
  }

  connectGame(wsOrigin, roomId, opponentId) {
    this.roomId = roomId;
    this.opponentId = opponentId;

    return new Promise((resolve, reject) => {
      let settled = false;
      const url = partyWsUrl(wsOrigin, 'game', roomId);
      this.log('Connecting to game:', url);
      const ws = new WebSocket(url);
      this.gameWs = ws;

      ws.on('open', () => {
        this.log('Connected. Sending join_game');
        ws.send(
          JSON.stringify({
            type: 'join_game',
            playerId: this.playerId,
            loadout: this.loadout,
          })
        );
      });

      ws.on('message', (raw) => {
        const msg = safeParse(raw);
        if (!msg) return;

        switch (msg.type) {
          case 'room_state':
            break;
          case 'game_start':
            this.log('Game started');
            this.startPlayLoops();
            if (!settled) {
              settled = true;
              resolve();
            }
            break;
          case 'state_update':
            this.lastStateUpdateAt = Date.now();
            this.trackStateProgress(msg.yourState);
            // Start loops once state stream confirms server tick is active.
            if (!this.inputTimer) {
              this.startPlayLoops();
            }
            if (!settled) {
              settled = true;
              resolve();
            }
            break;
          case 'ability_received':
            this.log(`Received ability: ${msg.abilityType} from ${msg.fromPlayerId}`);
            break;
          case 'ability_activation_result':
            if (msg.accepted) {
              this.log(`Ability used: ${msg.abilityType} (stars=${msg.remainingStars ?? 'n/a'})`);
              if (msg.abilityType === 'clear_rows') {
                this.log('Rows cleared via ability: clear_rows');
              }
            } else {
              this.log(`Ability rejected: ${msg.abilityType} (${msg.reason || 'unknown'})`);
            }
            break;
          case 'game_finished':
            this.gameFinished = msg;
            this.log(`Game finished. winner=${msg.winnerId} loser=${msg.loserId}`);
            this.stopPlayLoops();
            break;
          case 'opponent_disconnected':
            this.log('Opponent disconnected event received');
            break;
          case 'server_error':
            this.log(`Server error: ${msg.code} ${msg.message}`);
            break;
          default:
            break;
        }
      });

      ws.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(new Error(`Game socket error: ${err.message}`));
        }
      });

      ws.on('close', (code, reasonBuf) => {
        const reason = reasonBuf?.toString?.() || '';
        this.log(`Game closed (code=${code} reason=${reason || '(empty)'})`);
        this.stopPlayLoops();
        if (!settled) {
          settled = true;
          reject(new Error('Game socket closed before start'));
        }
      });
    });
  }

  startPlayLoops() {
    if (!this.gameWs || this.gameWs.readyState !== WebSocket.OPEN) return;
    if (this.inputTimer || this.abilityTimer) return;

    this.inputTimer = setInterval(() => {
      if (!this.gameWs || this.gameWs.readyState !== WebSocket.OPEN) return;
      let input;
      if (this.strategy === 'suicide') {
        input = this.suicidePattern[this.suicideCursor % this.suicidePattern.length];
        this.suicideCursor += 1;
      } else {
        // Weighted to exercise movement/rotation/drop with frequent locks.
        const inputs = [
          'move_left',
          'move_right',
          'rotate_cw',
          'rotate_ccw',
          'soft_drop',
          'hard_drop',
          'hard_drop',
          'hard_drop',
          'hard_drop',
        ];
        input = inputs[Math.floor(Math.random() * inputs.length)];
      }
      this.sendInput(input);
    }, 140);

    this.abilityTimer = setInterval(() => {
      if (!this.gameWs || this.gameWs.readyState !== WebSocket.OPEN) return;
      if (!this.opponentId || this.loadout.length === 0) return;

      const abilityType = this.loadout[this.nextAbilityIndex % this.loadout.length];
      this.nextAbilityIndex += 1;
      const meta = ABILITY_META[abilityType];
      const targetPlayerId =
        meta?.category === 'buff' ? this.playerId : this.opponentId;

      this.gameWs.send(
        JSON.stringify({
          type: 'ability_activation',
          playerId: this.playerId,
          abilityType,
          targetPlayerId,
          requestId: `${this.playerId}_${Date.now()}_${this.nextAbilityIndex}`,
        })
      );
    }, 3000);
  }

  sendInput(input) {
    this.seq += 1;
    if (this.actionCounts[input] !== undefined) {
      this.actionCounts[input] += 1;
    }
    // Keep logs readable: always show first occurrence per action type,
    // then periodic sampled action logs.
    if (!this.loggedActionTypes.has(input) || this.seq % 25 === 0) {
      this.loggedActionTypes.add(input);
      this.log(`Action: ${input}`);
    }
    this.gameWs.send(
      JSON.stringify({
        type: 'player_input',
        playerId: this.playerId,
        input,
        seq: this.seq,
      })
    );
  }

  trackStateProgress(yourState) {
    if (!yourState || typeof yourState.linesCleared !== 'number') return;
    if (this.prevOwnLinesCleared === null) {
      this.prevOwnLinesCleared = yourState.linesCleared;
      return;
    }

    if (yourState.linesCleared > this.prevOwnLinesCleared) {
      const delta = yourState.linesCleared - this.prevOwnLinesCleared;
      this.log(`Rows cleared: +${delta} (total=${yourState.linesCleared})`);
    }
    this.prevOwnLinesCleared = yourState.linesCleared;
  }

  stopPlayLoops() {
    if (this.inputTimer) {
      clearInterval(this.inputTimer);
      this.inputTimer = null;
    }
    if (this.abilityTimer) {
      clearInterval(this.abilityTimer);
      this.abilityTimer = null;
    }
  }

  disconnectGame(reason = 'script_disconnect') {
    this.stopPlayLoops();
    if (this.gameWs && this.gameWs.readyState === WebSocket.OPEN) {
      this.gameWs.close(4000, reason);
    }
  }

  closeAll() {
    this.stopPlayLoops();
    if (this.matchmakingWs && this.matchmakingWs.readyState <= WebSocket.OPEN) {
      this.matchmakingWs.close(1000, 'cleanup');
    }
    if (this.gameWs && this.gameWs.readyState <= WebSocket.OPEN) {
      this.gameWs.close(1000, 'cleanup');
    }
  }

  printActionSummary() {
    this.log(
      `Action summary: left=${this.actionCounts.move_left} right=${this.actionCounts.move_right} rotate_cw=${this.actionCounts.rotate_cw} rotate_ccw=${this.actionCounts.rotate_ccw} soft_drop=${this.actionCounts.soft_drop} hard_drop=${this.actionCounts.hard_drop}`
    );
  }
}

async function waitForGameFinished(players, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const finished = players.find((p) => p.gameFinished);
    if (finished) return finished.gameFinished;
    await sleep(100);
  }
  return null;
}

async function main() {
  const host = getArg('host', DEFAULT_HOST);
  const matchTimeoutMs = getIntArg('match-timeout-ms', 25000);
  const playMs = getIntArg('play-ms', 90000);
  const postDisconnectWaitMs = getIntArg('post-disconnect-wait-ms', 10000);
  const forceDisconnectOnTimeout = getBoolArg('force-disconnect-on-timeout', false);
  const rank1 = getIntArg('rank1', 1000);
  const rank2 = getIntArg('rank2', 1005);
  const p1Strategy = getArg('p1-strategy', 'suicide');
  const p2Strategy = getArg('p2-strategy', 'chaos');

  const wsOrigin = toWsOrigin(host);
  const matchmakingUrl = partyWsUrl(wsOrigin, 'matchmaking', 'global');
  const runId = Date.now().toString(36);

  console.log('='.repeat(72));
  console.log('Two-Player Deployed PartyKit Integration Test');
  console.log('Host:', host);
  console.log('WS Origin:', wsOrigin);
  console.log('Matchmaking URL:', matchmakingUrl);
  console.log('Run ID:', runId);
  console.log('Force disconnect on timeout:', forceDisconnectOnTimeout);
  console.log('P1 strategy:', p1Strategy);
  console.log('P2 strategy:', p2Strategy);
  console.log('='.repeat(72));

  const loadout = [
    'clear_rows',
    'earthquake',
    'screen_shake',
    'speed_up_opponent',
    'fill_holes',
    'rotation_lock',
  ];

  const p1 = new BotPlayer('P1', `script_p1_${runId}`, rank1, loadout, p1Strategy);
  const p2 = new BotPlayer('P2', `script_p2_${runId}`, rank2, loadout, p2Strategy);

  try {
    const [m1, m2] = await withTimeout(
      Promise.all([p1.connectMatchmaking(matchmakingUrl), p2.connectMatchmaking(matchmakingUrl)]),
      matchTimeoutMs,
      'Matchmaking'
    );

    if (m1.aiOpponent || m2.aiOpponent) {
      throw new Error('Expected human-vs-human match, got AI fallback');
    }
    if (m1.roomId !== m2.roomId) {
      throw new Error(`Players matched into different rooms (${m1.roomId} vs ${m2.roomId})`);
    }

    const roomId = m1.roomId;
    const p1OpponentId = m1.player1 === p1.playerId ? m1.player2 : m1.player1;
    const p2OpponentId = m2.player1 === p2.playerId ? m2.player2 : m2.player1;

    console.log(`Matched together in room ${roomId}`);
    console.log(`P1 opponent: ${p1OpponentId}`);
    console.log(`P2 opponent: ${p2OpponentId}`);

    await withTimeout(
      Promise.all([
        p1.connectGame(wsOrigin, roomId, p1OpponentId),
        p2.connectGame(wsOrigin, roomId, p2OpponentId),
      ]),
      15000,
      'Game room join'
    );

    console.log(`Both players joined game room. Letting them play for ${playMs}ms...`);
    let finished = await waitForGameFinished([p1, p2], playMs);

    if (!finished && forceDisconnectOnTimeout) {
      console.log('No natural game_finished yet. Forcing P1 disconnect to validate disconnect-loss flow...');
      p1.disconnectGame('forced_disconnect_for_assertion');
      finished = await waitForGameFinished([p1, p2], postDisconnectWaitMs);
    }

    if (!finished) {
      throw new Error(
        `No natural game_finished observed within ${playMs}ms. Increase --play-ms or pass --force-disconnect-on-timeout true`
      );
    }

    const p1Result = p1.gameFinished;
    const p2Result = p2.gameFinished;

    if (p1Result && p2Result && p1Result.winnerId !== p2Result.winnerId) {
      throw new Error(`Players disagree on winner (${p1Result.winnerId} vs ${p2Result.winnerId})`);
    }

    const winnerId = finished.winnerId;
    const loserId = finished.loserId;
    const lastUpdateAgeP1 = p1.lastStateUpdateAt ? Date.now() - p1.lastStateUpdateAt : null;
    const lastUpdateAgeP2 = p2.lastStateUpdateAt ? Date.now() - p2.lastStateUpdateAt : null;

    console.log('-'.repeat(72));
    console.log('Integration test passed');
    console.log('Room:', roomId);
    console.log('Winner:', winnerId);
    console.log('Loser:', loserId);
    console.log('P1 saw recent state_update age(ms):', lastUpdateAgeP1 ?? 'n/a');
    console.log('P2 saw recent state_update age(ms):', lastUpdateAgeP2 ?? 'n/a');
    p1.printActionSummary();
    p2.printActionSummary();
    console.log('-'.repeat(72));
  } finally {
    p1.closeAll();
    p2.closeAll();
  }
}

main().catch((error) => {
  console.error('Integration test failed:', error.message);
  process.exit(1);
});
