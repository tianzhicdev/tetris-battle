import Replicate from 'replicate';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Test different styles for the same ability (Cross FireBomb)
const testStyles = {
  // Simple flat design
  flat_minimal: {
    prompt: "Simple flat design icon, red plus sign explosion symbol, minimalist style, solid colors, clean lines, game icon, transparent background, 512x512, bold shapes",
    filename: "test-flat-minimal.png"
  },

  // Line art / vector style
  line_art: {
    prompt: "Line art icon, cross explosion outline, vector style, bold black outlines, red fill, simple geometric shapes, game icon, transparent background, 512x512",
    filename: "test-line-art.png"
  },

  // Simplified pixel art
  simple_pixel: {
    prompt: "Very simple pixel art icon, 32x32 style enlarged, red cross explosion, only 4-5 colors, clear silhouette, retro game icon, transparent background, 512x512, chunky pixels",
    filename: "test-simple-pixel.png"
  },

  // Isometric style
  isometric: {
    prompt: "Isometric game icon, red cross-shaped explosion, 3D isometric view, simple geometric shapes, vibrant colors, clean style, transparent background, 512x512",
    filename: "test-isometric.png"
  },

  // Emoji/sticker style
  sticker: {
    prompt: "Emoji style icon, cartoon explosion in cross shape, bright red and orange, glossy sticker look, bold outlines, cheerful style, transparent background, 512x512",
    filename: "test-sticker.png"
  },

  // Monochrome silhouette
  silhouette: {
    prompt: "Bold silhouette icon, cross explosion shape, single color solid design, strong contrast, clear readable shape, game UI icon, transparent background, 512x512",
    filename: "test-silhouette.png"
  }
};

async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const fileStream = fs.createWriteStream(filepath);
  await pipeline(Readable.fromWeb(response.body), fileStream);
}

async function generateTestIcon(styleName, spec) {
  console.log(`\n🎨 Testing style: ${styleName}`);
  console.log(`   Prompt: ${spec.prompt}`);

  try {
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt: spec.prompt,
          width: 512,
          height: 512,
          num_outputs: 1,
          negative_prompt: "blurry, low quality, distorted, text, watermark, signature, realistic photo, complex details, gradient, shadows",
        }
      }
    );

    const imageUrl = Array.isArray(output) ? output[0] : output;
    const outputDir = path.join(__dirname, '../test-icons');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, spec.filename);
    await downloadImage(imageUrl, filepath);

    console.log(`   ✅ Saved to test-icons/${spec.filename}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing different icon styles for Cross FireBomb ability...\n');
  console.log('This will generate 6 different style variations.\n');

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ Error: REPLICATE_API_TOKEN environment variable not set');
    process.exit(1);
  }

  const styles = Object.keys(testStyles);
  let successCount = 0;

  for (const styleName of styles) {
    const spec = testStyles[styleName];
    const success = await generateTestIcon(styleName, spec);

    if (success) successCount++;

    // Rate limiting
    if (styles.indexOf(styleName) < styles.length - 1) {
      console.log('   ⏳ Waiting 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n✨ Test complete! Generated ${successCount}/${styles.length} styles`);
  console.log(`\nView results in: test-icons/`);
  console.log('\nCompare the styles and let me know which one you prefer!');
  console.log('Then I can regenerate all 14 icons in that style.\n');
}

main().catch(console.error);
