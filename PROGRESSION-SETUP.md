# Tetris Battle - Progression System Setup Guide

## What's Been Implemented

###  1. Clerk Authentication (✅ Complete)
- Google and Apple OAuth login
- Username setup flow for new users
- User profile management

### 2. Supabase Database Schema (✅ Complete)
- `user_profiles` table - stores user data, coins, XP, level, unlocked abilities, loadout
- `match_results` table - stores match history and rewards
- `user_quests` table - stores daily and weekly quests
- Row Level Security (RLS) policies for data protection

### 3. Core Progression System (✅ Complete)
- Player levels (1-30) with XP thresholds
- Stage system (Rookie → Contender → Challenger → Veteran → Master → Legend)
- Coin economy with match rewards
- Ability unlock system with level gates
- Loadout slots (3-6 based on level)
- All constants from progression design doc

### 4. Database Service (✅ Complete)
- `ProgressionService` class with methods for:
  - User profile CRUD operations
  - Ability unlocking with coin deduction
  - Loadout management
  - Match result tracking
  - Win streak calculation

## Setup Instructions

### Step 1: Create Clerk Account

1. Go to https://clerk.com
2. Sign up for a free account
3. Create a new application
4. Enable **Google** and **Apple** as OAuth providers in the Clerk Dashboard
5. Copy your **Publishable Key**

### Step 2: Create Supabase Project

1. Go to https://supabase.com
2. Sign up and create a new project
3. Wait for project to finish provisioning (~2 minutes)
4. Go to **SQL Editor** in the sidebar
5. Paste the contents of `/supabase-schema.sql` and run it
6. Go to **Settings → API** and copy:
   - Project URL
   - `anon public` key

### Step 3: Configure Environment Variables

Edit `/packages/web/.env.local`:

```bash
# Partykit Configuration
VITE_PARTYKIT_HOST=localhost:1999

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx

# Supabase Database
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxx
```

Also update `.env.production` for deployment:

```bash
VITE_PARTYKIT_HOST=your-project.partykit.dev
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxx
```

### Step 4: Test Locally

```bash
# Terminal 1: Start Partykit server
cd packages/partykit
npx partykit dev

# Terminal 2: Start web app
cd packages/web
pnpm dev
```

Open http://localhost:5173 and you should see:
1. Sign in screen (Clerk)
2. Username setup screen (first time)
3. Main menu with user button in top-right

## What Still Needs Implementation

The foundation is complete, but these features still need to be built:

### 1. Post-Match Rewards System ⏳
**File**: `/packages/web/src/lib/rewards.ts`

Create a function that calculates and awards coins + XP after each match:

```typescript
import { progressionService } from './supabase';
import { COIN_VALUES, XP_VALUES, calculateLevel } from '@tetris-battle/game-core';

export async function awardMatchRewards(
  userId: string,
  outcome: 'win' | 'loss' | 'draw',
  linesCleared: number,
  abilitiesUsed: number,
  matchDuration: number
) {
  // Calculate base coins
  let coins = COIN_VALUES[outcome];

  // Add performance bonuses
  if (linesCleared >= 40) coins += COIN_VALUES.lines40Plus;
  else if (linesCleared >= 20) coins += COIN_VALUES.lines20Plus;

  if (abilitiesUsed >= 5) coins += COIN_VALUES.abilities5Plus;
  else if (abilitiesUsed === 0 && outcome === 'win') coins += COIN_VALUES.noAbilityWin;

  // Check win streak
  const streak = await progressionService.getWinStreak(userId);
  if (streak >= 10) coins += COIN_VALUES.streak10;
  else if (streak >= 5) coins += COIN_VALUES.streak5;
  else if (streak >= 3) coins += COIN_VALUES.streak3;

  // Calculate XP
  let xp = XP_VALUES.matchComplete;
  if (outcome === 'win') xp += XP_VALUES.matchWin;

  // Save match result
  await progressionService.saveMatchResult({
    id: crypto.randomUUID(),
    userId,
    opponentId: '', // Add opponent ID
    outcome,
    linesCleared,
    abilitiesUsed,
    coinsEarned: coins,
    xpEarned: xp,
    duration: matchDuration,
    timestamp: Date.now(),
  });

  // Update user profile
  const profile = await progressionService.getUserProfile(userId);
  if (!profile) return;

  const newCoins = profile.coins + coins;
  const newXp = profile.xp + xp;
  const newLevel = calculateLevel(newXp);

  await progressionService.updateUserProfile(userId, {
    coins: newCoins,
    xp: newXp,
    level: newLevel,
  });

  return { coins, xp, newLevel };
}
```

