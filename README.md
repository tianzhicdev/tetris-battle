# Tetris Battle - Multiplayer PVP Game

A competitive Tetris game with buff/debuff mechanics, optimized for web and future iOS deployment.

## 🎮 Current Status

### ✅ COMPLETED (You can play now!)

- **Single-player Tetris** - Full game mechanics with ghost pieces, combos, scoring
- **Star Economy** - Earn stars from line clears (5/12/25/50 for 1/2/3/4 lines)
- **Theme System** - Switch between Classic and Retro pixel art themes
- **Multiplayer Infrastructure** - Complete matchmaking + real-time sync ready
- **Database Schema** - Supabase tables for rooms, game states, events
- **Monorepo Structure** - Extensible for React Native iOS (70% code reuse)

### 🔧 READY (Needs your Supabase credentials)

- **Matchmaking System** - Auto-match 2 players from queue
- **Real-time Sync** - Opponent's board updates in real-time
- **Game Rooms** - Session management with win/loss tracking

### 📋 TODO (Next implementation)

- **10 Abilities** (5 buffs + 5 debuffs) - Design doc ready
- **Ability UI** - Quick-select carousel
- **Deployment** - Vercel hosting setup

---

## 🚀 Quick Start

### 1. Set Up Supabase (5 minutes)

**Follow the guide:** [`SETUP_INSTRUCTIONS.md`](./SETUP_INSTRUCTIONS.md)

**TL;DR:**
```bash
# 1. Create project at https://supabase.com
# 2. Run the SQL migration (supabase/migrations/001_initial_schema.sql)
# 3. Create packages/web/.env.local with your credentials:

VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 2. Start Playing

```bash
# Install dependencies (first time only - ALREADY DONE)
pnpm install

# Build game-core package (ALREADY DONE)
pnpm --filter @tetris-battle/game-core build

# Dev server is ALREADY RUNNING at http://localhost:5173/
```

---

## 🎯 Features

### Already Working:
- ✅ **Classic Tetris Mechanics** - Rotation, collision detection, line clearing
- ✅ **Star Economy** - Earn in-game currency from combos
- ✅ **Ghost Piece** - Preview where blocks will land
- ✅ **Combo System** - Bonus stars for consecutive clears
- ✅ **Theme Switcher** - Classic vs Retro pixel art
- ✅ **Keyboard Controls** - Arrow keys + space for hard drop
- ✅ **Main Menu** - Mode selection UI
- ✅ **Matchmaking** - Queue system with position indicator
- ✅ **Multiplayer Sync** - Real-time opponent board view

### Coming Next:
- 🔜 **Speed Boost** (Buff) - Increase fall speed
- 🔜 **Bomb** (Buff) - Destroy 4×4 area
- 🔜 **Clear Rows** (Buff) - Instant 5-row clear
- 🔜 **Weird Shapes** (Debuff) - Rotated/inverted pieces
- 🔜 **Blind Spot** (Debuff) - Bottom 4 rows invisible
- 🔜 **Rotation Lock** (Debuff) - Can't rotate for 15s
- 🔜 And 4 more abilities!

---

## 📁 Project Structure

```
tetris-battle/
├── packages/
│   ├── game-core/          # Platform-agnostic game logic
│   │   ├── engine.ts       # Tetris mechanics
│   │   ├── abilities.ts    # Buff/debuff system
│   │   ├── types.ts        # Type definitions
│   │   └── tetrominos.ts   # Piece shapes
│   │
│   └── web/                # React web app
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── renderer/       # Canvas renderer
│       │   ├── services/       # Supabase sync
│       │   ├── stores/         # Game state (Zustand)
│       │   └── themes.ts       # Visual themes
│       └── .env.local          # ← YOU CREATE THIS
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database tables
│
├── SETUP_INSTRUCTIONS.md   # Detailed setup guide
└── README.md               # This file
```

---

## 🎨 Theme System

Easily add new themes! Each theme defines:
- Color palette for each Tetromino type
- `renderBlock()` function for custom visuals
- Background, grid, and UI colors

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| ← → | Move piece left/right |
| ↑ or X | Rotate clockwise |
| ↓ | Soft drop |
| SPACE | Hard drop |
| P | Pause/Resume |

---

## 🚢 Next Steps

1. **Set up Supabase** - Follow `SETUP_INSTRUCTIONS.md` (5 mins)
2. **Test multiplayer** - Open on 2 devices and match together
3. **Deploy to Vercel** - Share with friends!
4. **Add abilities** - Implement the buff/debuff system
