# Spec 003: AI Balancing and Ability System

## Status
- **Status**: Draft
- **Created**: 2026-02-14
- **Author**: User Feedback
- **Depends On**: 001-ai-players.md

## Problem Statement

Current AI implementation has two critical issues:

1. **AI is too skilled**: The AI uses optimal move calculations (height penalties, hole penalties, bumpiness) which makes it significantly better than most human players. Win rate is heavily skewed in AI's favor.

2. **Abilities don't work properly**:
   - Player abilities have no effect on AI opponents
   - AI doesn't use abilities against the player
   - This breaks the core competitive loop of the game

## Requirements

### 1. AI Skill Balancing - Mirroring Strategy

**Goal**: Achieve 50/50 win rate between player and AI by making AI match player skill level.

**Approach**: Instead of using optimal move calculations, AI should mirror/react to player actions to stay competitive but not dominant.

#### 1.1 Player Action Mirroring

- **Track player metrics in real-time**:
  - Player's average pieces per minute (PPM)
  - Player's average time to lock piece
  - Player's board height trends
  - Player's mistake frequency (missed obvious clears, creating holes)

- **AI adapts to player speed**:
  - If player locks pieces in 2 seconds on average, AI should lock in 1.8-2.2 seconds
  - If player is slow (5+ seconds), AI slows down proportionally
  - Add randomness: ±20% variance to prevent robotic feel

#### 1.2 AI Intentional Mistakes

To achieve 50/50 win rate, AI should make mistakes proportional to player mistakes:

- **Mistake rate**: 30-40% chance to make suboptimal moves
  - Place piece in non-optimal position
  - Miss obvious line clears
  - Create unnecessary holes
  - Rotate incorrectly

- **Mistake types**:
  - Random placement (ignore best-move calculation)
  - Off-by-one errors (place 1 column away from optimal)
  - Skip rotation (use piece as-is even if rotation is better)

#### 1.3 Difficulty Removal

- Remove the current 3-tier difficulty system (Easy/Medium/Hard)
- All AI opponents use the same adaptive mirroring strategy
- Difficulty auto-adjusts based on player performance

### 2. Ability System Integration

**Goal**: Make abilities work correctly for both player → AI and AI → player interactions.

#### 2.1 Player Abilities Affecting AI

**Current Issue**: Abilities like "Add Junk Rows", "Scramble Board", "Freeze Opponent" don't affect AI board state.

**Requirements**:
- When player uses ability on AI opponent:
  - Apply ability effect to `aiGameState.board`
  - Broadcast updated AI state to player immediately
  - AI should react to the changed board state (re-calculate next move)

**Abilities to implement**:
- ✅ **Add Junk Rows**: Add 1-3 garbage rows to AI board bottom
- ✅ **Scramble Board**: Randomize AI board cells
- ✅ **Freeze Opponent**: Pause AI game loop for 3 seconds
- ✅ **Clear Rows**: Remove 2 rows from AI board
- ✅ **Earthquake**: Shift AI board randomly
- ✅ **Bomb**: Clear 3x3 area on AI board
- ✅ **Gravity Flip**: Reverse AI board vertically

#### 2.2 AI Using Abilities

**Current Issue**: AI never uses abilities against the player.

**Requirements**:

