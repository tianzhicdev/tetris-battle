#!/bin/bash

set -e  # Exit on error

echo "🚀 Starting deployment process..."
echo ""

# Check if there are changes to commit
if [[ -n $(git status -s) ]]; then
  echo "📝 Committing changes..."
  git add -A

  # Generate commit message or use argument
  if [ -z "$1" ]; then
    COMMIT_MSG="chore: deploy updates

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  else
    COMMIT_MSG="$1

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  fi

  git commit -m "$COMMIT_MSG"
  echo "✅ Changes committed"
else
  echo "ℹ️  No changes to commit"
fi

echo ""
echo "📤 Pushing to git..."
BRANCH=$(git branch --show-current)
git push origin "$BRANCH"
echo "✅ Pushed to origin/$BRANCH"

echo ""
echo "🎈 Deploying to PartyKit..."
cd packages/partykit
npx partykit deploy
cd ../..
echo "✅ PartyKit deployed"

echo ""
echo "🎉 Deployment complete!"
echo "   - Git: pushed to origin/$BRANCH"
echo "   - PartyKit: https://tetris-battle.tianzhicdev.partykit.dev"
