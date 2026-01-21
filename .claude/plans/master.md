# Claude Plan Tracker - Comprehensive Implementation Plan

## Executive Summary

Build a zero-dependency TypeScript CLI tool that integrates with Claude Code via hooks to automatically persist plans, track commits, and provide session continuity across git branches.

---

## README.md Content (First Deliverable)

```markdown
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
│ Claude Code Session │
├─────────────────────────────────────────────────────────────────┤
│ │
│ SessionStart Hook │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 1. Detect current git branch │ │
│ │ 2. Find previous plan for this branch │ │
│ │ 3. Inject plan + commit history as context │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ↓ │
│ You work with Claude... │
│ ↓ │
│ PostToolUse Hook (on git commit) │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Track commit hash → associate with current plan │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ↓ │
│ SessionEnd Hook │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 1. Copy plan to .claude/plans/{branch}.md │ │
│ │ 2. Add metadata: source, timestamp, commits │ │
│ └──────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────┘

````

## Quick Start

```bash
# Install globally
npm install -g claude-plan-tracker

# Initialize in your project
cd your-project
claude-plan-tracker init

# That's it! Start Claude Code as usual
claude
````

## Commands

| Command                      | Description                            |
| ---------------------------- | -------------------------------------- |
| `claude-plan-tracker init`   | Setup hooks in `.claude/settings.json` |
| `claude-plan-tracker status` | Show plan status for current branch    |
| `claude-plan-tracker list`   | List all tracked branches and plans    |
| `claude-plan-tracker sync`   | Manually sync current plan to repo     |

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

## Coming Soon

- [x] Basic plan persistence
- [x] Commit tracking
- [x] Branch-aware context loading
- [ ] Plan diff viewer
- [ ] PR description generation from plans
- [ ] Team plan sharing

## Requirements

- Node.js 18+
- Claude Code CLI
- Git repository

## License

MIT

````

---

## Phase 1: Project Foundation

### 1.1 Initialize TypeScript Project

**Files to create:**
- `package.json` - Project configuration with bin entry
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Standard ignores
- `src/index.ts` - CLI entry point

**package.json structure:**
```json
{
  "name": "claude-plan-tracker",
  "version": "0.1.0",
  "bin": {
    "claude-plan-tracker": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "@types/node": "^20.x"
  }
}
````

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### 1.2 Project Directory Structure

```
claude-plan-tracker/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── cli/
│   │   ├── init.ts           # Init command - setup hooks
│   │   ├── status.ts         # Status command - show current plan
│   │   ├── list.ts           # List command - show all tracked plans
│   │   └── sync.ts           # Sync command - manual sync plans
│   ├── hooks/
│   │   ├── session-start.ts  # SessionStart hook handler
│   │   ├── session-end.ts    # SessionEnd hook handler
│   │   └── post-tool-use.ts  # PostToolUse hook handler (commit detection)
│   ├── lib/
│   │   ├── git-utils.ts      # Git operations (branch, commits)
│   │   ├── claude-storage.ts # Read Claude's internal storage
│   │   ├── plan-store.ts     # Repo plan file management
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── config.ts         # Configuration management
│   └── utils/
│       ├── fs.ts             # File system helpers (promisified)
│       └── path.ts           # Path utilities
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

---

## Phase 2: Core Library Implementation

### 2.1 Type Definitions (`src/lib/types.ts`)

```typescript
// Claude Code Hook Input/Output Types
interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: string;
  // SessionStart specific
  source?: "startup" | "resume" | "clear" | "compact";
  // SessionEnd specific
  reason?: "clear" | "logout" | "prompt_input_exit" | "other";
  // Tool-related (PreToolUse, PostToolUse)
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  tool_use_id?: string;
}

interface HookOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext?: string;
    // Other event-specific fields
  };
}

// Claude's Internal Storage Types
interface ClaudeSession {
  slug: string; // Links to ~/.claude/plans/{slug}.md
  gitBranch: string;
  sessionId: string;
  cwd: string;
  timestamp: string;
}

// Our Plan Tracking Types
interface TrackedPlan {
  branch: string;
  sourceSlug: string;
  lastUpdated: string;
  commits: string[];
  content: string;
}

interface PlanMetadata {
  branch: string;
  source: string;
  last_updated: string;
  commits: string[];
}
```