**Integration**: Call this function in `MultiplayerGame.tsx` when the match ends.

### 2. Ability Shop UI ⏳
**File**: `/packages/web/src/components/AbilityShop.tsx`

Create a UI component to:
- Display all abilities grouped by stage
- Show lock icons for abilities not yet unlocked (level requirement)
- Show purchase button with coin cost
- Show "Equipped" badge for abilities in loadout
- Show "Unlock" button for purchasable abilities

### 3. Loadout Manager UI ⏳
**File**: `/packages/web/src/components/LoadoutManager.tsx`

Create a UI to:
- Show current loadout (3-6 slots based on level)
- Drag-and-drop abilities from unlocked list
- Save loadout to database

### 4. Daily Quests System ⏳
**File**: `/packages/web/src/lib/quests.ts`

Create functions to:
- Generate 3 random daily quests at midnight
- Track quest progress during matches
- Award coins when quests are completed
- Refresh quests daily

### 5. Profile/Stats Page ⏳
**File**: `/packages/web/src/components/ProfilePage.tsx`

Display:
- Username, level, XP progress bar
- Coins balance
- Current stage badge
- Win/loss record
- Match history
- Active daily quests

### 6. In-Game Progression HUD ⏳
Update game UI to show:
- Current coins (top-left or top-right)
- Level badge
- XP bar (optional)

### 7. Post-Match Screen ⏳
**File**: `/packages/web/src/components/PostMatchScreen.tsx`