**AI Ability Selection**:
- AI gets same ability loadout as player (matched to player's rank/level)
- AI should use abilities at similar frequency as player:
  - Track player's ability usage rate (abilities used per minute)
  - AI matches that rate ±20%

**AI Ability Timing**:
- Use abilities when strategically reasonable:
  - Player has low board (AI is losing) → use offensive abilities
  - AI has high board (AI is losing) → use defensive abilities
  - Random timing with 10-30 second cooldowns

**AI Star Management**:
- AI earns stars from line clears (same as player)
- AI spends stars on abilities (costs 1-3 stars per ability)
- AI should not run out of stars (cheat slightly if needed to maintain 50/50 balance)

### 3. Implementation Checklist

#### Phase 1: Player Metrics Tracking
- [ ] Add player action tracker to `PartykitGameSync`
- [ ] Calculate rolling averages: PPM, lock time, board height
- [ ] Send player metrics to AI via game state updates

#### Phase 2: AI Mirroring Logic
- [ ] Replace optimal move calculation with adaptive mirroring
- [ ] Implement intentional mistake system (30-40% error rate)
- [ ] Remove difficulty tiers (Easy/Medium/Hard)
- [ ] Test win rate: should be 45-55% for player

#### Phase 3: Ability Effects on AI
- [ ] Implement each ability's effect on `aiGameState`:
  - Add Junk Rows
  - Scramble Board
  - Freeze (pause AI loop)
  - Clear Rows
  - Earthquake
  - Bomb
  - Gravity Flip
- [ ] Broadcast AI state changes immediately after ability
- [ ] AI re-calculates next move after board modification

#### Phase 4: AI Ability Usage
- [ ] Give AI same ability loadout as player
- [ ] Implement AI ability decision logic:
  - Offensive abilities when losing
  - Defensive abilities when board is high
  - Random timing with cooldowns
- [ ] AI star management (earn from line clears, spend on abilities)
- [ ] Test: AI should use 2-4 abilities per match

#### Phase 5: Verification
- [ ] Win rate testing: 100 AI matches, expect 45-55% player win rate
- [ ] Ability testing: Verify all 7 abilities work on AI
- [ ] AI ability testing: Verify AI uses abilities 2-4 times per match
- [ ] Playtest: Does AI "feel" like a balanced human opponent?

## Success Criteria

1. **Win Rate**: Player wins 45-55% of AI matches (tested over 100 games)
2. **Ability Effectiveness**: All player abilities visibly affect AI board
3. **AI Ability Usage**: AI uses 2-4 abilities per match on average
4. **Player Experience**: AI feels like a "similar skill" human opponent, not a robot

## Technical Notes

### AI Mirroring Implementation

```typescript
interface PlayerMetrics {
  averagePPM: number;        // Pieces per minute
  averageLockTime: number;   // Milliseconds to lock piece
  averageBoardHeight: number; // Average filled rows
  mistakeRate: number;       // Percentage of suboptimal moves
}

class AdaptiveAI {
  playerMetrics: PlayerMetrics;

  decideMoveDelay(): number {
    // Match player speed ±20%
    const baseDelay = this.playerMetrics.averageLockTime;
    const variance = baseDelay * 0.2;
    return baseDelay + (Math.random() * variance * 2 - variance);
  }

  shouldMakeMistake(): boolean {
    // 30-40% mistake rate + player's mistake rate
    const baseMistakeRate = 0.35;
    const totalRate = Math.min(0.8, baseMistakeRate + this.playerMetrics.mistakeRate);
    return Math.random() < totalRate;
  }

  findMove(board, piece): Move {
    if (this.shouldMakeMistake()) {
      return this.makeIntentionalMistake(board, piece);
    }
    return this.findReasonableMove(board, piece); // Not optimal, just "good enough"
  }
}
```

### Ability Effect on AI Board

```typescript
// In game.ts - handle ability received by AI
handleAbilityReceived(abilityType: string, fromPlayerId: string) {
  if (!this.aiGameState) return;

  switch (abilityType) {
    case 'add_junk_rows':
      this.aiGameState.board = addJunkRows(this.aiGameState.board, 2);
      break;
    case 'scramble_board':
      this.aiGameState.board = scrambleBoard(this.aiGameState.board);
      break;
    case 'freeze':
      this.aiIsFrozen = true;
      setTimeout(() => { this.aiIsFrozen = false; }, 3000);
      break;
    // ... other abilities
  }

  // Re-calculate next move with updated board
  this.aiMoveQueue = [];

  // Broadcast updated state to player
  this.broadcastAIState();
}
```

## Related Specs

- **001-ai-players.md**: Original AI implementation (this spec replaces difficulty system)
- **002-friend-system.md**: Friend system (unrelated)

## Open Questions

1. Should AI mirroring be symmetric (AI exactly matches player) or asymmetric (AI slightly worse)?
   - **Recommendation**: Asymmetric - AI should be 10% slower/worse to account for human reaction time advantage

2. Should AI ability usage be random or strategic?
   - **Recommendation**: Strategic with randomness - use abilities when losing, but with 20-30s cooldown randomness

3. How to handle edge case: New player (level 1) has no abilities?
   - **Recommendation**: AI also uses no abilities until player unlocks at least 2 abilities
