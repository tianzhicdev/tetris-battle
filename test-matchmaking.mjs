#!/usr/bin/env node
/**
 * Matchmaking Test Script
 *
 * Simulates two players joining matchmaking and verifies they match together.
 *
 * Usage:
 *   node test-matchmaking.mjs
 *   node test-matchmaking.mjs --host https://tetris-battle.tianzhicdev.partykit.dev
 */

import WebSocket from 'ws';

const HOST = process.argv.includes('--host')
  ? process.argv[process.argv.indexOf('--host') + 1]
  : 'https://tetris-battle.tianzhicdev.partykit.dev';

const MATCHMAKING_URL = `${HOST.replace('https://', 'wss://').replace('http://', 'ws://')}/parties/matchmaking/global`;

console.log('🎮 Testing Matchmaking');
console.log('Host:', HOST);
console.log('WebSocket URL:', MATCHMAKING_URL);
console.log('─'.repeat(50));

// Player data
const player1 = {
  id: `test_player1_${Date.now()}`,
  rank: 1000,
  ws: null,
  matched: false,
  matchData: null,
};

const player2 = {
  id: `test_player2_${Date.now()}`,
  rank: 1200,
  ws: null,
  matched: false,
  matchData: null,
};

// Timeout for test
const TEST_TIMEOUT = 30000; // 30 seconds
let testComplete = false;

function createPlayer(player) {
  return new Promise((resolve, reject) => {
    console.log(`\n[${player.id}] Connecting to matchmaking...`);

    const ws = new WebSocket(MATCHMAKING_URL);
    player.ws = ws;

    ws.on('open', () => {
      console.log(`[${player.id}] ✅ Connected`);

      // Send join_queue message
      const joinMessage = {
        type: 'join_queue',
        playerId: player.id,
        rank: player.rank,
      };

      console.log(`[${player.id}] 📤 Sending join_queue:`, joinMessage);
      ws.send(JSON.stringify(joinMessage));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`[${player.id}] 📥 Received:`, message.type);

      switch (message.type) {
        case 'queue_joined':
          console.log(`[${player.id}] ✅ Joined queue at position #${message.position}`);
          break;

        case 'match_found':
          console.log(`[${player.id}] 🎉 MATCH FOUND!`);
          console.log(`[${player.id}]   Room: ${message.roomId}`);
          console.log(`[${player.id}]   Player 1: ${message.player1}`);
          console.log(`[${player.id}]   Player 2: ${message.player2}`);

          if (message.aiOpponent) {
            console.log(`[${player.id}]   ⚠️  AI Opponent: ${message.aiOpponent.id} (${message.aiOpponent.difficulty})`);
          }

          player.matched = true;
          player.matchData = message;
          ws.close();
          resolve();
          break;

        case 'already_in_queue':
          console.log(`[${player.id}] ⚠️  Already in queue`);
          break;

        default:
          console.log(`[${player.id}] ❓ Unknown message type:`, message.type);
      }
    });

    ws.on('error', (error) => {
      console.error(`[${player.id}] ❌ WebSocket error:`, error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log(`[${player.id}] 🔌 Disconnected`);
      if (!player.matched && !testComplete) {
        reject(new Error('Connection closed before match'));
      }
    });
  });
}

async function runTest() {
  console.log('\n🚀 Starting matchmaking test...\n');

  try {
    // Start both players connecting simultaneously
    console.log('⏳ Connecting both players...');

    const results = await Promise.race([
      Promise.all([
        createPlayer(player1),
        createPlayer(player2),
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout after 30s')), TEST_TIMEOUT)
      ),
    ]);

    testComplete = true;

    // Analyze results
    console.log('\n' + '═'.repeat(50));
    console.log('📊 TEST RESULTS');
    console.log('═'.repeat(50));

    console.log('\nPlayer 1:');
    console.log('  ID:', player1.id);
    console.log('  Matched:', player1.matched ? '✅ Yes' : '❌ No');
    if (player1.matchData) {
      console.log('  Room:', player1.matchData.roomId);
      console.log('  AI Opponent:', player1.matchData.aiOpponent ? '⚠️  Yes' : '✅ No');
    }

    console.log('\nPlayer 2:');
    console.log('  ID:', player2.id);
    console.log('  Matched:', player2.matched ? '✅ Yes' : '❌ No');
    if (player2.matchData) {
      console.log('  Room:', player2.matchData.roomId);
      console.log('  AI Opponent:', player2.matchData.aiOpponent ? '⚠️  Yes' : '✅ No');
    }

    // Verify they matched with each other
    console.log('\n' + '─'.repeat(50));
    console.log('🔍 VERIFICATION');
    console.log('─'.repeat(50));

    const bothMatched = player1.matched && player2.matched;
    console.log('✓ Both players matched:', bothMatched ? '✅ PASS' : '❌ FAIL');

    if (bothMatched) {
      const sameRoom = player1.matchData.roomId === player2.matchData.roomId;
      console.log('✓ Same room:', sameRoom ? '✅ PASS' : '❌ FAIL');

      const noAI = !player1.matchData.aiOpponent && !player2.matchData.aiOpponent;
      console.log('✓ No AI opponents:', noAI ? '✅ PASS' : '❌ FAIL');

      const matchedTogether = (
        (player1.matchData.player1 === player1.id && player1.matchData.player2 === player2.id) ||
        (player1.matchData.player1 === player2.id && player1.matchData.player2 === player1.id)
      );
      console.log('✓ Matched with each other:', matchedTogether ? '✅ PASS' : '❌ FAIL');

      const allPassed = sameRoom && noAI && matchedTogether;

      console.log('\n' + '═'.repeat(50));
      if (allPassed) {
        console.log('🎉 TEST PASSED! Human-to-human matching works!');
      } else {
        console.log('❌ TEST FAILED! Matchmaking has issues.');
        process.exit(1);
      }
      console.log('═'.repeat(50));
    } else {
      console.log('\n' + '═'.repeat(50));
      console.log('❌ TEST FAILED! Not all players matched.');
      console.log('═'.repeat(50));
      process.exit(1);
    }

  } catch (error) {
    testComplete = true;
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  } finally {
    // Clean up connections
    if (player1.ws) player1.ws.close();
    if (player2.ws) player2.ws.close();
  }
}

// Run the test
runTest().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
