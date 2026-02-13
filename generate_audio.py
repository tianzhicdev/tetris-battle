#!/usr/bin/env python3
"""
Audio Generator for Tetris Battle
Uses Meta's MusicGen to generate all music and sound effects from audio-requirements.json
"""

import json
import os
from pathlib import Path

try:
    from audiocraft.models import MusicGen
    from audiocraft.data.audio import audio_write
    import torch
except ImportError:
    print("ERROR: Required libraries not installed.")
    print("Install with: pip install audiocraft torch torchaudio")
    exit(1)


def load_requirements(json_path: str = "audio-requirements.json") -> dict:
    """Load audio requirements from JSON file."""
    with open(json_path, 'r') as f:
        return json.load(f)


def generate_audio(model, prompt: str, duration: float, output_path: str, loop: bool = False):
    """
    Generate audio using MusicGen.

    Args:
        model: MusicGen model instance
        prompt: Text description for generation
        duration: Length in seconds
        output_path: Where to save the file (without extension)
        loop: Whether this should loop seamlessly
    """
    print(f"Generating: {os.path.basename(output_path)}.wav")
    print(f"  Prompt: {prompt}")
    print(f"  Duration: {duration}s | Loop: {loop}")

    # Generate audio
    model.set_generation_params(
        duration=duration,
        temperature=1.0,
        top_k=250,
        top_p=0.9,
        cfg_coef=3.0  # Classifier-free guidance - higher = closer to prompt
    )

    with torch.no_grad():
        wav = model.generate([prompt])

    # Save audio (audiocraft saves as wav by default)
    audio_write(
        output_path,
        wav[0].cpu(),
        model.sample_rate,
        strategy="loudness",
        loudness_compressor=True
    )

    print(f"  ✓ Saved to {output_path}.wav\n")


def main():
    """Main generation pipeline."""
    # Load requirements
    print("Loading audio requirements...")
    requirements = load_requirements()

    # Create output directory
    output_dir = Path("packages/web/public/audio")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Tetris Battle - Audio Generation")
    print(f"{'='*60}")
    print(f"Output directory: {output_dir}")
    print(f"Total music tracks: {requirements['metadata']['total_music_tracks']}")
    print(f"Total SFX: {requirements['metadata']['total_sfx']}")
    print(f"Style: {requirements['metadata']['style']}")
    print(f"{'='*60}\n")

    # Choose model size
    # Options: small, medium, melody, large
    # small = fastest, large = best quality
    model_size = "medium"  # Good balance of quality and speed

    print(f"Loading MusicGen model ({model_size})...")
    print("(First run will download ~1.5GB model)\n")
    model = MusicGen.get_pretrained(f'facebook/musicgen-{model_size}')

    # Check for GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    if device == "cpu":
        print("⚠️  Warning: Running on CPU will be slow. GPU recommended.\n")

    # Generate music tracks
    print(f"\n{'='*60}")
    print("GENERATING MUSIC TRACKS")
    print(f"{'='*60}\n")

    for track in requirements['music']:
        output_path = output_dir / track['filename'].replace('.wav', '')
        generate_audio(
            model=model,
            prompt=track['prompt'],
            duration=track['duration'],
            output_path=str(output_path),
            loop=track['loop']
        )

    # Generate sound effects
    print(f"\n{'='*60}")
    print("GENERATING SOUND EFFECTS")
    print(f"{'='*60}\n")

    for sfx in requirements['sfx']:
        output_path = output_dir / sfx['filename'].replace('.wav', '')
        generate_audio(
            model=model,
            prompt=sfx['prompt'],
            duration=sfx['duration'],
            output_path=str(output_path),
            loop=sfx['loop']
        )

    print(f"\n{'='*60}")
    print("✓ GENERATION COMPLETE!")
    print(f"{'='*60}")
    print(f"All audio files saved to: {output_dir}")
    print(f"\nNext steps:")
    print(f"1. Review the generated files")
    print(f"2. Re-generate any that don't match expectations")
    print(f"3. Integrate into your game's audio manager")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
