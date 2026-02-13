# Sound Effects Replacement Guide

## 📁 Directory
Save all your sound effect files to:
```
packages/web/public/audio/
```

---

## 🔊 Required Sound Effect Files

### Movement & Controls (4 files)

| Filename | Game Event | When It Plays |
|----------|------------|---------------|
| `piece_move.wav` | Arrow Left/Right | Piece moves horizontally |
| `piece_rotate.wav` | Up Arrow / X | Piece rotates |
| `soft_drop.wav` | Down Arrow (held) | Piece falling faster |
| `hard_drop.wav` | Spacebar | Piece slams down and locks |

**Recommended sources:**
- Short, crisp 8-bit blips
- Duration: 0.1-0.3 seconds
- Look for: "tetris move sound", "8-bit blip", "retro game movement"

---

### Line Clears & Combos (6 files)

| Filename | Game Event | Stars Earned |
|----------|------------|--------------|
| `line_clear_single.wav` | 1 line cleared | 5 ⭐ |
| `line_clear_double.wav` | 2 lines cleared | 12 ⭐ |
| `line_clear_triple.wav` | 3 lines cleared | 25 ⭐ |
| `line_clear_tetris.wav` | 4 lines cleared | 50 ⭐ |
| `combo.wav` | Consecutive clears | +1 ⭐ per combo |
| `star_earned.wav` | Stars collected | Visual feedback |

**Recommended sources:**
- Ascending chimes/arpeggios (single → tetris gets more epic)
- Duration: 0.5-1.5 seconds
- Look for: "tetris line clear", "8-bit achievement", "retro success sound"

---

### Abilities (5 files)

| Filename | Game Event | Description |
|----------|------------|-------------|
| `ability_buff_activate.wav` | Buff ability used | Bomb, Clear Rows, etc. |
| `ability_debuff_activate.wav` | Attack ability used | Speed Up, Weird Shapes, etc. |
| `ability_ultra_activate.wav` | Ultra ability used | Board Swap, Piece Thief, etc. |
| `ability_ready.wav` | Cooldown complete | Ability becomes available |
| `ability_bomb_explode.wav` | Bomb detonates | Blocks destroyed |

**Recommended sources:**
- Power-up sounds for buffs (ascending/positive)
- Attack sounds for debuffs (descending/aggressive)
- Explosion sound for bomb
- Duration: 0.5-1.5 seconds
- Look for: "8-bit power up", "retro attack", "chiptune explosion"

---

### UI Interactions (7 files)

| Filename | Game Event | Description |
|----------|------------|-------------|
| `button_click.wav` | Button pressed | Menu navigation, ability select |
| `button_hover.wav` | Mouse over button | Hover feedback |
| `countdown_beep.wav` | 3... 2... 1... | Pre-game countdown |
| `countdown_go.wav` | Game starts | Battle begins |
| `match_found.wav` | Opponent found | Matchmaking success |
| `pause.wav` | P key / Pause button | Game paused |
| `resume.wav` | Unpause | Game resumed |

**Recommended sources:**
- Simple click/blip sounds for buttons
- Beep for countdown
- Fanfare for match found
- Duration: 0.1-1.0 seconds
- Look for: "UI click", "menu sound", "game start"

---

### Warnings & Game States (2 files)

| Filename | Game Event | Description |
|----------|------------|-------------|
| `warning_high_stack.wav` | Blocks near top | Danger warning |
| `game_over.wav` | Board filled | Player death/loss |

**Recommended sources:**
- Urgent alarm/beep for warning
- Descending melody for game over
- Duration: 0.5-2.0 seconds
- Look for: "game over sound", "alarm beep"

---

## 🎵 Music Files (Keep or Replace)

If you want to replace the music tracks too:

| Filename | Usage | Duration |
|----------|-------|----------|
| `menu_theme.wav` | Main menu | Loop ~60-90s |
| `gameplay_normal.wav` | Normal gameplay | Loop ~90-120s |
| `gameplay_intense.wav` | High intensity | Loop ~90-120s |
| `matchmaking_waiting.wav` | Waiting for opponent | Loop ~60s |
| `victory_theme.wav` | Win screen | 5-10s |
| `defeat_theme.wav` | Loss screen | 5-10s |

---

## 🔍 Where to Find Good Sound Effects

### Free Resources:
1. **Freesound.org** - https://freesound.org
   - Search: "8-bit", "chiptune", "retro game"
   - Filter by CC0 (public domain) license

2. **OpenGameArt.org** - https://opengameart.org
   - Browse: Audio > SFX
   - Look for 8-bit/chiptune packs

3. **Kenney.nl** - https://kenney.nl/assets
   - "Digital Audio" pack
   - "Interface Sounds" pack
   - All CC0 license

4. **Zapsplat** - https://zapsplat.com
   - Free with account
   - Filter by "8-bit" or "game"

### Browser Tools (Generate Your Own):
1. **jfxr** - https://jfxr.frozenfractal.com
   - Generate custom 8-bit SFX
   - Instant preview and download
   - Perfect for game sounds

2. **Bfxr** - https://www.bfxr.net
   - Classic game SFX generator
   - Lots of presets

---

## ✅ Quick Checklist

After downloading, verify you have all files:

```bash
ls -1 packages/web/public/audio/

# Should show:
# ability_bomb_explode.wav
# ability_buff_activate.wav
# ability_debuff_activate.wav
# ability_ready.wav
# ability_ultra_activate.wav
# button_click.wav
# button_hover.wav
# combo.wav
# countdown_beep.wav
# countdown_go.wav
# defeat_theme.wav
# game_over.wav
# gameplay_intense.wav
# gameplay_normal.wav
# hard_drop.wav
# line_clear_double.wav
# line_clear_single.wav
# line_clear_tetris.wav
# line_clear_triple.wav
# match_found.wav
# matchmaking_waiting.wav
# menu_theme.wav
# pause.wav
# piece_move.wav
# piece_rotate.wav
# resume.wav
# soft_drop.wav
# star_earned.wav
# victory_theme.wav
# warning_high_stack.wav
```

Or run the validation script:
```bash
python3 validate_audio.py
```

---

## 💡 Tips

1. **Keep files short** - Most SFX should be under 1 second
2. **WAV format** - Use .wav for best quality (game will work with mp3/ogg too)
3. **Consistent volume** - Normalize all files to similar volume levels
4. **Test as you go** - Use the audio review page: http://localhost:5173/audio-review.html
5. **Backup originals** - Save AI-generated files to `audio_backup/` folder first

---

**Last updated:** 2026-02-13
