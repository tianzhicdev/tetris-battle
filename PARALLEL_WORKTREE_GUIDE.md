# Parallel Implementation with Git Worktrees

## Conflict Analysis

### Spec 009: Theme System
**Primary Files to Modify:**
- `packages/web/src/themes/` (NEW directory)
  - `retro8bit.ts`, `neonCyberpunk.ts`, `minimalist.ts`, etc.
- `packages/web/src/themes.ts` (minor changes - add theme exports)
- `packages/web/src/renderer/TetrisRenderer.ts` (add theme rendering support)
- `packages/web/src/components/ThemeSelector.tsx` (NEW)
- `packages/web/src/stores/themeStore.ts` (NEW)

**Impact**: Mostly creates new files, minimal existing file changes

### Spec 010: Client-Side Prediction
**Primary Files to Modify:**
- `packages/web/src/components/ServerAuthMultiplayerGame.tsx` (major changes to input handling)
- `packages/web/src/stores/predictionStore.ts` (NEW)
- `packages/web/src/services/partykit/ServerAuthGameClient.ts` (add sequence numbers)
- `packages/game-core/src/types.ts` (add prediction types)

**Impact**: Modifies server-auth game logic, creates new prediction state

### Conflict Assessment
✅ **LOW CONFLICT RISK** - These specs touch different areas:
- Theme system: Presentation/rendering layer
- Client prediction: Game state/networking layer

**Only potential conflict**: `ServerAuthMultiplayerGame.tsx`
- Theme system may add theme prop/context
- Prediction system will modify input handlers
- **Mitigation**: Theme changes are additive (add props), prediction changes are in different methods

---

## Setup Instructions

### Step 1: Create Worktrees

```bash
# In your main repo directory
cd /Users/biubiu/projects/tetris-battle

# Create worktree for theme system (in ../tetris-battle-themes/)
git worktree add ../tetris-battle-themes main

# Create worktree for client prediction (in ../tetris-battle-prediction/)
git worktree add ../tetris-battle-prediction main

# Verify worktrees
git worktree list
# Should show:
# /Users/biubiu/projects/tetris-battle        <commit-hash> [main]
# /Users/biubiu/projects/tetris-battle-themes <commit-hash> [main]
# /Users/biubiu/projects/tetris-battle-prediction <commit-hash> [main]
```

### Step 2: Create Feature Branches

```bash
# Terminal 1 - Theme System
cd ../tetris-battle-themes
git checkout -b feature/009-theme-system
echo "Working on: Spec 009 - Theme System"

# Terminal 2 - Client Prediction
cd ../tetris-battle-prediction
git checkout -b feature/010-client-prediction
echo "Working on: Spec 010 - Client-Side Prediction"
```

---

## Parallel Implementation (2 Terminals)

### Terminal 1: Theme System

```bash
cd /Users/biubiu/projects/tetris-battle-themes

# Start Claude Code for theme system
claude -p "Implement specs/009-theme-system.md. Create a modular theme system with at least 10 distinct visual themes. Focus on creating new theme files in packages/web/src/themes/, minimal changes to existing files. Test each theme works correctly."

# While Claude works, you can monitor progress:
git status
git diff

# When done, commit and push
git add .
git commit -m "feat: Implement customizable theme system (Spec 009)"
git push origin feature/009-theme-system
```

### Terminal 2: Client Prediction

```bash
cd /Users/biubiu/projects/tetris-battle-prediction

# Start Claude Code for client prediction
claude -p "Implement specs/010-client-side-prediction.md. Add client-side prediction to reduce input lag in server-authoritative mode. Create prediction state management, implement input prediction, add reconciliation logic. Ensure smooth gameplay with <50ms perceived input lag."

# Monitor progress
git status
git diff

# When done, commit and push
git add .
git commit -m "feat: Add client-side prediction for server-auth mode (Spec 010)"
git push origin feature/010-client-prediction
```

---

## Merging Strategy

### Option A: Sequential Merge (Safer)

```bash
# Merge theme system first (likely no conflicts)
cd /Users/biubiu/projects/tetris-battle
git checkout main
git pull origin main
git merge feature/009-theme-system
git push origin main

# Then merge prediction
git merge feature/010-client-prediction
# If conflicts in ServerAuthMultiplayerGame.tsx:
#   1. Theme changes are usually additive (props, context)
#   2. Prediction changes are in input handlers
#   3. Manually merge both changes - they complement each other
git push origin main
```

