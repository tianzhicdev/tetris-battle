# Spec 007: Fix Ability System

## Status
🔴 **CRITICAL** - Multiple abilities broken or not working as intended

## Problem

### Current Issues
Many abilities are not working correctly or at all:
1. Some abilities have no visible effect
2. Some abilities affect the wrong player
3. Duration-based abilities don't persist
4. Time-based abilities (random_spawner, gold_digger) might not trigger
5. Visual effects may be missing
6. Ability costs not properly validated

### Expected Behavior
Every ability should:
- Have a clear, observable effect
- Apply to the correct target (self vs opponent)
- Last for the specified duration
- Cost the correct amount of stars
- Show visual feedback
- Work in both legacy and server-authoritative modes

## Ability Inventory

### Self-Buff Abilities
1. ✅ **piece_preview_plus** - Show next 5 pieces instead of 3
2. ❓ **bomb_mode** - Transform lines into explosive blocks
3. ❓ **cascade_multiplier** - Multi-line clears award bonus points
4. ❓ **deflect_shield** - Block next debuff from opponent

### Opponent Debuff Abilities (Instant)
5. ❓ **screen_shake** - Shake opponent's screen (visual only)
6. ❓ **earthquake** - Shift rows randomly
7. ❓ **clear_rows** - Remove bottom 2 rows (helpful!)
8. ❓ **random_spawner** - Add garbage blocks over time
9. ❓ **death_cross** - Toggle diagonal blocks (filled ↔ empty)
10. ❓ **row_rotate** - Rotate rows left/right
11. ❓ **gold_digger** - Remove blocks over time (helpful!)

### Opponent Debuff Abilities (Duration)
12. ❓ **speed_up_opponent** - 3x faster tick rate for 10 seconds
13. ❓ **reverse_controls** - Reverse left/right for 8 seconds
14. ❓ **rotation_lock** - Disable rotation for 5 seconds
15. ❓ **blind_spot** - Hide center of board for 6 seconds
16. ❓ **shrink_ceiling** - Block top 3 rows for 8 seconds

### Weird Pieces (Not Implemented)
17. ❌ **mini_blocks** - 1x1 blocks for 10 pieces
18. ❌ **weird_shapes** - Non-standard tetrominos for 5 pieces

**Legend:**
- ✅ Working
- ❓ Needs verification
- ❌ Not implemented

## Requirements

### 1. Audit All Abilities

For each ability, verify:
- [ ] **Effect exists**: Code implements the described effect
- [ ] **Target correct**: Applies to intended player (self vs opponent)
- [ ] **Duration works**: Time-based effects persist for specified duration
- [ ] **Cost correct**: Deducts right amount of stars
- [ ] **Visual feedback**: Player sees confirmation when used
- [ ] **Observable impact**: Effect is clearly visible in gameplay

### 2. Fix Broken Abilities

#### Instant Effect Abilities
- [ ] **screen_shake**: Apply shake CSS animation to opponent's board for 3s
- [ ] **earthquake**: Randomly shift rows on opponent's board
- [ ] **clear_rows**: Remove bottom 2 rows from opponent
- [ ] **death_cross**: Toggle diagonal cells (filled ↔ empty)
- [ ] **row_rotate**: Rotate each row left or right randomly
- [ ] **random_spawner**: Add 1-3 garbage blocks every 2s for 10s
- [ ] **gold_digger**: Remove 1-2 blocks every 2s for 10s

#### Duration-Based Abilities
- [ ] **speed_up_opponent**: Modify opponent's tick rate to 333ms for 10s
- [ ] **reverse_controls**: Swap left ↔ right inputs for opponent for 8s
- [ ] **rotation_lock**: Disable rotate_cw/rotate_ccw for opponent for 5s
- [ ] **blind_spot**: Overlay dark mask on center 6 columns for 6s
- [ ] **shrink_ceiling**: Block top 3 rows from spawning for 8s

#### Self-Buff Abilities
- [ ] **piece_preview_plus**: Increase nextPieces display from 3 to 5
- [ ] **bomb_mode**: Mark next 5 line clears as explosive (cross/circle pattern)
- [ ] **cascade_multiplier**: Award 2x points for multi-line clears for 15s
- [ ] **deflect_shield**: Set flag to block next debuff, then remove

### 3. Consistent Implementation

**Client-Authoritative Mode (Legacy):**
- [ ] Ability applied locally via game-core functions
- [ ] Effect sent to opponent via ability_activation message
- [ ] Visual effects triggered in PartykitMultiplayerGame.tsx

**Server-Authoritative Mode (New):**
- [ ] Client sends ability_activation input to server
- [ ] Server validates stars, deducts cost
- [ ] Server applies effect to target player's ServerGameState
- [ ] Server broadcasts state with activeEffects array
- [ ] Client renders effects based on server state

### 4. Visual Feedback

For every ability:
- [ ] Show ability name when activated
- [ ] Show who activated it (you vs opponent)
- [ ] Show category (buff vs debuff)
- [ ] Play sound effect
- [ ] Trigger haptic feedback
- [ ] Show duration timer if applicable

### 5. Server-Side Validation

- [ ] Check player has enough stars before activation
- [ ] Verify ability is in player's loadout
- [ ] Prevent activation if on cooldown (if cooldowns added)
- [ ] Validate target player exists
- [ ] Log ability usage for analytics

## Implementation Plan

