#!/usr/bin/env python3
"""Quick test of Replicate API"""

import os
import replicate
from dotenv import load_dotenv
import requests

load_dotenv('.env.secrets')
REPLICATE_API_TOKEN = os.getenv('REPLICATE_API')

if not REPLICATE_API_TOKEN:
    print("❌ Error: REPLICATE_API not found in .env.secrets")
    exit(1)

os.environ['REPLICATE_API_TOKEN'] = REPLICATE_API_TOKEN

print("Testing Replicate MusicGen API...")
print(f"API Token: {REPLICATE_API_TOKEN[:10]}...")

try:
    print("\n🎵 Generating 5-second test audio...")
    output = replicate.run(
        "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
        input={
            "prompt": "upbeat 8-bit chiptune melody, retro arcade game music",
            "duration": 5,
            "model_version": "stereo-melody-large",
            "output_format": "wav",
            "normalization_strategy": "loudness"
        }
    )

    print(f"✅ Success! Generated audio URL: {output}")

    # Try downloading
    print("\n📥 Downloading audio...")
    response = requests.get(output)
    response.raise_for_status()

    # Save test file
    test_file = "packages/web/public/audio/test.wav"
    os.makedirs("packages/web/public/audio", exist_ok=True)
    with open(test_file, 'wb') as f:
        f.write(response.content)

    file_size = os.path.getsize(test_file) / 1024
    print(f"✅ Downloaded and saved to {test_file} ({file_size:.1f} KB)")
    print("\n🎉 Replicate API is working! Ready to generate all audio files.")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