### Option B: Rebase and Merge (Cleaner History)

```bash
# Rebase prediction onto theme
cd ../tetris-battle-prediction
git fetch origin
git rebase origin/feature/009-theme-system
# Resolve any conflicts
git push origin feature/010-client-prediction --force-with-lease

# Then merge both to main
cd /Users/biubiu/projects/tetris-battle
git checkout main
git merge feature/009-theme-system
git merge feature/010-client-prediction
git push origin main
```

---

## Running Both Implementations

### Terminal 1 (Theme System)
```bash
cd /Users/biubiu/projects/tetris-battle-themes
# Install dependencies if needed
pnpm install
# Run dev server on port 5173 (default)
pnpm --filter web dev
```

### Terminal 2 (Client Prediction)
```bash
cd /Users/biubiu/projects/tetris-battle-prediction
# Install dependencies
pnpm install
# Run dev server on different port to avoid conflict
pnpm --filter web dev -- --port 5174
```

### Terminal 3 (PartyKit for both)
```bash
cd /Users/biubiu/projects/tetris-battle/packages/partykit
pnpm dev
# This serves both worktrees since they share the same PartyKit code initially
```

---

## Testing After Merge

Once both are merged to main:

```bash
cd /Users/biubiu/projects/tetris-battle
git checkout main
git pull

# Test themes
pnpm --filter web dev
# Open http://localhost:5173
# Navigate to theme selector, test each theme

# Test client prediction
# Open http://localhost:5173?serverAuth=true
# Test input responsiveness, verify <50ms lag
# Test mispredictions are handled gracefully
```

---

## Cleanup Worktrees (After Merge)

```bash
# List worktrees
git worktree list

# Remove theme worktree
git worktree remove ../tetris-battle-themes

# Remove prediction worktree
git worktree remove ../tetris-battle-prediction

# Delete local branches (optional)
git branch -d feature/009-theme-system
git branch -d feature/010-client-prediction

# Delete remote branches (after PR merged)
git push origin --delete feature/009-theme-system
git push origin --delete feature/010-client-prediction
```

---

## Quick Reference

### Two Terminal Setup (Side-by-Side)

**Terminal 1 (Left):**
```bash
cd /Users/biubiu/projects/tetris-battle-themes
git checkout feature/009-theme-system
claude -p "Implement specs/009-theme-system.md..."
```

**Terminal 2 (Right):**
```bash
cd /Users/biubiu/projects/tetris-battle-prediction
git checkout feature/010-client-prediction
claude -p "Implement specs/010-client-side-prediction.md..."
```

### Watch Both Progress Simultaneously

**Terminal 3 (Bottom Split):**
```bash
# Watch theme progress
watch -n 5 'cd /Users/biubiu/projects/tetris-battle-themes && git status --short'
```

**Terminal 4 (Bottom Split):**
```bash
# Watch prediction progress
watch -n 5 'cd /Users/biubiu/projects/tetris-battle-prediction && git status --short'
```

---

## Tips for Success

1. **Start both Claude Code instances simultaneously** - they work independently
2. **Monitor git status** - ensure no unexpected file changes
3. **Commit frequently** - easier to resolve conflicts with smaller commits
4. **Test before merging** - run both dev servers on different ports
5. **Merge theme first** - it has fewer conflicts, establishes baseline
6. **Communicate** - if you notice a conflict emerging, pause one implementation

---

## Emergency: Resolving Conflicts

If `ServerAuthMultiplayerGame.tsx` has conflicts:

```typescript
// Theme system adds (top of file):
import { useTheme } from '../contexts/ThemeContext';

// Prediction system adds (top of file):
import { usePrediction } from '../stores/predictionStore';

// Theme system adds (in component):
const theme = useTheme();

// Prediction system modifies (input handling):
const handleInput = (action: InputAction) => {
  predictInput(action); // Immediate prediction
  sendToServer(action); // Async send
};

// MERGED VERSION: Include both
import { useTheme } from '../contexts/ThemeContext';
import { usePrediction } from '../stores/predictionStore';

function ServerAuthMultiplayerGame() {
  const theme = useTheme();
  const { predictInput, sendToServer } = usePrediction();

  const handleInput = (action: InputAction) => {
    predictInput(action);
    sendToServer(action);
  };

  // Both changes work together!
}
```
