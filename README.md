# Claude Plan Tracker

**Never lose context between Claude Code sessions again.**

Claude Plan Tracker is a CLI tool that integrates with [Claude Code](https://claude.ai/code) to automatically persist your AI-assisted development plans and track which commits were made during each planning session.

## The Problem

When working with Claude Code on complex features:
- Plans are stored in `~/.claude/plans/` with random names like `jazzy-booping-bentley.md`
- No connection between plans and your git branches
- After context overflow or new session, you lose continuity
- No audit trail: which plan led to which commits?

## The Solution

Claude Plan Tracker hooks into Claude Code to:

1. **Auto-load previous context** - When you start a session, automatically inject the previous plan for your current branch
2. **Persist plans to your repo** - Plans are saved to `.claude/plans/{branch}.md` when sessions end
3. **Track commits** - Know exactly which commits were made during each planning session
4. **Branch-aware** - Each git branch has its own plan history

## Quick Start

```bash
# Install globally
npm install -g claude-plan-tracker

# Initialize in your project
cd your-project
claude-plan-tracker init

# That's it! Start Claude Code as usual
claude
```

## How It Works - Technical Deep Dive

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code Session                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SessionStart Hook                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Detect current git branch                              │   │
│  │ 2. Find previous plan for this branch                     │   │
│  │ 3. Inject plan + commit history as context                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  You work with Claude...                                         │
│                              ↓                                   │
│  PostToolUse Hook (on git commit)                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Track commit hash → associate with current plan           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  SessionEnd Hook                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Copy plan to .claude/plans/{branch}.md                 │   │
│  │ 2. Add metadata: source, timestamp, commits               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Claude Code Hooks System

Claude Code supports [hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) - custom commands that run at specific points during a session. This tool uses three hooks:

| Hook | Trigger | Purpose |
|------|---------|---------|
| `SessionStart` | When Claude Code starts or resumes | Load previous plan into context |
| `SessionEnd` | When session ends (`/clear`, exit, etc.) | Save current plan to repo |
| `PostToolUse` | After any tool executes | Track git commits |

### Data Flow

1. **SessionStart** - When you run `claude` in your project:
   - Hook receives JSON via stdin with `session_id`, `cwd`, etc.
   - Detects current git branch using `git rev-parse --abbrev-ref HEAD`
   - Looks for existing plan in `.claude/plans/{branch}.md`
   - If not found, searches Claude's storage (`~/.claude/projects/`) for sessions on this branch
   - Outputs plan content to stdout → Claude adds it to conversation context

2. **During Session** - When you make git commits:
   - PostToolUse hook monitors Bash commands
   - Detects `git commit` commands
   - Records commit hash to the plan metadata

3. **SessionEnd** - When session ends:
   - Reads current plan from Claude's storage (`~/.claude/plans/{slug}.md`)
   - Copies to your repo: `.claude/plans/{branch}.md`
   - Adds YAML frontmatter with metadata (source, timestamp, commits)

### Where Data Lives

| Location | Purpose |
|----------|---------|
| `~/.claude/plans/{slug}.md` | Claude's internal plan storage (random names) |
| `~/.claude/projects/{path}/` | Claude's session data (maps branches to plan slugs) |
| `.claude/plans/{branch}.md` | Your repo - persisted plans with metadata |
| `.claude/settings.json` | Your repo - hooks configuration |

## Manual Configuration (Without Init)

If you prefer to configure hooks manually or need custom settings, create `.claude/settings.json` in your project root:

### Using npm package (recommended)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx claude-plan-tracker hook session-start"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx claude-plan-tracker hook session-end"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "npx claude-plan-tracker hook post-tool-use"
          }
        ]
      }
    ]
  }
}
```

### Using local installation (development)

If you cloned the repo and want to use local version:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/claude-plan-tracker/dist/index.js hook session-start"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/claude-plan-tracker/dist/index.js hook session-end"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node /absolute/path/to/claude-plan-tracker/dist/index.js hook post-tool-use"
          }
        ]
      }
    ]
  }
}
```

### Selective hooks

You don't need all hooks. Pick what you need:

**Only persist plans (no auto-load):**
```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx claude-plan-tracker hook session-end"
          }
        ]
      }
    ]
  }
}
```

**Only load previous context (no persistence):**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx claude-plan-tracker hook session-start"
          }
        ]
      }
    ]
  }
}
```

## Complete Workflow Guide

### First Time Setup

```bash
# 1. Install the package
npm install -g claude-plan-tracker

# 2. Navigate to your project
cd ~/projects/my-app

# 3. Initialize (creates .claude/settings.json)
claude-plan-tracker init

# 4. Verify configuration
cat .claude/settings.json
```

### Daily Workflow

```bash
# 1. Start Claude Code
claude

# 2. If previous plan exists for this branch, you'll see:
#    "From the SessionStart hook, I received this message: ..."
#    followed by your previous plan content