### 2.2 Git Utilities (`src/lib/git-utils.ts`)

**Functions to implement:**

- `getCurrentBranch(cwd: string): Promise<string>` - Get current git branch
- `getRepoRoot(cwd: string): Promise<string>` - Find git repository root
- `getRecentCommits(cwd: string, count?: number): Promise<string[]>` - Get recent commit hashes
- `getCommitsSince(cwd: string, since: string): Promise<string[]>` - Get commits since timestamp
- `isGitRepo(cwd: string): Promise<boolean>` - Check if directory is in a git repo

**Implementation approach:**

- Use Node.js `child_process.execSync` or `spawn` for git commands
- Parse git output directly (no dependencies)
- Handle errors gracefully (non-git directories)

### 2.3 Claude Storage Reader (`src/lib/claude-storage.ts`)

**Key insight from PLAN.md:** Claude already maintains the mapping between projects, branches, and plans. We just need to read it.

**Functions to implement:**

- `cwdToProjectDir(cwd: string): string` - Convert path to Claude's directory naming
- `getProjectSessionsPath(cwd: string): string` - Get path to project's sessions
- `findSessionsForBranch(cwd: string, branch: string): Promise<ClaudeSession[]>` - Find all sessions for a branch
- `findLatestPlanForBranch(cwd: string, branch: string): Promise<string | null>` - Get most recent plan slug
- `loadPlanContent(slug: string): Promise<string | null>` - Read plan file content
- `getAllProjectSessions(cwd: string): Promise<ClaudeSession[]>` - Get all sessions for project

**Path mapping:**

```
/Users/jansmrcka/git/project → -Users-jansmrcka-git-project

~/.claude/
  plans/{slug}.md
  projects/{cwd-with-slashes-replaced}/
    {uuid}.json  ← Contains: { slug, gitBranch, sessionId, timestamp }
```

### 2.4 Plan Store (`src/lib/plan-store.ts`)

**Functions to implement:**

- `getPlanPath(repoRoot: string, branch: string): string` - Get plan file path in repo
- `savePlan(repoRoot: string, branch: string, content: string, metadata: PlanMetadata): Promise<void>`
- `loadPlan(repoRoot: string, branch: string): Promise<TrackedPlan | null>`
- `listTrackedPlans(repoRoot: string): Promise<TrackedPlan[]>`
- `addCommitToPlan(repoRoot: string, branch: string, commitHash: string): Promise<void>`

**Plan file format in repo:**

```markdown
---
branch: feature/auth
source: jazzy-booping-bentley.md
last_updated: 2026-01-21T14:30:00Z
commits:
  - a1b2c3d
  - e4f5g6h
---

[Original plan content from ~/.claude/plans/]
```

**Storage location:** `.claude/plans/{sanitized-branch-name}.md`

- Branch name sanitization: `feature/auth` → `feature-auth.md`

---

## Phase 3: Hook Implementations

### 3.1 SessionStart Hook (`src/hooks/session-start.ts`)

**Trigger:** When Claude Code starts a new session or resumes

**Input received:**

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/path/to/project",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "source": "startup|resume|clear|compact"
}
```

**Logic:**

1. Read hook input from stdin
2. Get current git branch
3. Find latest plan for this branch from Claude's storage
4. Load plan content
5. Also check for persisted plan in repo (`.claude/plans/{branch}.md`)
6. Return context with plan content + any commit history

**Output:**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Previous plan for branch feature/auth:\n\n[plan content]\n\nCommits made during previous sessions:\n- a1b2c3d: Add login form\n- e4f5g6h: Add validation"
  }
}
```

### 3.2 SessionEnd Hook (`src/hooks/session-end.ts`)

**Trigger:** When Claude Code session ends

