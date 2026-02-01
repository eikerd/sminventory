# Greptile Code Review Workflow

## Overview

`fix-greptile.sh` is a helper script that fetches PR review comments from GitHub and pipes them directly to Claude for intelligent analysis and fix recommendations.

## Installation

The script is already in your project root:

```bash
./fix-greptile.sh
```

It's executable and ready to use.

## Usage

### Basic Usage

```bash
./fix-greptile.sh <PR_NUMBER>
```

### Examples

```bash
# Fetch comments from PR #1 and analyze with Claude
./fix-greptile.sh 1

# Fetch comments from PR #123 and analyze with Claude
./fix-greptile.sh 123
```

## How It Works

1. **Fetches PR Comments** - Uses `gh pr view <PR_NUMBER> --comments` to get all review comments
2. **Displays Comments** - Shows you the full comment text for reference
3. **Sends to Claude** - Pipes the comments directly to Claude for analysis
4. **Claude Analyzes** - Claude reads the reviewer feedback and can:
   - Summarize the key issues
   - Suggest fixes for code comments
   - Explain reviewer concerns
   - Generate fix commits automatically

## Workflow Example

```bash
# After Greptile (or any reviewer) comments on your PR
$ ./fix-greptile.sh 1

📥 Fetching comments from PR #1...
✅ Retrieved PR #1 with 3 comments
📝 Comments:
─────────────────────────────────────────────
[Comments displayed here]
─────────────────────────────────────────────

🤖 Sending to Claude for analysis...

# Claude then appears in interactive mode to discuss the feedback
```

## Requirements

- **GitHub CLI (`gh`)** - Install from https://cli.github.com
- **Claude Code** - For piping comments to Claude
- **Git repository** - Must be in a git repository with GitHub remote configured

## Repeatable Usage

The script is fully repeatable. You can:

1. Run it multiple times to fetch updated comments
2. Run it as you're making fixes (comments get added progressively)
3. Use it in batch scripts or automation

```bash
# Run multiple times as you iterate on fixes
./fix-greptile.sh 1
# ... make changes ...
./fix-greptile.sh 1
# ... make more changes ...
./fix-greptile.sh 1
```

## Error Handling

The script validates:
- PR number is provided and numeric
- `gh` CLI is installed
- PR exists and is accessible

Example errors:

```bash
$ ./fix-greptile.sh
Error: PR number required
Usage: ./fix-greptile.sh <PR_NUMBER>

$ ./fix-greptile.sh abc
Error: PR number must be numeric

$ ./fix-greptile.sh 999
Error: Failed to fetch PR #999
```

## Advanced: Redirecting Output

You can also save comments to a file for later review:

```bash
# Save comments and manually review
./fix-greptile.sh 1 | tee /tmp/pr-feedback.txt

# Or just fetch comments without Claude
gh pr view 1 --comments > /tmp/pr-comments.txt
cat /tmp/pr-comments.txt
```

## Integration with Claude Code

When you run the script, Claude will be interactive. You can:

- Ask Claude to explain specific comments
- Request code fixes for issues mentioned
- Ask for commit messages
- Get help implementing the suggested changes

Example Claude conversation:

```
You: "./fix-greptile.sh 1"
[Comments loaded...]

You: "Can you fix all the issues mentioned in these comments?"
Claude: [Analyzes comments and provides fixes]

You: "Now create a commit with these changes"
Claude: [Creates the commit]

You: "Push to GitHub"
Claude: [Pushes the changes]
```

## Tips

1. **Run frequently** - Check for new comments and fixes as they come in
2. **Use during development** - Don't wait for review to complete; start analyzing early
3. **Batch fixes** - Collect multiple comment rounds before re-pushing
4. **Reference comments** - The script displays comments before sending to Claude, so you have context

## Troubleshooting

### "Error: GitHub CLI (gh) is not installed"

Install GitHub CLI:
```bash
# macOS
brew install gh

# Linux
curl -sL https://github.com/cli/cli/releases/latest/download/gh_*_linux_amd64.tar.gz | tar xz
sudo ./gh/bin/gh
```

### "Error: Failed to fetch PR"

Check your GitHub credentials:
```bash
gh auth status
gh auth login  # If needed
```

### No comments showing up

It's normal if the PR has no comments yet. They'll appear once reviewers add them.

## See Also

- `PM2_SETUP.md` - Process management and logging
- `CLAUDE.md` - Project development guidelines
