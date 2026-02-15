# Debug Panel - Manual Testing Checklist (Step 13)

**Server Running**: http://localhost:5174/
**Test Mode**: `http://localhost:5174/?debug=true`

This checklist corresponds to Step 13 of the implementation plan. Complete these tests to fully verify the debug panel functionality.

---

## Test 1: Panel Activation

- [ ] Open `http://localhost:5174/?debug=true`
- [ ] Press `Ctrl+Shift+D`
- [ ] **Verify**: Debug panel appears
- [ ] Press `Ctrl+Shift+D` again
- [ ] **Verify**: Debug panel disappears

**Expected**: Panel toggles on/off with keyboard shortcut

---

## Test 2: Panel Dragging

- [ ] Open debug panel (`Ctrl+Shift+D`)
- [ ] Click and drag the panel header
- [ ] **Verify**: Panel moves with mouse
- [ ] Refresh the page (F5)
- [ ] Reopen panel (`Ctrl+Shift+D`)
- [ ] **Verify**: Panel opens at the last dragged position

**Expected**: Position persists across page refreshes (localStorage)

---

## Test 3: Events Log

### 3a. Events Appear During Gameplay
- [ ] Start a multiplayer game (Quick Match)
- [ ] Open debug panel
- [ ] Expand "Events Log" section
- [ ] Press keyboard keys: Left, Right, Up, Down, Space
- [ ] **Verify**: Events appear in log with timestamps (format: HH:MM:SS.mmm)
- [ ] **Verify**: Direction indicators show ↓ (incoming) and ↑ (outgoing)
- [ ] **Verify**: Events are color-coded (blue for incoming, orange for outgoing)

### 3b. Expandable Rows
- [ ] Click on any event in the log
- [ ] **Verify**: Event expands to show full JSON payload
- [ ] Click the same event again
- [ ] **Verify**: Event collapses back

### 3c. Clear Log
- [ ] Click "Clear" button
- [ ] **Verify**: All events disappear from log
- [ ] **Verify**: Counter shows "0 / 0 events"

### 3d. Export Log
- [ ] Generate some events (move pieces around)
- [ ] Click "Export" button
- [ ] **Verify**: JSON file downloads (filename: `tetris-debug-{timestamp}.json`)
- [ ] Open the downloaded file
- [ ] **Verify**: Valid JSON with array of events

### 3e. Filter Events
- [ ] Type "state_update" in the filter box
- [ ] **Verify**: Only events with type containing "state_update" are shown
- [ ] **Verify**: Counter shows "X / Y events" (X filtered, Y total)
- [ ] Clear the filter
- [ ] **Verify**: All events reappear

---

## Test 4: Network Stats

### 4a. Ping Test
- [ ] Expand "Network Stats" section
- [ ] Click "Ping Test" button
- [ ] **Verify**: RTT value appears (e.g., "45ms")
- [ ] Click "Ping Test" multiple times (5-10 times)
- [ ] **Verify**: Avg, Min, Max values update
- [ ] **Verify**: Values are reasonable (typically 20-200ms for local server)

### 4b. Connection Status
- [ ] With game connected, check connection status
- [ ] **Verify**: Shows "CONNECTED" in green
- [ ] Disconnect from game (exit match)
- [ ] **Verify**: Status changes to "DISCONNECTED" in red

---

## Test 5: Ability Triggers

### 5a. Opponent Targeting
- [ ] Start a multiplayer game
- [ ] Open debug panel
- [ ] Expand "Ability Triggers" section
- [ ] Select "Opponent" radio button
- [ ] Click "QUAKE" button (Earthquake ability)
- [ ] **Verify**: Opponent's board shifts/shakes
- [ ] **Verify**: No stars were deducted from your score
- [ ] Click "SPEED" button (Speed Up Opponent)
- [ ] **Verify**: Opponent's pieces fall faster
- [ ] **Verify**: Still no star cost

### 5b. Self Targeting
- [ ] Select "Self" radio button
- [ ] Click "2X STARS" button (Cascade Multiplier)
- [ ] **Verify**: In legacy mode - ability applies to you
- [ ] **Verify**: In server-auth mode - logs "not implemented" (expected)

