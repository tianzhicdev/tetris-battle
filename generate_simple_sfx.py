#!/usr/bin/env python3
"""
Generate clean, simple 8-bit style sound effects using waveforms.
Much better than AI-generated sounds for game actions!
"""

import numpy as np
from scipy.io import wavfile
from pathlib import Path

SAMPLE_RATE = 44100
OUTPUT_DIR = Path("packages/web/public/audio")

def generate_tone(frequency, duration, sample_rate=SAMPLE_RATE, volume=0.3):
    """Generate a simple square wave tone (8-bit style)."""
    t = np.linspace(0, duration, int(sample_rate * duration))
    # Square wave for 8-bit sound
    wave = volume * np.sign(np.sin(2 * np.pi * frequency * t))
    return wave

def generate_beep(frequency, duration, sample_rate=SAMPLE_RATE, volume=0.3):
    """Generate a beep with envelope (fade in/out)."""
    t = np.linspace(0, duration, int(sample_rate * duration))
    wave = volume * np.sign(np.sin(2 * np.pi * frequency * t))

    # Apply envelope (fade in and out)
    envelope = np.ones_like(wave)
    fade_samples = int(sample_rate * 0.01)  # 10ms fade
    if len(wave) > fade_samples * 2:
        envelope[:fade_samples] = np.linspace(0, 1, fade_samples)
        envelope[-fade_samples:] = np.linspace(1, 0, fade_samples)

    return wave * envelope

def generate_arpeggio(frequencies, note_duration, sample_rate=SAMPLE_RATE, volume=0.3):
    """Generate an arpeggio (sequence of notes)."""
    waves = []
    for freq in frequencies:
        waves.append(generate_beep(freq, note_duration, sample_rate, volume))
    return np.concatenate(waves)

def generate_sweep(start_freq, end_freq, duration, sample_rate=SAMPLE_RATE, volume=0.3):
    """Generate a frequency sweep."""
    t = np.linspace(0, duration, int(sample_rate * duration))
    freq = np.linspace(start_freq, end_freq, len(t))
    wave = volume * np.sign(np.sin(2 * np.pi * np.cumsum(freq) / sample_rate))

    # Apply envelope
    envelope = np.exp(-3 * t / duration)  # Exponential decay
    return wave * envelope

def save_wav(filename, audio, sample_rate=SAMPLE_RATE):
    """Save audio as WAV file."""
    # Normalize and convert to 16-bit PCM
    audio = np.clip(audio, -1, 1)
    audio_int = np.int16(audio * 32767)
    filepath = OUTPUT_DIR / filename
    wavfile.write(filepath, sample_rate, audio_int)
    print(f"✓ Generated: {filename}")

def main():
    print("Generating clean 8-bit sound effects...")
    print(f"Output directory: {OUTPUT_DIR}\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # MOVEMENT SOUNDS (short, crisp)
    print("Movement sounds:")
    save_wav("piece_move.wav", generate_beep(800, 0.05, volume=0.2))
    save_wav("piece_rotate.wav", generate_sweep(600, 900, 0.08, volume=0.25))
    save_wav("soft_drop.wav", generate_beep(400, 0.04, volume=0.15))
    save_wav("hard_drop.wav", generate_sweep(500, 100, 0.15, volume=0.35))

    # LINE CLEAR SOUNDS (ascending arpeggios)
    print("\nLine clear sounds:")
    # C major scale notes
    save_wav("line_clear_single.wav",
             generate_arpeggio([523, 659], 0.08, volume=0.3))  # C, E
    save_wav("line_clear_double.wav",
             generate_arpeggio([523, 659, 784], 0.08, volume=0.3))  # C, E, G
    save_wav("line_clear_triple.wav",
             generate_arpeggio([523, 659, 784, 988], 0.08, volume=0.3))  # C, E, G, B
    save_wav("line_clear_tetris.wav",
             generate_arpeggio([523, 659, 784, 988, 1047], 0.1, volume=0.35))  # Full octave

    # COMBO & REWARDS
    print("\nReward sounds:")
    save_wav("combo.wav", generate_arpeggio([880, 1047, 1319], 0.06, volume=0.25))
    save_wav("star_earned.wav", generate_arpeggio([1047, 1319], 0.05, volume=0.2))

    # ABILITY SOUNDS
    print("\nAbility sounds:")
    # Buff - ascending sweep
    save_wav("ability_buff_activate.wav",
             generate_sweep(400, 1200, 0.25, volume=0.3))
    # Debuff - descending sweep
    save_wav("ability_debuff_activate.wav",
             generate_sweep(1000, 200, 0.25, volume=0.3))
    # Ultra - dramatic sweep
    save_wav("ability_ultra_activate.wav",
             generate_sweep(200, 1500, 0.4, volume=0.35))
    # Ready - gentle beep
    save_wav("ability_ready.wav", generate_beep(880, 0.1, volume=0.2))
    # Bomb - explosion (noise burst with decay)
    t = np.linspace(0, 0.3, int(SAMPLE_RATE * 0.3))
    explosion = np.random.uniform(-0.4, 0.4, len(t)) * np.exp(-8 * t)
    save_wav("ability_bomb_explode.wav", explosion)

    # UI SOUNDS
    print("\nUI sounds:")
    save_wav("button_click.wav", generate_beep(1200, 0.03, volume=0.15))
    save_wav("button_hover.wav", generate_beep(1000, 0.02, volume=0.1))
    save_wav("countdown_beep.wav", generate_beep(880, 0.15, volume=0.25))
    save_wav("countdown_go.wav", generate_arpeggio([659, 880, 1047], 0.08, volume=0.3))
    save_wav("match_found.wav",
             generate_arpeggio([523, 659, 784, 1047], 0.1, volume=0.3))
    save_wav("pause.wav", generate_sweep(800, 400, 0.12, volume=0.2))
    save_wav("resume.wav", generate_sweep(400, 800, 0.12, volume=0.2))

    # WARNINGS
    print("\nWarning sounds:")
    # High stack warning - alternating beeps
    warning = np.concatenate([
        generate_beep(880, 0.1, volume=0.25),
        np.zeros(int(SAMPLE_RATE * 0.05)),
        generate_beep(880, 0.1, volume=0.25)
    ])
    save_wav("warning_high_stack.wav", warning)

    # Game over - descending arpeggio
    save_wav("game_over.wav",
             generate_arpeggio([659, 523, 440, 349, 262], 0.15, volume=0.3))

    print("\n" + "="*60)
    print("✅ All sound effects generated!")
    print("="*60)
    print(f"\nGenerated 24 sound effect files in: {OUTPUT_DIR}")
    print("\nTest them at: http://localhost:5173/audio-review.html")
    print("\nThese are simple but clean 8-bit sounds.")
    print("Much better for game actions than AI-generated music!")

if __name__ == "__main__":
    main()
