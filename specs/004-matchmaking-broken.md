# Spec 004: Fix Matchmaking System

## Status
🔴 **CRITICAL BUG** - Players cannot find matches

## Problem

### Current Behavior
1. Two players search for match simultaneously
2. Neither player matches with each other
3. No AI fallback after 20 seconds
4. Players stuck in matchmaking indefinitely

### Expected Behavior
1. **Human matching (priority)**: Match with closest rank player if available
2. **AI fallback (20s timeout)**: If no human match found after 20 seconds, match with AI
3. **AI skill matching**: AI difficulty should match player's rank/skill level

## Root Cause Investigation

### Check These Areas
1. **Matchmaking queue**: Are players being added to queue correctly?
2. **Match polling**: Is the client polling for matches?
3. **AI fallback timer**: Is 20-second timeout working?
4. **PartyKit matchmaking**: Is server-side matching logic working?

### Relevant Files
- `packages/web/src/components/FindMatch.tsx` - Matchmaking UI
- `packages/web/src/services/partykit/matchmaking.ts` - Client-side matchmaking
- `packages/partykit/src/matchmaking.ts` - Server-side matching logic
- `supabase/complete-schema.sql` - matchmaking_queue table

## Requirements

### 1. Human-to-Human Matching
- [ ] Players in queue can discover each other
- [ ] Match closest rank players first (within ±200 rank)
- [ ] Remove matched players from queue
- [ ] Notify both players of match found

### 2. AI Fallback (20 Second Timeout)
- [ ] Start timer when player joins queue
- [ ] After 20 seconds with no human match, create AI opponent
- [ ] AI opponent difficulty matches player rank:
  - Rank 800-1000: Bronze AI
  - Rank 1000-1200: Silver AI
  - Rank 1200-1500: Gold AI
  - Rank 1500+: Diamond AI
- [ ] Player cannot distinguish AI from human (hidden indicator)

### 3. AI Behavior
**CRITICAL**: AI should behave EXACTLY like humans
- [ ] Uses same move execution (one move per tick with delay)
- [ ] Uses hard_drop like humans
- [ ] Speed controlled by `decideMoveDelay()` only
- [ ] No special advantages or shortcuts
- [ ] Difficulty = action frequency, not different mechanics

## Acceptance Criteria

### Scenario 1: Two Players Match
```
GIVEN two players with rank 1000 and 1050
WHEN both search for match within 5 seconds of each other
THEN they should match within 2 seconds
AND both receive match_found notification
AND room is created with both players
```

### Scenario 2: AI Fallback
```
GIVEN one player searching for match
WHEN 20 seconds pass with no human opponent
THEN AI opponent is created
AND player sees "Opponent found" (not "AI found")
AND game starts with AI opponent at appropriate difficulty
```

### Scenario 3: Rank-Based Matching
```
GIVEN players with ranks: 900, 1000, 1500
WHEN 1000-rank player searches
THEN matches with 900-rank player (closest)
NOT with 1500-rank player (too far)
```

## Implementation Plan

### Phase 1: Diagnose Current Issue
1. Add logging to matchmaking flow
2. Check if queue entries are created
3. Verify polling mechanism works
4. Test AI fallback timer

### Phase 2: Fix Human Matching
1. Implement rank-based matching algorithm
2. Add queue polling on server
3. Notify clients of matches
4. Remove matched players from queue

### Phase 3: Fix AI Fallback
1. Implement 20-second timeout
2. Create AI opponent with rank-appropriate difficulty
3. Hide AI indicator from UI
4. Start game with AI

### Phase 4: Verify AI Behavior
1. Confirm AI uses same mechanics as humans
2. Ensure difficulty is action frequency only
3. Test AI at different rank levels

## Testing

### Manual Test Cases
1. **Two Players**: Open two browsers, both search → should match
2. **Single Player**: Search alone → AI after 20s
3. **Rank Matching**: Test with different rank players
4. **AI Quality**: Verify AI plays like human, not broken

### Edge Cases
- Player leaves queue before match
- Multiple players join simultaneously
- Network disconnect during matchmaking
- AI fallback while human joining

## Success Metrics
- [ ] 100% of two-player searches result in match within 5s
- [ ] 100% of solo searches get AI opponent within 21s
- [ ] AI plays indistinguishably from humans
- [ ] No stuck/infinite matchmaking states

## Notes
- Priority: CRITICAL - game is unplayable without working matchmaking
- Current AI is "terrible" - likely due to recent changes breaking movement
- AI should use ORIGINAL good behavior (one move per tick with delays)