**Input received:**

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/path/to/project",
  "permission_mode": "default",
  "hook_event_name": "SessionEnd",
  "reason": "clear|logout|prompt_input_exit|other"
}
```

**Logic:**

1. Read hook input from stdin
2. Get current git branch and repo root
3. Find the plan slug from current session (read from transcript path or session data)
4. Load plan content from `~/.claude/plans/{slug}.md`
5. Get commits made since session start (or since last sync)
6. Save plan to repo: `.claude/plans/{branch}.md` with metadata

**Output:**

```json
{
  "continue": true
}
```

(SessionEnd doesn't need to return context, just complete successfully)

### 3.3 PostToolUse Hook (`src/hooks/post-tool-use.ts`)

**Trigger:** After Bash tool completes (matcher: `Bash`)

**Purpose:** Detect git commits made during session

**Input received:**

```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "git commit -m \"Add feature\""
  },
  "tool_response": { ... }
}
```

**Logic:**

1. Read hook input from stdin
2. Check if command contains `git commit`
3. If commit detected:
   - Get the new commit hash (`git rev-parse HEAD`)
   - Update the plan file in repo with new commit
4. Return minimal output (no context injection needed)

**Commit detection patterns:**

- `git commit`
- `git commit -m`
- `git commit -am`
- `git merge --no-ff`

---

## Phase 4: CLI Commands

### 4.1 CLI Entry Point (`src/index.ts`)

**Implementation:**

- Parse command line arguments manually (no dependencies)
- Route to appropriate command handler
- Handle `--help` and `--version` flags

```typescript
const [, , command, ...args] = process.argv;

switch (command) {
  case "init":
    await initCommand(args);
    break;
  case "status":
    await statusCommand(args);
    break;
  case "list":
    await listCommand(args);
    break;
  case "sync":
    await syncCommand(args);
    break;
  default:
    showHelp();
}
```

### 4.2 Init Command (`src/cli/init.ts`)

**Purpose:** Add hooks configuration to `.claude/settings.json`

**Logic:**

1. Find or create `.claude/settings.json` in current directory
2. Add hooks configuration:
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
3. Create `.claude/plans/` directory if it doesn't exist
4. Optionally add `.claude/plans/` to `.gitignore` (or not, based on user preference)

**Output:** Success message with instructions

### 4.3 Status Command (`src/cli/status.ts`)

**Purpose:** Show plan status for current branch

**Logic:**

1. Get current git branch
2. Load plan from repo (`.claude/plans/{branch}.md`)
3. Load plan from Claude storage (latest for this branch)
4. Display comparison:
   - Plan exists in repo?
   - Plan exists in Claude storage?
   - Are they in sync?
   - Commits tracked

**Output:**

```
Branch: feature/auth
Plan Status: Tracked

Repo Plan:
  Source: jazzy-booping-bentley.md
  Last Updated: 2026-01-21T14:30:00Z
  Commits: 3 (a1b2c3d, e4f5g6h, i7j8k9l)

Claude Storage:
  Latest Plan: jazzy-booping-bentley.md
  Sessions: 5