# 3. Work normally with Claude - create plans, write code, commit

# 4. End session with /clear or exit
#    → Plan is automatically saved to .claude/plans/{branch}.md

# 5. Next time you start claude on same branch
#    → Previous plan is loaded automatically
```

### Switching Branches

```bash
# On feature/auth branch - has its own plan
git checkout feature/auth
claude  # loads plan for feature/auth

# Switch to main - different plan (or none)
git checkout main
claude  # loads plan for main (if exists)
```

## Verifying Context Injection

### Method 1: Check Claude's startup message

When you start `claude`, look for this message:

```
From the SessionStart hook, I received this message:
## Previous Plan for branch "feature/auth"
...
```

If you see this, the context was injected successfully.

### Method 2: Ask Claude directly

Start a session and ask:

```
Do you have any context about a previous plan for this branch?
```

or

```
What do you know about the current implementation plan?
```

### Method 3: Check hook output manually

Test the hook directly in terminal:

```bash
# Simulate what Claude Code sends to the hook
echo '{"session_id":"test","cwd":"'$(pwd)'","hook_event_name":"SessionStart","source":"startup"}' | npx claude-plan-tracker hook session-start
```

If there's a plan for your current branch, you'll see it printed.

### Method 4: Debug with verbose output

Check if the plan file exists:

```bash
# See what branch you're on
git branch --show-current

# Check if plan exists for this branch
ls -la .claude/plans/

# View plan content
cat .claude/plans/$(git branch --show-current | tr '/' '-').md
```

## Troubleshooting

### Hook not running

1. **Verify settings.json exists:**
   ```bash
   cat .claude/settings.json
   ```

2. **Check JSON syntax:**
   ```bash
   npx jsonlint .claude/settings.json
   ```

3. **Verify package is installed:**
   ```bash
   npx claude-plan-tracker --version
   ```

### Plan not loading on SessionStart

1. **Check if plan exists:**
   ```bash
   claude-plan-tracker status
   ```

2. **Test hook manually:**
   ```bash
   echo '{"session_id":"test","cwd":"'$(pwd)'","hook_event_name":"SessionStart"}' | npx claude-plan-tracker hook session-start
   ```

3. **Verify git branch:**
   ```bash
   git branch --show-current
   ```

### Plan not saving on SessionEnd

1. **Check Claude's plan storage:**
   ```bash
   ls -la ~/.claude/plans/
   ```

2. **Run sync manually:**
   ```bash
   claude-plan-tracker sync --force
   ```

3. **Check for errors:**
   ```bash
   echo '{"session_id":"test","cwd":"'$(pwd)'","hook_event_name":"SessionEnd","reason":"clear"}' | npx claude-plan-tracker hook session-end
   ```

### Common issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "command not found" | Package not installed | `npm install -g claude-plan-tracker` |
| No context on start | No previous plan exists | Work with Claude in plan mode first |
| Wrong plan loaded | Branch mismatch | Check `git branch --show-current` |
| Plan not persisted | Session didn't end cleanly | Run `claude-plan-tracker sync` |

## CLI Commands

| Command | Description |
|---------|-------------|
| `claude-plan-tracker init` | Setup hooks in `.claude/settings.json` |
| `claude-plan-tracker status` | Show plan status for current branch |
| `claude-plan-tracker list` | List all tracked branches and plans |
| `claude-plan-tracker sync` | Manually sync current plan to repo |
| `claude-plan-tracker sync --force` | Force sync even if repo plan is newer |
| `claude-plan-tracker sync --all` | Sync plans for all known branches |

## What Gets Saved

Plans are saved to `.claude/plans/` in your repo with YAML frontmatter:

```markdown
---
branch: feature/auth
source: jazzy-booping-bentley.md
last_updated: 2026-01-21T14:30:00Z
commits:
  - a1b2c3d
  - e4f5g6h
---

# Implementation Plan

[Your plan content here...]
```

### Should you commit .claude/plans/?

**Yes** - if you want to:
- Share plans with team members
- Track plan evolution in git history
- Have plans as part of PR reviews

**No** - if you want to:
- Keep plans private
- Avoid cluttering git history

Add to `.gitignore` if you don't want to track:
```
.claude/plans/
```

## Development

```bash
# Clone the repo
git clone https://github.com/JanSmrcka/claude-plan-tracker.git
cd claude-plan-tracker

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/index.js --help

# Link for local testing
npm link
```

## Roadmap

- [x] Basic plan persistence (SessionEnd hook)
- [x] Branch-aware context loading (SessionStart hook)
- [x] CLI commands (init, status, list, sync)
- [x] Commit tracking (PostToolUse hook)
- [ ] Plan diff viewer
- [ ] PR description generation from plans
- [ ] Team plan sharing

## Requirements

- Node.js 18+
- Claude Code CLI
- Git repository

## License

MIT
