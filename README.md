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

## How It Works

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

## Commands

| Command | Description |
|---------|-------------|
| `claude-plan-tracker init` | Setup hooks in `.claude/settings.json` |
| `claude-plan-tracker status` | Show plan status for current branch |
| `claude-plan-tracker list` | List all tracked branches and plans |
| `claude-plan-tracker sync` | Manually sync current plan to repo |

## What Gets Saved

Plans are saved to `.claude/plans/` in your repo with metadata:

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

## Roadmap

- [x] Project setup and documentation
- [x] Basic plan persistence (SessionEnd hook)
- [x] Commit tracking (PostToolUse hook)
- [x] Branch-aware context loading (SessionStart hook)
- [x] CLI commands (init, status, list, sync)
- [ ] Plan diff viewer
- [ ] PR description generation from plans

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

# Or use tsx for development
npm run dev -- --help
```

## Requirements

- Node.js 18+
- Claude Code CLI
- Git repository

## License

MIT