Show after each match:
- Win/Loss/Draw result
- Coins earned (with breakdown)
- XP earned
- Level up animation (if applicable)
- Quest progress updates
- "Play Again" button

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER AUTHENTICATION                      │
│                                                              │
│  ┌──────────┐        ┌──────────┐        ┌──────────┐      │
│  │  Google  │───────▶│   Clerk  │───────▶│ Supabase │      │
│  │  / Apple │        │   Auth   │        │ Profile  │      │
│  └──────────┘        └──────────┘        └──────────┘      │
│                           │                     │            │
│                           │                     ▼            │
│                           │              username, level,    │
│                           │              xp, coins, loadout  │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      GAME SESSION                            │
│                                                              │
│  ┌──────────┐        ┌──────────┐        ┌──────────┐      │
│  │ Partykit │◀──────▶│   React  │◀──────▶│  Zustand │      │
│  │  Server  │        │   Game   │        │   Store  │      │
│  └──────────┘        └──────────┘        └──────────┘      │
│       │                    │                     │           │
│       │ Multiplayer        │ Player actions      │           │
│       │ sync               │                     │           │
│       ▼                    ▼                     ▼           │
│  Match state          Line clears          Stars (in-match) │
│  Ability usage        Ability activation                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Match ends
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   POST-MATCH REWARDS                         │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │  awardMatchRewards()                             │       │
│  │  ┌────────────────────────────────────────┐     │       │
│  │  │ Calculate coins:                       │     │       │
│  │  │  - Win/Loss base                       │     │       │
│  │  │  - Performance bonuses                 │     │       │
│  │  │  - Streak bonuses                      │     │       │
│  │  │  - First win of day bonus              │     │       │
│  │  └────────────────────────────────────────┘     │       │
│  │                                                  │       │
│  │  ┌────────────────────────────────────────┐     │       │
│  │  │ Calculate XP:                          │     │       │
│  │  │  - Match complete base                 │     │       │
│  │  │  - Win bonus                           │     │       │
│  │  │  - Quest completion bonuses            │     │       │
│  │  └────────────────────────────────────────┘     │       │
│  └──────────────────┬───────────────────────────────       │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Supabase: match_results table                   │       │
│  │   - outcome, linesCleared, coinsEarned, xpEarned │       │
│  └──────────────────────────────────────────────────┘       │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Supabase: user_profiles table                   │       │
│  │   - coins += coinsEarned                         │       │
│  │   - xp += xpEarned                               │       │
│  │   - level = calculateLevel(xp)                   │       │
│  └──────────────────────────────────────────────────┘       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     PROGRESSION UI                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Profile Page │  │ Ability Shop │  │   Loadout    │      │
│  │              │  │              │  │   Manager    │      │
│  │ • Level      │  │ • Browse     │  │              │      │
│  │ • XP bar     │  │ • Unlock     │  │ • Equip      │      │
│  │ • Coins      │  │ • Purchase   │  │ • Save       │      │
│  │ • Stats      │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           │                     │            │
│                           ▼                     ▼            │
│                    ProgressionService    ProgressionService  │
│                    .unlockAbility()      .updateLoadout()    │
│                           │                     │            │
│                           ▼                     ▼            │
│                    Supabase: user_profiles                   │
│                    (coins, unlockedAbilities, loadout)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     QUEST SYSTEM (TBD)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Daily Quests (refreshes at midnight)            │       │
│  │  • Clear 50 lines                                │       │
│  │  • Win 3 matches                                 │       │
│  │  • Use 10 abilities                              │       │
│  └─────────────────┬────────────────────────────────┘       │
│                    │                                         │
│                    ▼                                         │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Supabase: user_quests table                     │       │
│  │   - daily: [{type, progress, target, reward}]   │       │
│  │   - weekly: {type, progress, target, reward}    │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Key Files Reference

### Core Types & Constants
- `/packages/game-core/src/progression.ts` - All progression types, constants, and helper functions

### Database
- `/supabase-schema.sql` - Database schema (run in Supabase SQL editor)
- `/packages/web/src/lib/supabase.ts` - Supabase client + ProgressionService

### Authentication & Profile
- `/packages/web/src/main.tsx` - ClerkProvider wrapper
- `/packages/web/src/components/AuthWrapper.tsx` - Auth flow controller
- `/packages/web/src/components/UsernameSetup.tsx` - Username setup modal
- `/packages/web/src/App.tsx` - Main app (now receives UserProfile)

### Game Components (need updates)
- `/packages/web/src/components/MultiplayerGame.tsx` - Add post-match reward call
- `/packages/web/src/components/MainMenu.tsx` - Add coins/level/profile button
- `/packages/web/src/components/TetrisGame.tsx` - Single player mode

## Testing the Setup

1. **Sign in flow**:
   - Open app → See sign in button
   - Click sign in → Clerk modal appears
   - Sign in with Google/Apple
   - See username setup screen
   - Enter username → Profile created in Supabase

2. **Verify database**:
   - Go to Supabase → Table Editor
   - Check `user_profiles` table
   - Should see your user with level 1, 0 coins, 0 XP, 4 starter abilities

3. **Play a match**:
   - Currently: Match ends, nothing happens
   - After implementing rewards: Coins and XP are awarded

## Next Steps

1. **Implement post-match rewards** (highest priority)
2. **Add ability shop UI** to spend coins
3. **Add profile page** to see stats
4. **Implement daily quests** for engagement
5. **Add post-match screen** with reward breakdown
6. **Update main menu** with coins/level display

## Need Help?

- **Clerk docs**: https://clerk.com/docs
- **Supabase docs**: https://supabase.com/docs
- **Progression design**: `/tetris-pvp-progression-system.md`

---

Built with ❤️ using Clerk, Supabase, React, and Partykit
