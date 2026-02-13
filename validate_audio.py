#!/usr/bin/env python3
"""
Validate that all required audio files exist and meet basic requirements.
Run after generating audio from any source.
"""

import json
from pathlib import Path

def load_requirements():
    """Load audio requirements."""
    with open('audio-requirements.json', 'r') as f:
        return json.load(f)

def validate_audio_files():
    """Check if all required audio files exist."""
    requirements = load_requirements()
    audio_dir = Path("packages/web/public/audio")

    print("=" * 60)
    print("Audio Files Validation")
    print("=" * 60)
    print(f"Checking directory: {audio_dir}\n")

    if not audio_dir.exists():
        print(f"❌ Error: Directory {audio_dir} does not exist!")
        print(f"   Create it with: mkdir -p {audio_dir}\n")
        return False

    all_files = []
    missing_files = []
    found_files = []

    # Check music files
    print("🎵 Music Tracks:")
    for track in requirements['music']:
        filename = track['filename']
        filepath = audio_dir / filename
        all_files.append(filename)

        if filepath.exists():
            size_kb = filepath.stat().st_size / 1024
            print(f"  ✓ {filename:<30} ({size_kb:.1f} KB)")
            found_files.append(filename)
        else:
            print(f"  ✗ {filename:<30} MISSING")
            missing_files.append(filename)

    # Check SFX files
    print("\n🔊 Sound Effects:")
    for sfx in requirements['sfx']:
        filename = sfx['filename']
        filepath = audio_dir / filename
        all_files.append(filename)

        if filepath.exists():
            size_kb = filepath.stat().st_size / 1024
            print(f"  ✓ {filename:<30} ({size_kb:.1f} KB)")
            found_files.append(filename)
        else:
            print(f"  ✗ {filename:<30} MISSING")
            missing_files.append(filename)

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total files needed:  {len(all_files)}")
    print(f"Files found:         {len(found_files)} ✓")
    print(f"Files missing:       {len(missing_files)}")

    if missing_files:
        print(f"\n❌ Missing {len(missing_files)} files:")
        for f in missing_files:
            print(f"   - {f}")
        print("\nGenerate missing files using:")
        print("  - BeepBox (beepbox.co) for music")
        print("  - jfxr (jfxr.frozenfractal.com) for SFX")
        print("  - See AUDIO_ALTERNATIVES.md for guide")
        return False
    else:
        print(f"\n✅ All audio files present!")
        print("\nNext steps:")
        print("  1. Test audio files in browser")
        print("  2. Integrate into audio manager service")
        print("  3. Hook up to game events")
        return True

if __name__ == "__main__":
    success = validate_audio_files()
    exit(0 if success else 1)
