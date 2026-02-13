# Audio Generation Guide

Generate all music and sound effects for Tetris Battle using Meta's MusicGen.

## 📋 Overview

- **Total audio files**: 31 (6 music tracks + 25 sound effects)
- **Style**: 8-bit chiptune retro arcade
- **Generator**: Meta MusicGen
- **Format**: WAV (44.1kHz, 16-bit)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install MusicGen and dependencies
pip install audiocraft torch torchaudio
```

### 2. Generate All Audio

```bash
# Generate all files (takes 15-30 minutes on GPU, hours on CPU)
python generate_audio.py
```

Files will be saved to: `packages/web/public/audio/`

### 3. Review and Refine

Listen to generated files and regenerate any that don't match expectations.

---

## 📁 Generated Files

### 🎵 Music Tracks (Looping)

| File | Duration | BPM | Usage |
|------|----------|-----|-------|
| `menu_theme.wav` | 90s | 120 | Main menu background |
| `gameplay_normal.wav` | 120s | 130 | Normal gameplay |
| `gameplay_intense.wav` | 120s | 150 | High-intensity gameplay |
| `matchmaking_waiting.wav` | 60s | 100 | Waiting for opponent |
| `victory_theme.wav` | 8s | 140 | Win screen (non-loop) |
| `defeat_theme.wav` | 6s | 90 | Loss screen (non-loop) |

### 🔊 Sound Effects (One-Shot)

#### Movement (4 SFX)
- `piece_move.wav` - Left/right movement
- `piece_rotate.wav` - Rotation
- `soft_drop.wav` - Soft drop
- `hard_drop.wav` - Hard drop/lock

#### Line Clears (4 SFX)
- `line_clear_single.wav` - 1 line (5⭐)
- `line_clear_double.wav` - 2 lines (12⭐)
- `line_clear_triple.wav` - 3 lines (25⭐)
- `line_clear_tetris.wav` - 4 lines (50⭐)

#### Abilities (5 SFX)
- `ability_buff_activate.wav` - Buff abilities
- `ability_debuff_activate.wav` - Debuff/attack abilities
- `ability_ultra_activate.wav` - Ultra abilities
- `ability_ready.wav` - Cooldown complete
- `ability_bomb_explode.wav` - Bomb explosion

#### Rewards (2 SFX)
- `star_earned.wav` - Star collection
- `combo.wav` - Combo bonus

#### UI (7 SFX)
- `button_click.wav` - Button press
- `button_hover.wav` - Button hover
- `countdown_beep.wav` - 3-2-1 countdown
- `countdown_go.wav` - GO signal
- `match_found.wav` - Opponent matched
- `pause.wav` - Game paused
- `resume.wav` - Game resumed

#### Warnings & Results (3 SFX)
- `warning_high_stack.wav` - Danger warning
- `game_over.wav` - Game over
- (Uses `defeat_theme.wav` for full defeat music)

---

## ⚙️ Advanced Usage

### Regenerate Specific Files

Edit `generate_audio.py` to generate only specific files:

```python
# Only generate music tracks
for track in requirements['music']:
    if track['id'] == 'gameplay_normal':  # Specific track
        generate_audio(...)

# Only generate specific SFX
for sfx in requirements['sfx']:
    if sfx['category'] == 'ability':  # All abilities
        generate_audio(...)
```

### Adjust Generation Parameters

In `generate_audio.py`, modify `model.set_generation_params()`:

```python
model.set_generation_params(
    duration=duration,
    temperature=1.0,      # Higher = more creative (0.7-1.2)
    top_k=250,            # Token selection diversity
    top_p=0.9,            # Nucleus sampling
    cfg_coef=3.0          # Prompt adherence (2.0-5.0)
)
```

- **Higher `cfg_coef`**: Closer to prompt, less creative
- **Higher `temperature`**: More variation, less predictable
- **Lower values**: More consistent, safer results

### Change Model Size

```python
# In generate_audio.py, line 95:
model_size = "medium"  # Options: small, medium, melody, large

