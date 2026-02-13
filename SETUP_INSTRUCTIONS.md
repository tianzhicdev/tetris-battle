# Tetris Battle - Setup Instructions

## Quick Start (5 minutes)

### Step 1: Create Supabase Project

1. Go to **https://supabase.com** and sign in (or create a free account)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `tetris-battle` (or whatever you like)
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free
4. Click **"Create new project"** and wait ~2 minutes for setup

### Step 2: Get Your API Credentials

1. In your Supabase project dashboard, click **Settings** (⚙️ gear icon) in the left sidebar
2. Click **API** under Settings
3. You'll see:
   - **Project URL**: Something like `https://xxxxx.supabase.co`
   - **Project API keys** → **anon/public**: A long string starting with `eyJ...`

### Step 3: Run the Database Migration

1. In Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Open the file: `tetris-battle/supabase/migrations/001_initial_schema.sql`
4. Copy ALL the SQL code
5. Paste it into the Supabase SQL Editor
6. Click **RUN** (or press Cmd/Ctrl + Enter)
7. You should see ✅ "Success. No rows returned"

### Step 4: Configure Your App

1. In the `tetris-battle/packages/web/` folder, create a file named `.env.local`
2. Copy this template and fill in YOUR values:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-key-here...
```

3. Save the file

### Step 5: Start Playing!

```bash
# From the project root
pnpm --filter web dev
```

Open **http://localhost:5173/** in your browser!

---

## Testing Multiplayer (2 Devices)

1. **Deploy to Vercel** (free):
   ```bash
   # Install Vercel CLI
   npm install -g vercel

   # Deploy from packages/web directory
   cd packages/web
   vercel
   ```

2. Add your Supabase env vars in Vercel dashboard:
   - Go to your project settings
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

3. Open the Vercel URL on **two different devices** (phone + laptop, or two browsers)

4. Both click **"Find Match"** and you'll be paired together!

---

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists in `packages/web/`
- Check that variable names start with `VITE_`
- Restart the dev server after creating `.env.local`

### "Failed to fetch" or connection errors
- Verify your Supabase project is **active** (not paused)
- Check that you copied the **anon/public** key (not the service_role key)
- Make sure you ran the SQL migration

### Matchmaking not working
- Open browser console (F12) to see errors
- Verify the `matchmaking_queue` table exists in Supabase
- Try refreshing both players at the same time

---

## What's Next?

Once multiplayer is working, we'll add:
- ✅ Abilities system (10 buffs/debuffs)
- ✅ Visual feedback for opponent's moves
- ✅ Ability activation UI
- ✅ Victory/defeat screens
- ✅ Better matchmaking UI

Ready to code! 🎮