### 5c. All Abilities Available
- [ ] **Verify**: 8 buff buttons visible (under "Self Buffs")
- [ ] **Verify**: 12 debuff buttons visible (under "Opponent Debuffs")
- [ ] Hover over any button
- [ ] **Verify**: Tooltip shows full ability name and cost

---

## Test 6: Game State Inspector

### 6a. View Your State
- [ ] Expand "Game State Inspector" section
- [ ] Click "View Your State" button
- [ ] **Verify**: Modal appears with JSON display
- [ ] **Verify**: JSON contains fields like `board`, `score`, `currentPiece`
- [ ] Click "Copy" button
- [ ] Paste into a text editor
- [ ] **Verify**: Valid JSON was copied

### 6b. View Opponent State
- [ ] Click "View Opponent State" button
- [ ] **Verify**: Modal shows opponent's game state
- [ ] **Verify**: Contains opponent's board, score, etc.
- [ ] Click "Close" button
- [ ] **Verify**: Modal disappears

---

## Test 7: Keyboard Shortcuts

All shortcuts require `Ctrl+Shift+` prefix:

- [ ] Press `Ctrl+Shift+L`
- [ ] **Verify**: Events log clears

- [ ] Press `Ctrl+Shift+P`
- [ ] **Verify**: Ping test runs, RTT value updates

- [ ] Press `Ctrl+Shift+E`
- [ ] **Verify**: Events export to JSON file

- [ ] Press `Ctrl+Shift+D`
- [ ] **Verify**: Panel toggles open/closed

---

## Test 8: Section Collapsing

- [ ] Click "▼ Events Log (N)" header
- [ ] **Verify**: Section collapses to "▶ Events Log (N)"
- [ ] Click header again
- [ ] **Verify**: Section expands back
- [ ] Collapse "Events Log"
- [ ] Refresh page (F5)
- [ ] Reopen panel
- [ ] **Verify**: "Events Log" remains collapsed (localStorage persistence)

---

## Test 9: Both Game Modes

### 9a. Legacy Mode
- [ ] Open `http://localhost:5174/?debug=true` (no serverAuth)
- [ ] Start a game
- [ ] Test events log
- [ ] Test ability triggers
- [ ] **Verify**: All features work

### 9b. Server-Auth Mode
- [ ] Open `http://localhost:5174/?debug=true&serverAuth=true`
- [ ] Start a game
- [ ] Test events log
- [ ] Test ability triggers
- [ ] **Verify**: All features work
- [ ] **Note**: Some self-abilities may not work (expected - server doesn't support yet)

---

## Test 10: High Message Volume

- [ ] Open debug panel
- [ ] Start a game
- [ ] Rapidly spam keyboard keys (Left, Right, Rotate) for 10 seconds
- [ ] **Verify**: Events log handles high volume without lag
- [ ] **Verify**: Older events are removed when log exceeds limit
- [ ] **Verify**: UI remains responsive

---

## Summary Checklist

After completing all tests above, verify:

- [ ] All 10 test sections completed
- [ ] No console errors during testing
- [ ] Panel is usable and helpful for debugging
- [ ] All keyboard shortcuts work
- [ ] Panel position persists
- [ ] Events log accurately tracks messages
- [ ] Network stats provide useful RTT info
- [ ] Ability triggers bypass star costs
- [ ] State inspector shows valid JSON
- [ ] Works in both legacy and server-auth modes

---

## Issues Found

If you encounter any issues during testing, document them here:

**Issue 1**:
- Description:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:

**Issue 2**:
...

---

## Sign-Off

- [ ] All tests passed
- [ ] No critical issues found
- [ ] Debug panel is production-ready

**Tested By**: _________________
**Date**: _________________
**Build**: commit 768ea22

---

## Next Step

After completing this checklist, the debug panel implementation is **fully verified** and ready for production use.

If all tests pass, Phase 4 verification is complete. ✅
