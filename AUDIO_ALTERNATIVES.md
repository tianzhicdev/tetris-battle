# Alternative Audio Generation Methods

MusicGen installation can be complex on some systems. Here are practical alternatives to get your audio quickly.

## 🎵 Option 1: Browser-Based Tools (Recommended - Fast & Free)

### For Music Tracks

**BeepBox** - https://beepbox.co
- Free browser-based chiptune creator
- Perfect for retro 8-bit game music
- Export as WAV
- Instructions per track:

1. **Menu Theme** (90s, 120 BPM, upbeat):
   - Set tempo: 120 BPM
   - Choose "NES" chip preset
   - Create cheerful melody in major key
   - Add arpeggio pattern
   - Export as WAV, loop it

2. **Gameplay Normal** (120s, 130 BPM):
   - Tempo: 130 BPM
   - Energetic 8-bit melody with bass
   - Add driving drum pattern
   - Export and loop

3. **Gameplay Intense** (120s, 150 BPM):
   - Tempo: 150 BPM
   - Faster, more urgent melody
   - Rapid arpeggios
   - Export and loop

4. **Matchmaking Waiting** (60s, 100 BPM):
   - Tempo: 100 BPM
   - Calm, ambient 8-bit pads
   - Gentle melody
   - Export and loop

5. **Victory Theme** (8s, 140 BPM):
   - Short triumphant fanfare
   - Ascending melody
   - Major key
   - No loop needed

6. **Defeat Theme** (6s, 90 BPM):
   - Short descending melody
   - Minor key
   - Game over feel
   - No loop needed

###For Sound Effects

**jfxr** - https://jfxr.frozenfractal.com/
- Free browser-based retro SFX creator
- Export as WAV
- Presets for common game sounds

**Quick generation guide:**

| Sound | jfxr Preset | Tweak |
|-------|-------------|-------|
| piece_move | "Blip" | Very short, soft |
| piece_rotate | "Powerup" | Quick,sharp |
| hard_drop | "Hit" | Bass-heavy thud |
| line_clear_single | "Pickup" | Pleasant chime |
| line_clear_tetris | "Powerup" | Longer, triumphant |
| ability_buff_activate | "Powerup" | Ascending |
| ability_debuff_activate | "Laser" | Aggressive |
| bomb_explode | "Explosion" | Retro boom |
| button_click | "Blip" | Tiny click |
| countdown_beep | "Blip" | Sharp beep |
| warning | "Alarm" | Urgent tone |

**Generate each in 2 minutes:**
1. Go to jfxr.frozenfractal.com
2. Select preset
3. Adjust length (use our JSON duration values)
4. Click "Export .WAV"
5. Rename to match `audio-requirements.json` filename

---

## 🎮 Option 2: Free Asset Libraries (Instant)

### OpenGameArt.org
Search: "chiptune tetris" or "8-bit arcade"

**Recommended packs:**
- [Puzzle Game Collection](https://opengameart.org/content/puzzle-game-pack) - SFX
- [Chiptune Pack](https://opengameart.org/content/chiptune-pack) - Music loops

License: Most are CC0 (public domain) or CC-BY (credit required)

### Freesound.org
Search tags: "8bit", "chiptune", "retro", "game"

**Tips:**
- Filter by License: "Creative Commons 0"
- Download WAV format
- Batch download multiple at once

### Kenney.nl
**Game Assets pack** - https://kenney.nl/assets/category:Audio
- Interface Sounds pack
- Digital Audio pack
- All CC0 (public domain)

---

## 🛠️ Option 3: Simple Python Generator (No ML)

If you want to code simple tones/beeps:

```bash
pip install pydub numpy
```

**Simple beep generator** (`generate_simple_beeps.py`):

```python
from pydub.generators import Sine, Square
from pydub import AudioSegment

# Generate simple beep
def make_beep(frequency=440, duration_ms=100):
    return Square(frequency).to_audio_segment(duration=duration_ms)

# Button click: short high beep
button_click = make_beep(1200, 50)
button_click.export("packages/web/public/audio/button_click.wav", format="wav")

# Hard drop: lower bass thud
hard_drop = make_beep(200, 300)
hard_drop.export("packages/web/public/audio/hard_drop.wav", format="wav")

# Line clear: ascending arpeggio
clear = sum([make_beep(440 * (1.5 ** (i/4)), 100) for i in range(4)])
clear.export("packages/web/public/audio/line_clear_single.wav", format="wav")
```

This gives you functional sounds quickly, though less musical than MusicGen.

---

## 🎯 Option 4: Commission/Purchase (Quality)

### Fiverr
Search: "chiptune game music" or "8-bit SFX"
- ~$20-50 for full music pack
- ~$10-30 for SFX pack
- Turnaround: 3-7 days

### itch.io
Search: "chiptune music pack"
- Many $5-15 asset packs
- Instant download
- Commercial license included

---

## 📋 Recommended Workflow (Fastest)

**For Tetris Battle - 30 minute solution:**

1. **Music** (20 mins):
   - Go to BeepBox.co
   - Create 6 tracks following our specs
   - Export each as WAV
   - Save to `packages/web/public/audio/`

2. **SFX** (10 mins):
   - Go to jfxr.frozenfractal.com
   - Generate each of 25 sounds
   - Use presets, adjust duration
   - Export and rename per `audio-requirements.json`

**Total cost**: $0
**Total time**: ~30 minutes
**Quality**: Good for prototype, great for retro aesthetic

---

## 🔄 Still Want MusicGen?

Try these fixes:

### Fix 1: Use Google Colab (Free GPU)
1. Upload `generate_audio.py` and `audio-requirements.json` to Colab
2. Run in Colab's free GPU environment
3. Download generated files

### Fix 2: Docker Container
```bash
docker run -it --gpus all pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime
pip install audiocraft
# Run generation script
```

### Fix 3: Skip xformers
Edit audiocraft's `setup.py` to remove xformers dependency (advanced).

---

## 📁 File Organization

Whichever method you choose, ensure:

```
packages/web/public/audio/
├── menu_theme.wav
├── gameplay_normal.wav
├── gameplay_intense.wav
├── matchmaking_waiting.wav
├── victory_theme.wav
├── defeat_theme.wav
├── piece_move.wav
├── piece_rotate.wav
├── soft_drop.wav
├── hard_drop.wav
├── line_clear_single.wav
├── line_clear_double.wav
├── line_clear_triple.wav
├── line_clear_tetris.wav
├── combo.wav
├── star_earned.wav
├── ability_buff_activate.wav
├── ability_debuff_activate.wav
├── ability_ultra_activate.wav
├── ability_ready.wav
├── ability_bomb_explode.wav
├── countdown_beep.wav
├── countdown_go.wav
├── match_found.wav
├── button_click.wav
├── button_hover.wav
├── warning_high_stack.wav
├── game_over.wav
├── pause.wav
└── resume.wav
```

---

## ✅ Quick Decision Matrix

| Method | Time | Cost | Quality | Difficulty |
|--------|------|------|---------|-----------|
| BeepBox + jfxr | 30m | $0 | Good | Easy |
| Free libraries | 20m | $0 | Varies | Very Easy |
| Simple Python | 1h | $0 | Basic | Medium |
| Fiverr | 3-7d | $30-80 | Excellent | Easy |
| MusicGen (Colab) | 2h | $0 | Excellent | Medium |
| Purchase packs | 10m | $10-30 | Good | Very Easy |

**Recommendation for right now**: BeepBox + jfxr = complete audio in 30 minutes

---

Last updated: 2026-02-13