[Plan content preview - first 500 chars]
```

### 4.4 List Command (`src/cli/list.ts`)

**Purpose:** List all tracked branches and their plans

**Logic:**

1. Find all plan files in `.claude/plans/`
2. Parse metadata from each
3. Display summary table

**Output:**

```
Tracked Plans:
┌────────────────────┬─────────────────────────┬─────────────────────────┬─────────┐
│ Branch             │ Source                  │ Last Updated            │ Commits │
├────────────────────┼─────────────────────────┼─────────────────────────┼─────────┤
│ feature/auth       │ jazzy-booping-bentley   │ 2026-01-21T14:30:00Z   │ 3       │
│ feature/dashboard  │ happy-tickling-cookie   │ 2026-01-20T10:15:00Z   │ 7       │
│ bugfix/login       │ sunny-dancing-penguin   │ 2026-01-19T09:00:00Z   │ 2       │
└────────────────────┴─────────────────────────┴─────────────────────────┴─────────┘
```

### 4.5 Sync Command (`src/cli/sync.ts`)

**Purpose:** Manually sync current plan to repo

**Logic:**

1. Get current git branch
2. Find latest plan from Claude storage for this branch
3. Copy plan to repo with metadata
4. Report changes

**Options:**

- `--all` - Sync all branches with known plans
- `--force` - Overwrite even if repo version is newer

---

## Phase 5: Testing & Quality

### 5.1 Unit Tests

**Test files to create:**

- `src/lib/__tests__/git-utils.test.ts`
- `src/lib/__tests__/claude-storage.test.ts`
- `src/lib/__tests__/plan-store.test.ts`
- `src/hooks/__tests__/session-start.test.ts`

**Testing approach:**

- Use Node.js built-in `node:test` (no external test framework)
- Mock file system operations
- Create temp directories for integration tests

### 5.2 Integration Tests

**Scenarios to test:**

1. Full workflow: init → session start → work → commit → session end
2. Branch switching: start on branch A, switch to B, verify correct plan loaded
3. Plan conflict resolution: Claude plan newer vs repo plan newer

### 5.3 Manual Testing Checklist

1. Run `claude-plan-tracker init` in a project
2. Start Claude Code session, verify plan context injected
3. Make commits, verify they're tracked
4. End session, verify plan persisted to repo
5. Start new session, verify previous plan/commits loaded

---

## Phase 6: Documentation & Polish

### 6.1 README.md

**Sections:**

- Installation (`npm install -g claude-plan-tracker`)
- Quick Start (init, start using)
- How It Works (diagram of data flow)
- Commands Reference
- Configuration
- Troubleshooting

### 6.2 Error Handling

**Graceful degradation:**

- If not in git repo → warn but continue (plans still tracked by cwd)
- If Claude storage unreadable → skip context injection, don't crash
- If plan file corrupted → start fresh, log warning

**Error messages:**

- Clear, actionable messages
- Include relevant file paths
- Suggest fixes

---

## Phase 7: Future Enhancements (Post-MVP)

### 7.1 Plan Diffing

- Show diff between current and previous plan versions
- Track plan evolution over time

### 7.2 Commit Message Enhancement

- Optionally inject plan reference into commit messages
- `[plan:jazzy-booping-bentley] Add login form`

### 7.3 PR Integration

- Generate PR description from plan
- Link commits to plan sections

### 7.4 Team Sharing

- Optional: push plans to remote (separate branch or separate file)
- Team members can see AI-assisted work context

### 7.5 Analytics

- Track planning patterns
- Session duration vs commits correlation
- Plan completion rates

---

## Implementation Order

**Week 1: Foundation**

1. Project setup (package.json, tsconfig.json)
2. Types definition
3. Git utilities
4. Claude storage reader

**Week 2: Core Features** 5. Plan store 6. SessionStart hook 7. SessionEnd hook 8. PostToolUse hook

**Week 3: CLI & Testing** 9. CLI entry point 10. Init command 11. Status command 12. List command 13. Sync command 14. Unit tests

**Week 4: Polish** 15. Integration tests 16. Error handling improvements 17. Documentation 18. npm publish preparation

---

## Verification Plan

### How to Test the Implementation

1. **Build and install locally:**

   ```bash
   npm run build
   npm link
   ```

2. **Initialize in a test project:**

   ```bash
   cd /path/to/test-project
   claude-plan-tracker init
   ```

3. **Verify hooks configuration:**

   ```bash
   cat .claude/settings.json
   # Should show hooks configuration
   ```

4. **Start Claude Code session:**

   ```bash
   claude
   # Should see plan context if previous plan exists
   ```

5. **Make a commit during session:**

   ```bash
   # In Claude: ask to create a file and commit it
   # Commit should be tracked
   ```

6. **End session and verify persistence:**

   ```bash
   # Exit Claude Code
   cat .claude/plans/*.md
   # Should see plan with commit history
   ```

7. **Test status and list commands:**
   ```bash
   claude-plan-tracker status
   claude-plan-tracker list
   ```

---

## Critical Files Summary

| File                         | Purpose                                       |
| ---------------------------- | --------------------------------------------- |
| `src/lib/types.ts`           | TypeScript interfaces for all data structures |
| `src/lib/claude-storage.ts`  | Read Claude's internal plan/session data      |
| `src/lib/plan-store.ts`      | Persist plans to repo                         |
| `src/hooks/session-start.ts` | Inject previous plan context                  |
| `src/hooks/session-end.ts`   | Save plan to repo                             |
| `src/cli/init.ts`            | Setup hooks configuration                     |
