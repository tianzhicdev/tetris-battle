#!/usr/bin/env python3
"""
Generate a single audio file for testing/iteration.
Usage: python generate_single_audio.py <audio_id>
Example: python generate_single_audio.py gameplay_normal
"""

import sys
import json
from pathlib import Path

try:
    from audiocraft.models import MusicGen
    from audiocraft.data.audio import audio_write
    import torch
except ImportError:
    print("ERROR: Required libraries not installed.")
    print("Install with: pip install audiocraft torch torchaudio")
    exit(1)


def find_audio_spec(audio_id: str, requirements: dict):
    """Find audio specification by ID."""
    # Check music
    for track in requirements['music']:
        if track['id'] == audio_id:
            return track

    # Check SFX
    for sfx in requirements['sfx']:
        if sfx['id'] == audio_id:
            return sfx

    return None


def list_available_ids(requirements: dict):
    """Print all available audio IDs."""
    print("\n📋 Available Music IDs:")
    for track in requirements['music']:
        print(f"  - {track['id']:<30} ({track['name']})")

    print("\n🔊 Available SFX IDs:")
    for sfx in requirements['sfx']:
        print(f"  - {sfx['id']:<30} ({sfx['name']})")
    print()


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_single_audio.py <audio_id>")
        print("\nExamples:")
        print("  python generate_single_audio.py gameplay_normal")
        print("  python generate_single_audio.py ability_buff_activate")
        print("\nTo see all available IDs:")
        print("  python generate_single_audio.py --list")
        exit(1)

    # Load requirements
    with open('audio-requirements.json', 'r') as f:
        requirements = json.load(f)

    # List mode
    if sys.argv[1] == "--list" or sys.argv[1] == "-l":
        list_available_ids(requirements)
        exit(0)

    # Find audio spec
    audio_id = sys.argv[1]
    spec = find_audio_spec(audio_id, requirements)

    if spec is None:
        print(f"❌ Error: Audio ID '{audio_id}' not found.")
        print("\nUse --list to see all available IDs:")
        print("  python generate_single_audio.py --list")
        exit(1)

    # Setup
    output_dir = Path("packages/web/public/audio")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Generating: {spec['name']}")
    print(f"{'='*60}")
    print(f"ID:       {spec['id']}")
    print(f"Type:     {spec['type']}")
    print(f"Duration: {spec['duration']}s")
    print(f"Loop:     {spec.get('loop', False)}")
    print(f"Prompt:   {spec['prompt']}")
    print(f"Output:   {output_dir / spec['filename']}")
    print(f"{'='*60}\n")

    # Load model
    model_size = "medium"
    print(f"Loading MusicGen ({model_size})...")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}\n")

    model = MusicGen.get_pretrained(f'facebook/musicgen-{model_size}')

    # Generate
    print("Generating audio...\n")
    model.set_generation_params(
        duration=spec['duration'],
        temperature=1.0,
        top_k=250,
        top_p=0.9,
        cfg_coef=3.0
    )

    with torch.no_grad():
        wav = model.generate([spec['prompt']])

    # Save
    output_path = str(output_dir / spec['filename'].replace('.wav', ''))
    audio_write(
        output_path,
        wav[0].cpu(),
        model.sample_rate,
        strategy="loudness",
        loudness_compressor=True
    )

    print(f"✓ Successfully saved to: {output_path}.wav\n")
    print("💡 Tips:")
    print("  - Don't like it? Run again for a different variation")
    print("  - Edit prompt in audio-requirements.json for different results")
    print("  - Adjust cfg_coef in script (2.0-5.0) for prompt adherence\n")


if __name__ == "__main__":
    main()
