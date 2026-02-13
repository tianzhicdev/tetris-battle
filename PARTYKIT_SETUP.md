# Partykit Setup - Simple & Fast!

Partykit is **WAY** more reliable than Supabase for real-time multiplayer. Here's how to get it running:

---

## 🚀 Quick Start (2 Steps)

### Step 1: Start Partykit Dev Server (Local Testing)

Open a **new terminal** and run:

```bash
cd packages/partykit
npx partykit dev
```

This starts the Partykit server on **localhost:1999**

You should see:
```
🎈 PartyKit v0.x.x
  ➜  http://127.0.0.1:1999
```

### Step 2: Start the Web App

In **another terminal**:

```bash
# From project root
pnpm --filter web dev -- --host
```

Now open:
- **Computer**: http://localhost:5173/
- **Phone** (same WiFi): http://192.168.140.14:5173/

Both click **MULTIPLAYER** → You'll be matched instantly!

---

## 🌍 Deploy to Production (Get Public URL)

Once local testing works, deploy to get a URL that works anywhere:

### 1. Sign up at partykit.io

Go to **https://www.partykit.io/** and create a free account (takes 30 seconds)

### 2. Deploy

```bash
cd packages/partykit
npx partykit deploy
```

Follow the prompts to login. You'll get a URL like:

```
https://tetris-battle.your-username.partykit.dev
```

### 3. Update .env

Copy your URL and update `packages/web/.env.local`:

```bash
VITE_PARTYKIT_HOST=tetris-battle.your-username.partykit.dev
```

### 4. Restart Web App

```bash
pnpm --filter web dev -- --host
```

Now your game works from **any device, anywhere**!

---

## 📱 How to Play Multiplayer

1. Open the game on **2 devices** (computer + phone, or 2 browsers)
2. Both click **"MULTIPLAYER"**
3. Both click **"Find Match"**
4. You'll be paired automatically!
5. See each other's boards in real-time

---

## 🐛 Troubleshooting

### "Failed to connect to Partykit"

**Check**: Is the Partykit dev server running?

```bash
cd packages/partykit
npx partykit dev
```

You should see "PartyKit v0.x.x" in the terminal.

### "Matchmaking not working"

- **Local**: Make sure `VITE_PARTYKIT_HOST=localhost:1999` in `.env.local`
- **Production**: Make sure you deployed with `npx partykit deploy` and updated the URL

### "Can't connect from phone"

- Make sure phone is on **same WiFi**
- Use the network URL: http://192.168.140.14:5173/
- Check firewall isn't blocking port 5173

---

## 💰 Cost

- **Local development**: FREE
- **Production (partykit.dev)**: FREE for low volume
  - 1000 connections/day free
  - More than enough for testing + small games

---

## 🎮 What's Next?

Once multiplayer works:
1. ✅ Deploy web app to Vercel (one command)
2. ✅ Add the 10 abilities system
3. ✅ Test on real devices (phone vs laptop)

You're almost there! Just start the Partykit server and test! 🚀
