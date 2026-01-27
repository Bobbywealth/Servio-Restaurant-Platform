#!/bin/bash

# Quick Fix Script - Run this to apply the emergency fix
# Usage: bash fix_voice_assistant.sh

echo "🔧 Servio Voice Assistant Emergency Fix"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from Servio Restaurant Platform root directory"
    exit 1
fi

echo ""
echo "Step 1: Checking code changes..."
echo "--------------------------------"

# Show the changes we made
echo "Modified files:"
git diff --name-only

echo ""
echo "Step 2: Committing changes..."
echo "-----------------------------"

read -p "Commit and push changes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add .
    git status
    echo ""
    read -p "Enter commit message (or press Enter for default): " -e COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Fix SQL syntax: use single quotes for PostgreSQL string literals"
    fi
    git commit -m "$COMMIT_MSG"
    echo ""
    echo "Pushing to origin/main..."
    git push origin main
    echo ""
    echo "✅ Code deployed! Now restart the backend on Render."
else
    echo "⏭️  Skipped commit. You'll need to manually commit and push."
fi

echo ""
echo "Step 3: Restart Backend on Render"
echo "-----------------------------------"
echo "1. Go to: https://dashboard.render.com"
echo "2. Find your 'servio-backend' service"
echo "3. Click 'Manual Deploy' → 'Deploy latest commit'"
echo "4. Wait for deployment to complete"
echo "5. Check logs for: '✅ Migration 023/024 applied successfully'"
echo ""

echo "Step 4: Test the Fix"
echo "--------------------"
echo "1. Visit: https://servio.solutions/dashboard/assistant"
echo "2. Type: 'What is the store status?'"
echo "3. Should respond with store metrics (orders, tasks, inventory)"
echo "4. Try a voice command"
echo ""

echo "Step 5: Verify in Console"
echo "-------------------------"
echo "Should see NO errors like:"
echo "  - 'column completed does not exist'"
echo "  - SQL syntax errors"
echo ""

echo "📖 Full guide: See EMERGENCY_FIX_SUMMARY.md"
echo "🎯 Quick guide: See EMERGENCY_FIX_VOICE_ASSISTANT.md"
