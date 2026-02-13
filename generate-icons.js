// Quick icon generator for PWA
// Run: node generate-icons.js

const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Letter T
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', size / 2, size / 2);

  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`packages/web/public/${filename}`, buffer);
  console.log(`✓ Created ${filename}`);
}

try {
  generateIcon(192, 'icon-192.png');
  generateIcon(512, 'icon-512.png');
  console.log('\n✅ PWA icons created successfully!');
} catch (error) {
  console.error('❌ Error: canvas package not installed');
  console.log('\nInstall it with: npm install canvas');
  console.log('Or create icons manually using the guide below:\n');
  console.log('Option 1: Use Figma/Canva');
  console.log('  1. Create 512x512 square');
  console.log('  2. Add gradient background (#667eea to #764ba2)');
  console.log('  3. Add white "T" in center');
  console.log('  4. Export as icon-512.png and icon-192.png\n');
  console.log('Option 2: Use online tool');
  console.log('  Visit: https://favicon.io/favicon-generator/');
  console.log('  Or: https://www.favicon-generator.org/');
}