### Phase 1: Audit (Manual Testing)
1. Test each ability in solo mode (against AI)
2. Test each ability in multiplayer (friend challenge)
3. Document which abilities work and which don't
4. Create spreadsheet: Ability | Legacy Mode | Server-Auth Mode | Visual Feedback | Notes

### Phase 2: Fix Core Logic
1. Fix instant effect abilities (earthquake, death_cross, etc.)
2. Fix duration-based abilities (speed_up, reverse_controls, etc.)
3. Fix time-based abilities (random_spawner, gold_digger intervals)
4. Ensure all effects work in both modes

### Phase 3: Improve Visual Feedback
1. Add AbilityNotification component enhancements
2. Add duration timers for active effects
3. Improve visual effects (shake, blind_spot overlay, etc.)
4. Add sound effects for each ability category

### Phase 4: Server-Auth Integration
1. Ensure all abilities work in ServerGameState.ts
2. Verify activeEffects propagation
3. Test ability effects in server-auth mode
4. Compare behavior between legacy and server-auth

### Phase 5: Balance & Polish
1. Adjust ability costs based on impact
2. Adjust durations based on gameplay feel
3. Add cooldowns if needed
4. Test in real multiplayer scenarios

## Acceptance Criteria

### Scenario 1: Instant Effect Abilities
```
GIVEN Player A has 10 stars
WHEN Player A uses "earthquake" on Player B
THEN Player A has 7 stars (cost: 3)
AND Player B's board rows are shifted randomly
AND both players see notification "Player A used Earthquake"
AND effect is visible immediately
```

### Scenario 2: Duration-Based Abilities
```
GIVEN Player A uses "speed_up_opponent" on Player B
WHEN ability activates
THEN Player B's pieces fall 3x faster
AND duration timer shows "7s remaining" (counts down from 10s)
AND after 10 seconds, speed returns to normal
AND notification disappears
```

### Scenario 3: Time-Based Abilities
```
GIVEN Player A uses "random_spawner" on Player B
WHEN ability activates
THEN every 2 seconds, 1-3 garbage blocks appear on Player B's board
AND this continues for 10 seconds total
AND Player B sees "Random Spawner Active" with timer
```

### Scenario 4: Self-Buff Abilities
```
GIVEN Player A has "piece_preview_plus" in loadout
WHEN Player A activates it
THEN Player A sees next 5 pieces instead of 3
AND preview lasts for 15 seconds
AND timer shows remaining duration
```

### Scenario 5: Deflect Shield
```
GIVEN Player A activates "deflect_shield"
WHEN Player B uses "earthquake" on Player A
THEN earthquake has no effect
AND deflect_shield is consumed
AND Player A sees "Deflected: Earthquake"
```

## Testing Checklist

For EACH ability, verify:

### Functionality
- [ ] Ability activates when clicked
- [ ] Stars are deducted correctly
- [ ] Effect applies to correct target
- [ ] Effect is observable (board changes, speed changes, etc.)
- [ ] Duration persists for specified time (if applicable)
- [ ] Effect ends after duration expires

### Visual Feedback
- [ ] Notification appears with ability name
- [ ] Duration timer shows (if applicable)
- [ ] Visual effect renders (shake, overlay, etc.)
- [ ] Sound plays
- [ ] Haptic feedback triggers

### Both Modes
- [ ] Works in legacy client-authoritative mode
- [ ] Works in server-authoritative mode (?serverAuth=true)
- [ ] Behavior is identical in both modes

### Edge Cases
- [ ] Cannot activate with insufficient stars
- [ ] Cannot activate if not in loadout
- [ ] Multiple abilities can be active simultaneously
- [ ] Abilities don't interfere with each other

## Success Metrics

- [ ] 18/18 abilities fully functional
- [ ] 100% of abilities show visual feedback
- [ ] 100% of abilities work in both modes
- [ ] 0 abilities with unclear effects
- [ ] Player feedback: abilities feel impactful

## Notes

- **Priority**: HIGH - Abilities are core feature
- **Testing**: Manual testing required for each ability
- **Modes**: Must work in both legacy and server-auth
- **Balance**: Some abilities may need cost/duration adjustments

## Related Issues

- Enhances multiplayer gameplay depth
- Improves clarity of ability system
- Prepares for future ability additions
- Enables competitive play with fair mechanics

## Ability Reference

### Current Costs (from game-core)
```typescript
screen_shake: 2 stars
speed_up_opponent: 3 stars
piece_preview_plus: 2 stars
earthquake: 3 stars
clear_rows: 2 stars
bomb_mode: 3 stars
cascade_multiplier: 3 stars
deflect_shield: 2 stars
reverse_controls: 3 stars
rotation_lock: 3 stars
blind_spot: 3 stars
random_spawner: 3 stars
death_cross: 3 stars
row_rotate: 3 stars
gold_digger: 3 stars
shrink_ceiling: 3 stars
mini_blocks: 2 stars (not implemented)
weird_shapes: 3 stars (not implemented)
```

### Current Durations
```typescript
speed_up_opponent: 10 seconds
reverse_controls: 8 seconds
rotation_lock: 5 seconds
blind_spot: 6 seconds
shrink_ceiling: 8 seconds
cascade_multiplier: 15 seconds
piece_preview_plus: 15 seconds
bomb_mode: 5 lines (not time-based)
random_spawner: 10 seconds (trigger every 2s)
gold_digger: 10 seconds (trigger every 2s)
mini_blocks: 10 pieces (not implemented)
weird_shapes: 5 pieces (not implemented)
```
