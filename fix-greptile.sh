#!/usr/bin/env bash

# Script: fix-greptile.sh
# Purpose: Fetch PR review comments and send to Claude for analysis
# Usage: ./fix-greptile.sh <PR_NUMBER>
#
# Examples:
#   ./fix-greptile.sh 1          # Fetch comments from PR #1
#   ./fix-greptile.sh 123        # Fetch comments from PR #123
#
# The script will:
# 1. Fetch all comments from the specified PR using GitHub CLI
# 2. Save them to /tmp/greptile.txt
# 3. Pipe the comments to Claude for analysis
# 4. Claude can then help address the review feedback

set -euo pipefail

# Check if PR number was provided
if [ $# -eq 0 ]; then
    echo "Error: PR number required"
    echo ""
    echo "Usage: $0 <PR_NUMBER>"
    echo ""
    echo "Examples:"
    echo "  $0 1"
    echo "  $0 123"
    exit 1
fi

PR=$1

# Validate PR number is numeric
if ! [[ "$PR" =~ ^[0-9]+$ ]]; then
    echo "Error: PR number must be numeric"
    exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com"
    exit 1
fi

echo "📥 Fetching comments from PR #$PR..."

# Fetch PR comments using JSON output (more reliable than --comments flag)
if gh pr view "$PR" --json comments,title,body 2>/dev/null > /tmp/greptile.json; then
    # Format the JSON for readability
    if command -v python3 &> /dev/null; then
        python3 -m json.tool < /tmp/greptile.json > /tmp/greptile.txt
    else
        cat /tmp/greptile.json > /tmp/greptile.txt
    fi

    COMMENT_COUNT=$(grep -o '"id":"' /tmp/greptile.json 2>/dev/null | wc -l)
    echo "✅ Retrieved PR #$PR"
    if [ "$COMMENT_COUNT" -gt 0 ]; then
        echo "   Found $COMMENT_COUNT review comment(s)"
    else
        echo "   No review comments yet"
    fi
    echo ""
    echo "📝 Greptile Review Comments:"
    echo "─────────────────────────────────────────────"
    cat /tmp/greptile.txt
    echo "─────────────────────────────────────────────"
    echo ""
    echo "🤖 Sending to Claude for analysis and fixes..."
    echo ""
    cat /tmp/greptile.txt | claude
else
    echo "Error: Failed to fetch PR #$PR"
    echo "Make sure the PR number is correct and you have access to the repository"
    exit 1
fi
