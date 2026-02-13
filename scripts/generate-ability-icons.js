import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Icon specifications for each ability
const abilityIconSpecs = {
  // BUFFS
  cross_firebomb: {
    prompt: "Gaming icon, red cross-shaped explosion with fire particles, pixel art style, transparent background, 512x512, vibrant neon colors, sharp details, game UI asset",
    filename: "cross-firebomb.png"
  },
  circle_bomb: {
    prompt: "Gaming icon, circular bomb with radiating blast waves, pixel art style, transparent background, 512x512, orange and yellow colors, sharp details, game UI asset",
    filename: "circle-bomb.png"
  },
  clear_rows: {
    prompt: "Gaming icon, horizontal lines disappearing with sparkle effects, pixel art style, transparent background, 512x512, cyan and white colors, sharp details, game UI asset",
    filename: "clear-rows.png"
  },
  cascade_multiplier: {
    prompt: "Gaming icon, golden star with multiplier x2 symbol, pixel art style, transparent background, 512x512, gold and yellow colors, sharp details, game UI asset",
    filename: "cascade-multiplier.png"
  },
  mini_blocks: {
    prompt: "Gaming icon, small cute tetris blocks shrinking, pixel art style, transparent background, 512x512, blue and purple colors, sharp details, game UI asset",
    filename: "mini-blocks.png"
  },

  // DEBUFFS
  speed_up_opponent: {
    prompt: "Gaming icon, lightning bolt with speed lines, pixel art style, transparent background, 512x512, electric yellow colors, sharp details, game UI asset",
    filename: "speed-up.png"
  },
  weird_shapes: {
    prompt: "Gaming icon, abstract chaotic tetris shape, pixel art style, transparent background, 512x512, purple and pink colors, sharp details, game UI asset",
    filename: "weird-shapes.png"
  },
  random_spawner: {
    prompt: "Gaming icon, blocks raining down from above, pixel art style, transparent background, 512x512, cyan and blue colors, sharp details, game UI asset",
    filename: "random-spawner.png"
  },
  rotation_lock: {
    prompt: "Gaming icon, padlock with rotation arrow crossed out, pixel art style, transparent background, 512x512, red and orange colors, sharp details, game UI asset",
    filename: "rotation-lock.png"
  },
  blind_spot: {
    prompt: "Gaming icon, eye with blind zone shadowed area, pixel art style, transparent background, 512x512, dark purple colors, sharp details, game UI asset",
    filename: "blind-spot.png"
  },
  reverse_controls: {
    prompt: "Gaming icon, left and right arrows swapping positions, pixel art style, transparent background, 512x512, pink and magenta colors, sharp details, game UI asset",
    filename: "reverse-controls.png"
  },
  earthquake: {
    prompt: "Gaming icon, ground shaking with crack lines, pixel art style, transparent background, 512x512, brown and orange colors, sharp details, game UI asset",
    filename: "earthquake.png"
  },
  screen_shake: {
    prompt: "Gaming icon, screen with vibration wavy lines, pixel art style, transparent background, 512x512, cyan and white colors, sharp details, game UI asset",
    filename: "screen-shake.png"
  },
  shrink_ceiling: {
    prompt: "Gaming icon, ceiling pressing down with down arrow, pixel art style, transparent background, 512x512, red and dark gray colors, sharp details, game UI asset",
    filename: "shrink-ceiling.png"
  },
};

// Download image from URL using fetch
async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const fileStream = fs.createWriteStream(filepath);
  await pipeline(Readable.fromWeb(response.body), fileStream);
}

// Generate icon using Replicate
async function generateIcon(abilityId, spec) {
  console.log(`\n🎨 Generating icon for ${abilityId}...`);
  console.log(`   Prompt: ${spec.prompt}`);

  try {
    // Use SDXL for high-quality icons
    console.log(`   🔄 Calling Replicate API...`);
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt: spec.prompt,
          width: 512,
          height: 512,
          num_outputs: 1,
          negative_prompt: "blurry, low quality, distorted, text, watermark, signature, realistic, photo",
        }
      }
    );

    console.log(`   📥 Received output:`, typeof output, Array.isArray(output) ? `array[${output.length}]` : 'single value');

    // SDXL returns an array of URLs
    const imageUrl = Array.isArray(output) ? output[0] : output;

    if (!imageUrl) {
      throw new Error('No image URL returned from Replicate');
    }

    console.log(`   📸 Image URL: ${imageUrl}`);

    // Download the image
    const outputDir = path.join(__dirname, '../packages/web/public/abilities');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, spec.filename);
    console.log(`   💾 Downloading to: ${filepath}`);
    await downloadImage(imageUrl, filepath);

    console.log(`   ✅ Saved to ${spec.filename}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to generate ${abilityId}:`);
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error stack:`, error.stack);
    return false;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting ability icon generation with Replicate...\n');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ Error: REPLICATE_API_TOKEN environment variable not set');
    console.log('\nPlease set your Replicate API token:');
    console.log('export REPLICATE_API_TOKEN="your-token-here"');
    console.log('\nGet your token at: https://replicate.com/account/api-tokens');
    process.exit(1);
  }

  const abilities = Object.keys(abilityIconSpecs);
  console.log(`Found ${abilities.length} abilities to generate icons for\n`);

  let successCount = 0;
  let failCount = 0;

  for (const abilityId of abilities) {
    const spec = abilityIconSpecs[abilityId];
    const success = await generateIcon(abilityId, spec);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting - wait 2 seconds between requests
    if (abilities.indexOf(abilityId) < abilities.length - 1) {
      console.log('   ⏳ Waiting 2s before next generation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n✨ Generation complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`\nIcons saved to: packages/web/public/abilities/\n`);
}

main().catch(console.error);
