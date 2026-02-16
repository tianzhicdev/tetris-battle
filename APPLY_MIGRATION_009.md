# Apply Migration 009: Fix gamesWon and matchmakingRating Columns

## Problem

When creating new users, you're getting this error:
```
{
    "code": "PGRST204",
    "details": null,
    "hint": null,
    "message": "Could not find the 'gamesWon' column of 'user_profiles' in the schema cache"
}
```

## Root Cause

There was a naming convention mismatch between the database and TypeScript code:
- **Database** (from migration 007): Used snake_case columns `games_won` and `matchmaking_rating`
- **TypeScript code**: Expects camelCase columns `gamesWon` and `matchmakingRating`

## Solution

Migration 009 fixes this by:
1. Creating proper camelCase columns: `"gamesWon"` and `"matchmakingRating"`
2. Migrating data from old snake_case columns if they exist
3. Dropping old columns: `games_won`, `matchmaking_rating`, `rank`
4. Adding proper indexes for performance

## How to Apply the Migration

### Option 1: Apply via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/009_add_games_won.sql`
4. Paste into the SQL editor
5. Click **Run**
6. You should see a success message

### Option 2: Apply via Supabase CLI

If you have Supabase CLI installed:

```bash
# From the project root
supabase migration up
```

This will automatically apply all pending migrations.

## Verification

After applying the migration, verify it worked:

```sql
-- Run this in Supabase SQL Editor
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('gamesWon', 'matchmakingRating', 'gamesPlayed', 'games_won', 'matchmaking_rating', 'rank');
```

**Expected result:**
- `gamesWon` (INTEGER) ✅
- `matchmakingRating` (INTEGER) ✅
- `gamesPlayed` (INTEGER) ✅
- No `games_won`, `matchmaking_rating`, or `rank` columns

## After Migration

Once the migration is applied:
1. Try creating a new user - the error should be gone
2. Existing users should have their data migrated automatically
3. The app should work normally

## If You Need to Reset the Entire Database

If you want to start fresh (⚠️ **THIS WILL DELETE ALL DATA**):

1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/complete-schema.sql`
3. Paste and run it
4. This will drop all tables and recreate them with the correct schema

## Technical Details

The migration:
- Adds `"gamesWon"` column with quotes (required for camelCase in PostgreSQL)
- Adds `"matchmakingRating"` column with quotes
- Migrates data from old columns if they exist:
  - `games_won` → `"gamesWon"`
  - `matchmaking_rating` → `"matchmakingRating"`
  - `rank` → `"matchmakingRating"` (if matchmakingRating doesn't exist)
- Drops old columns after migration
- Creates indexes for fast queries on ratings and wins

## Questions?

If you encounter any issues, check:
1. The migration applied successfully (no SQL errors)
2. The columns exist with correct names (camelCase with quotes)
3. Existing data was migrated (check user_profiles table)