# small  = Fast, lower quality
# medium = Balanced (recommended)
# melody = Conditioned on melody (advanced)
# large  = Slow, best quality
```

### Generate Variations

For variety, generate multiple versions and pick the best:

```bash
# Generate 3 variations of each file
python generate_audio.py  # Run 1
mv packages/web/public/audio packages/web/public/audio_v1

python generate_audio.py  # Run 2
mv packages/web/public/audio packages/web/public/audio_v2

python generate_audio.py  # Run 3
mv packages/web/public/audio packages/web/public/audio_v3

# Compare and cherry-pick best versions
```

---

## 🎨 Customizing Prompts

Edit `audio-requirements.json` to change generation prompts:

```json
{
  "id": "gameplay_intense",
  "prompt": "Intense fast retro chiptune battle music, rapid 8-bit arpeggios..."
  // Modify this to change the output
}
```

**Tips for better prompts:**
- Be specific about style ("8-bit", "chiptune", "retro arcade")
- Mention mood/emotion ("triumphant", "urgent", "relaxing")
- Include musical elements ("arpeggios", "bassline", "melody")
- Reference game contexts ("Tetris-style", "Mario-like", "arcade")

---

## 🔧 Troubleshooting

### Out of Memory (GPU)

Use smaller model or CPU:
```python
model_size = "small"
# Or force CPU:
device = "cpu"
```

### Audio Quality Issues

- Try `large` model for better quality
- Increase `cfg_coef` for more prompt adherence
- Refine prompts to be more specific
- Generate multiple versions and pick best

### Too Slow on CPU

- Use smaller model (`small`)
- Generate overnight
- Use Google Colab with free GPU:
  ```python
  # Upload files to Colab
  # Run script in Colab environment
  # Download results
  ```

### Loops Don't Seamlessly Loop

MusicGen doesn't guarantee seamless loops. Options:
1. Use audio editing software (Audacity) to crossfade ends
2. Generate longer tracks and fade loop points
3. Use `audiocraft`'s continuation feature (advanced)

---

## 📊 Performance Estimates

| Hardware | Model | Time for All Files |
|----------|-------|-------------------|
| RTX 3080 | medium | ~20 minutes |
| RTX 3080 | large | ~45 minutes |
| M1 Mac (CPU) | small | ~2 hours |
| M1 Mac (CPU) | medium | ~4 hours |
| Intel i7 (CPU) | medium | ~6 hours |

---

## 🎵 Alternative: Manual Selection

If generated audio doesn't meet needs:

1. **Use existing libraries**:
   - OpenGameArt.org (CC0 chiptune)
   - Freesound.org (retro SFX)
   - Incompetech (game music)

2. **Commission custom audio**:
   - Fiverr (chiptune composers)
   - Upwork (game audio specialists)

3. **Create manually**:
   - BeepBox.co (browser chiptune maker)
   - FamiTracker (NES-style music)
   - Bfxr / jfxr (retro SFX generators)

---

## 📝 Integration Checklist

After generation:

- [ ] All 31 files generated successfully
- [ ] Music loops sound seamless (or edited)
- [ ] SFX have minimal silence/padding
- [ ] Volume levels are consistent
- [ ] Create audio manager/service in `packages/web/src/services/audio.ts`
- [ ] Hook up sounds to game events
- [ ] Add volume controls in settings
- [ ] Test on different browsers (Web Audio API compatibility)
- [ ] Optimize file sizes if needed (compression)

---

## 📚 Resources

- [MusicGen GitHub](https://github.com/facebookresearch/audiocraft)
- [MusicGen Paper](https://arxiv.org/abs/2306.05284)
- [Audiocraft Docs](https://facebookresearch.github.io/audiocraft/)
- [Web Audio API](https://developer.mozilla.org/en-US/Web_Audio_API)

---

**Last Updated**: 2026-02-13
