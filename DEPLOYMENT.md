# Tetris Battle - Deployment Guide

## Prerequisites

- Vercel account (https://vercel.com)
- Partykit account (https://partykit.io)
- Supabase project (https://supabase.com)
- Clerk account (https://clerk.com)

## Step-by-Step Deployment

### 1. Deploy Partykit Server (Do This First!)

The Partykit server must be deployed before Vercel because the web app needs the Partykit URL.

```bash
cd packages/partykit
npx partykit deploy
```

**Output:** You'll get a URL like `https://tetris-battle.yourname.partykit.dev`

**Save this URL** - you'll need it for Vercel environment variables.

---

### 2. Set Up Vercel Project

#### Option A: Deploy via CLI (Recommended)

```bash
# From project root
vercel

# Follow prompts:
# - Link to existing project or create new? → Create new
# - Project name? → tetris-battle (or your choice)
# - Which directory? → ./
# - Override settings? → No
```

#### Option B: Deploy via GitHub

1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Vercel will auto-detect the `vercel.json` configuration

---

### 3. Configure Environment Variables in Vercel

Go to your Vercel project → **Settings** → **Environment Variables**

Add these variables (for **Production**, **Preview**, and **Development**):

| Variable Name | Value | Where to Get It |
|---------------|-------|-----------------|
| `VITE_PARTYKIT_HOST` | `tetris-battle.yourname.partykit.dev` | From Step 1 (Partykit deployment) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | https://dashboard.clerk.com/ → API Keys |
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | https://supabase.com/dashboard/project/_/settings/api |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | https://supabase.com/dashboard/project/_/settings/api |

**Important:**
- Remove `http://` or `https://` from `VITE_PARTYKIT_HOST` (just the hostname)
- Example: `tetris-battle.myname.partykit.dev` ✅
- Not: `https://tetris-battle.myname.partykit.dev` ❌

---

### 4. Deploy to Vercel

```bash
# Deploy to production
vercel --prod
```

Or trigger deployment by pushing to your main branch (if using GitHub integration).

**Output:** You'll get a URL like `https://tetris-battle.vercel.app`

---

### 5. Verify Deployment

1. **Visit your Vercel URL**
2. **Test solo mode** (should work immediately)
3. **Test multiplayer**:
   - Open two browser tabs
   - Click "Multiplayer" in both
   - Should match within 20 seconds (with AI fallback)

---

## Troubleshooting

### Issue: "WebSocket connection failed"

**Cause:** Partykit host URL is incorrect

**Fix:**
1. Check Vercel environment variable `VITE_PARTYKIT_HOST`
2. Ensure it's just the hostname (no `https://`)
3. Redeploy: `vercel --prod`

### Issue: "Authentication failed"

**Cause:** Clerk keys are missing or incorrect

**Fix:**
1. Verify `VITE_CLERK_PUBLISHABLE_KEY` in Vercel
2. Make sure you're using production keys (not test keys) for production deployment
3. Check Clerk dashboard for correct key

### Issue: "Database connection error"

**Cause:** Supabase credentials are wrong

**Fix:**
1. Verify both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Check Supabase dashboard → Settings → API
3. Ensure RLS policies are set up (see `supabase/migrations/`)

### Issue: AI matches not working

**Cause:** Partykit server might not have latest code

**Fix:**
```bash
cd packages/partykit
npx partykit deploy
```

### Issue: Build fails on Vercel

**Check:**
1. Ensure `vercel.json` is in root directory
2. Check build logs for specific errors
3. Verify all dependencies are in `package.json`

---

## Environment-Specific Deployments

### Development (Local)

```bash
# Terminal 1 - Partykit
cd packages/partykit && pnpm dev

# Terminal 2 - Web app
cd packages/web && pnpm dev
```

Use `packages/web/.env.local` with:
```env
VITE_PARTYKIT_HOST=localhost:1999
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Preview (Vercel Preview Deployments)

Automatically created for PRs and non-main branches.

Uses **Preview** environment variables from Vercel settings.

### Production (Main Branch)

Deploys when you push to `main` branch or run `vercel --prod`.

Uses **Production** environment variables from Vercel settings.

---

## Post-Deployment Checklist

- [ ] Web app loads at Vercel URL
- [ ] Authentication works (Clerk login)
- [ ] Database connection works (user profiles load)
- [ ] Solo mode works
- [ ] Multiplayer matchmaking works
- [ ] AI fallback triggers after 20 seconds
- [ ] Post-match rewards are awarded
- [ ] No console errors in browser
- [ ] Mobile responsive design works

---

## Updating After Deployment

### Update Web App

```bash
git add .
git commit -m "your changes"
git push origin main
```

Vercel will auto-deploy.

### Update Partykit Server

```bash
cd packages/partykit
npx partykit deploy
```

No need to redeploy web app (unless you changed the Partykit URL).

### Update Database Schema

```bash
# Run new migrations in Supabase dashboard
# Or use Supabase CLI:
supabase db push
```

---

## Custom Domain (Optional)

1. Go to Vercel project → **Settings** → **Domains**
2. Add your domain (e.g., `tetris-battle.com`)
3. Follow DNS configuration instructions
4. Update Clerk allowed origins to include your custom domain

---

## Monitoring

- **Vercel Analytics:** https://vercel.com/dashboard/analytics
- **Partykit Logs:** `npx partykit logs`
- **Supabase Logs:** Dashboard → Database → Logs

---

## Cost Estimates (Free Tier Limits)

| Service | Free Tier | Overage Cost |
|---------|-----------|--------------|
| **Vercel** | 100 GB bandwidth, 100 builds/month | $20/month Pro |
| **Partykit** | 1M requests/month | $10/1M requests |
| **Supabase** | 500 MB database, 1 GB bandwidth | $25/month Pro |
| **Clerk** | 10,000 MAU | $25/month Pro |

**Total Cost for Hobby Project:** $0/month (stays within free tiers)

**Expected at 1,000 players:** $0-$50/month depending on usage

---

## Security Checklist

- [ ] All API keys are in environment variables (not committed to git)
- [ ] Supabase RLS policies are enabled
- [ ] Clerk authentication is enforced for multiplayer
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled (Partykit default)

---

## Next Steps

1. **Monitor user feedback** - Watch for bugs or performance issues
2. **Set up error tracking** - Consider Sentry or LogRocket
3. **Optimize bundle size** - The current 765 KB bundle could be code-split
4. **Add analytics** - Track matchmaking times, AI match rates, etc.
5. **Scale Partykit** - Upgrade if you exceed 1M requests/month

Good luck with your deployment! 🚀
