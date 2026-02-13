# Custom Ability Icon Generation Guide

This guide explains how to generate custom AI-generated icons for all abilities using Replicate.

## Prerequisites

1. **Replicate Account**: Sign up at https://replicate.com
2. **API Token**: Get your token at https://replicate.com/account/api-tokens

## Setup

### Step 1: Set your Replicate API token

```bash
export REPLICATE_API_TOKEN="r8_your_token_here"
```

Or add it to your `.env.local` file:
```bash
echo "REPLICATE_API_TOKEN=r8_your_token_here" >> .env.local
```

### Step 2: Run the icon generation script

```bash
npm run generate-icons
```

This will:
- Generate 14 custom icons (one for each ability)
- Use SDXL to create pixel art style gaming icons
- Save them to `packages/web/public/abilities/`
- Take approximately 5-7 minutes (with 2s delay between requests)

## What Gets Generated

### Buffs (5 icons)
- ✨ **Cross FireBomb** - Red cross-shaped explosion
- 💣 **Circle Bomb** - Circular blast with radiating waves
- 🧹 **Clear Rows** - Horizontal lines disappearing
- ⭐ **Cascade Multiplier** - Golden star with x2 multiplier
- 🔹 **Mini Blocks** - Small cute shrinking tetris blocks

### Debuffs (9 icons)
- ⚡ **Speed Up** - Lightning bolt with speed lines
- 🎲 **Weird Shapes** - Abstract chaotic tetris shape
- 🌧️ **Random Spawner** - Blocks raining from above
- 🔒 **Rotation Lock** - Padlock with crossed-out rotation
- 👁️ **Blind Spot** - Eye with shadowed blind zone
- ⇄ **Reverse Controls** - Swapping arrows
- 🌍 **Earthquake** - Ground shaking with cracks
- 📳 **Screen Shake** - Screen with vibration lines
- ⬇️ **Shrink Ceiling** - Ceiling pressing down

## Cost Estimate

- **Model**: SDXL (stability-ai/sdxl)
- **Cost**: ~$0.00225 per image
- **Total**: ~$0.03 for all 14 icons
- **Time**: ~5-7 minutes with rate limiting

## Customization

Edit `scripts/generate-ability-icons.js` to customize:
- **Prompts**: Modify the descriptions for each icon
- **Style**: Change "pixel art" to other styles (flat design, isometric, 3D render)
- **Colors**: Adjust color schemes in prompts
- **Model**: Switch to different models (Flux, DALL-E, etc.)

## Troubleshooting

### "REPLICATE_API_TOKEN not set"
Make sure you've exported the environment variable or added it to `.env.local`

### Rate limit errors
The script includes 2-second delays. If you still hit rate limits, increase the delay in the script.

### Low quality outputs
Try adjusting the prompts to be more specific, or switch to a different model.

## Next Steps

After generation completes, the code will automatically be updated to use these image icons instead of Unicode characters.
