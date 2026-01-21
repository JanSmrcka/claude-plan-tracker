# Project: claude-plan-tracker

## Goal

Build an open-source CLI tool that integrates with Claude Code via hooks to:

1. Automatically persist plans from `~/.claude/plans/` into the repository (`.claude/plans/{branch}.md`)
2. Create a mapping between git branches and Claude's randomly-named plan files
3. On session start, provide Claude with context from previous sessions on the same branch
4. Track which commits were made during which planning session

## Problem being solved

- Claude Code stores plans in `~/.claude/plans/` with random names like `happy-tickling-cookie.md`
- No connection between plans and git branches/PRs
- After context overflow or new session, developer loses continuity
- No audit trail: which plan led to which commits

## Claude Code internal storage structure

Claude already maintains mapping between projects, branches, and plans internally:

```
~/.claude/
  plans/
    {slug}.md                              # e.g. jazzy-booping-bentley.md
  projects/
    {cwd-with-slashes-replaced}/           # e.g. -Users-jansmrcka-git-project
      {session-id}.jsonl                   # transcript
      agent-{id}.jsonl                     # agent data
      {uuid}.json                          # session metadata
```

### Project directory naming

Claude converts cwd path to directory name by replacing `/` with `-`:

```
/Users/jansmrcka/git/private/projects/hair-slam
                    ↓
-Users-jansmrcka-git-private-projects-hair-slam
```

### Session JSON structure

Each session JSON contains:

```typescript
interface SessionData {
  slug: string; // "jazzy-booping-bentley" → links to plans/{slug}.md
  gitBranch: string; // "master", "feature/auth"
  sessionId: string; // UUID
  cwd: string; // full project path
  timestamp: string; // ISO date
  // ... other fields
}
```

**Key insight:** We don't need our own mapping — we can aggregate Claude's existing session data to find which plan belongs to which branch.

## Technical approach

### Hooks to implement

1. **SessionStart** - Detect branch, find latest plan from Claude's session data, return as feedback
2. **PostToolUse** (matcher: `Bash`) - Detect git commits, link to current plan
3. **SessionEnd** - Copy active plan to repo with branch name

### Key files

```
src/
  hooks/
    session-start.ts
    session-end.ts
    post-tool-use.ts
  lib/
    git-utils.ts      # getBranch, getRecentCommits
    claude-storage.ts # read Claude's internal storage
    plan-store.ts     # save plans to repo
  cli/
    init.ts           # setup hooks in .claude/settings.json
    status.ts         # show current plan for branch
```

### Core functions

```typescript
// Convert cwd to Claude's project directory name
function cwdToProjectDir(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

// Find latest plan slug for a branch
async function findPlanForBranch(
  cwd: string,
  branch: string,
): Promise<string | null> {
  const projectDir = cwdToProjectDir(cwd);
  const sessionsPath = path.join(
    os.homedir(),
    ".claude",
    "projects",
    projectDir,
  );

  const files = await fs.readdir(sessionsPath);
  let latestSlug: string | null = null;
  let latestTime = 0;

  for (const file of files.filter((f) => f.endsWith(".json"))) {
    const data = JSON.parse(
      await fs.readFile(path.join(sessionsPath, file), "utf-8"),
    );
    if (data.gitBranch === branch && data.slug) {
      const time = new Date(data.timestamp).getTime();
      if (time > latestTime) {
        latestTime = time;
        latestSlug = data.slug;
      }
    }
  }

  return latestSlug;
}

// Load plan content
async function loadPlan(slug: string): Promise<string | null> {
  const planPath = path.join(os.homedir(), ".claude", "plans", `${slug}.md`);
  try {
    return await fs.readFile(planPath, "utf-8");
  } catch {
    return null;
  }
}
```

### Data structures

Plan file in repo (`.claude/plans/feature-auth.md`):

```markdown
---
branch: feature/auth
source: jazzy-booping-bentley.md
last_updated: 2026-01-21T14:30:00Z
commits: [a1b2c3d, e4f5g6h]
---

[original plan content from ~/.claude/plans/]
```

## Hook I/O format

Input (stdin JSON):

```typescript
interface HookInput {
  session_id: string;
  transcript_path: string; // ~/.claude/projects/.../xxx.jsonl
  cwd: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: { file_path?: string; command?: string };
}
```

Output (stdout JSON):

```typescript
interface HookOutput {
  feedback?: string; // Message injected into Claude's context
  continue?: boolean;
}
```

## Documentation

- Hooks reference: https://docs.anthropic.com/en/docs/claude-code/hooks
- Hooks guide: https://docs.anthropic.com/en/docs/claude-code/hooks-guide

## Tech stack

- TypeScript
- Node.js (no external runtime deps)
- tsx for running TS directly

## Commands to implement

```bash
claude-plan-tracker init     # Add hooks to .claude/settings.json
claude-plan-tracker status   # Show plan for current branch
claude-plan-tracker list     # List all tracked branches/plans
```

## Constraints

- Zero runtime dependencies beyond Node.js
- Must work with Claude Code hooks API
- Plans in repo should be human-readable markdown
- Don't modify Claude's original plan files in ~/.claude/plans/

## First task

Start by implementing the basic project structure and the `init` command that adds hooks configuration to `.claude/settings.json`.
