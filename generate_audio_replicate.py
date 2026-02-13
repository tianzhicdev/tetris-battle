#!/usr/bin/env python3
"""
Audio Generator for Tetris Battle using Replicate API
Uses Meta's MusicGen hosted on Replicate - much easier than local installation!
"""

import json
import os
import time
from pathlib import Path
import replicate
from dotenv import load_dotenv
import requests

# Load API key from .env.secrets
load_dotenv('.env.secrets')
REPLICATE_API_TOKEN = os.getenv('REPLICATE_API')

if not REPLICATE_API_TOKEN:
    print("❌ Error: REPLICATE_API not found in .env.secrets")
    exit(1)

# Set up Replicate client
os.environ['REPLICATE_API_TOKEN'] = REPLICATE_API_TOKEN


def load_requirements(json_path: str = "audio-requirements.json") -> dict:
    """Load audio requirements from JSON file."""
    with open(json_path, 'r') as f:
        return json.load(f)


def generate_audio_replicate(prompt: str, duration: float, output_path: str):
    """
    Generate audio using Replicate's MusicGen API.

    Args:
        prompt: Text description for generation
        duration: Length in seconds (max 30s for free tier)
        output_path: Where to save the file (including .wav extension)
    """
    print(f"  Prompt: {prompt}")
    print(f"  Duration: {duration}s")

    try:
        # Call Replicate API (duration must be integer, minimum 1)
        duration_int = max(1, int(round(min(duration, 30))))

        output = replicate.run(
            "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
            input={
                "prompt": prompt,
                "duration": duration_int,  # Must be integer
                "model_version": "stereo-melody-large",  # Best quality
                "output_format": "wav",
                "normalization_strategy": "loudness"
            }
        )

        # Download the generated audio
        audio_url = output
        print(f"  Generated: {audio_url}")

        response = requests.get(audio_url)
        response.raise_for_status()

        # Save to file
        with open(output_path, 'wb') as f:
            f.write(response.content)

        file_size = os.path.getsize(output_path) / 1024
        print(f"  ✓ Saved to {output_path} ({file_size:.1f} KB)\n")

        return True

    except Exception as e:
        print(f"  ✗ Error: {e}\n")
        return False


def main():
    """Main generation pipeline."""
    # Load requirements
    print("Loading audio requirements...")
    requirements = load_requirements()

    # Create output directory
    output_dir = Path("packages/web/public/audio")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Tetris Battle - Audio Generation via Replicate")
    print(f"{'='*60}")
    print(f"Output directory: {output_dir}")
    print(f"Total music tracks: {requirements['metadata']['total_music_tracks']}")
    print(f"Total SFX: {requirements['metadata']['total_sfx']}")
    print(f"Style: {requirements['metadata']['style']}")
    print(f"{'='*60}\n")

    success_count = 0
    total_count = 0

    # Generate music tracks
    print(f"\n{'='*60}")
    print("GENERATING MUSIC TRACKS")
    print(f"{'='*60}\n")

    for track in requirements['music']:
        total_count += 1
        print(f"[{success_count + 1}/{total_count}] Generating: {track['name']}")

        output_path = output_dir / track['filename']

        # Skip if already exists
        if output_path.exists():
            print(f"  ⚠️  File already exists, skipping...\n")
            success_count += 1
            continue

        # Note: Replicate has a 30s max, so we'll cap long tracks
        actual_duration = min(track['duration'], 30)
        if actual_duration < track['duration']:
            print(f"  ⚠️  Capping duration to 30s (Replicate limit)")

        if generate_audio_replicate(
            prompt=track['prompt'],
            duration=actual_duration,
            output_path=str(output_path)
        ):
            success_count += 1

        # Rate limiting - wait 2 seconds between requests
        time.sleep(2)

    # Generate sound effects
    print(f"\n{'='*60}")
    print("GENERATING SOUND EFFECTS")
    print(f"{'='*60}\n")

    for sfx in requirements['sfx']:
        total_count += 1
        print(f"[{success_count + 1}/{total_count}] Generating: {sfx['name']}")

        output_path = output_dir / sfx['filename']

        # Skip if already exists
        if output_path.exists():
            print(f"  ⚠️  File already exists, skipping...\n")
            success_count += 1
            continue

        if generate_audio_replicate(
            prompt=sfx['prompt'],
            duration=sfx['duration'],
            output_path=str(output_path)
        ):
            success_count += 1

        # Rate limiting - wait 2 seconds between requests
        time.sleep(2)

    print(f"\n{'='*60}")
    print("GENERATION COMPLETE!")
    print(f"{'='*60}")
    print(f"Successfully generated: {success_count}/{total_count} files")
    print(f"All audio files saved to: {output_dir}")

    if success_count < total_count:
        print(f"\n⚠️  {total_count - success_count} files failed to generate.")
        print(f"You can re-run this script to retry failed files.")
    else:
        print(f"\n✅ All files generated successfully!")
        print(f"\nNext steps:")
        print(f"1. Validate with: python3 validate_audio.py")
        print(f"2. Review the generated files")
        print(f"3. Integrate into your game's audio manager")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
