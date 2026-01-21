import { readFileSync } from 'fs';
import type { PostToolUseInput } from '../lib/types.js';
import { getCurrentBranch, getRepoRoot, getLatestCommit } from '../lib/git-utils.js';
import { addCommitToPlan } from '../lib/plan-store.js';

export async function postToolUseHook(): Promise<void> {
  // Read input from stdin (synchronous for reliability)
  const stdin = readStdinSync();
  if (!stdin) {
    process.exit(0);
    return;
  }

  let input: PostToolUseInput;
  try {
    input = JSON.parse(stdin);
  } catch {
    process.exit(0);
    return;
  }

  const { cwd, tool_name, tool_input } = input;

  // Only process Bash commands
  if (tool_name !== 'Bash') {
    process.exit(0);
    return;
  }

  // Check if this was a git commit
  const command = (tool_input as { command?: string }).command || '';
  if (!isGitCommit(command)) {
    process.exit(0);
    return;
  }

  // Get branch and repo info
  const branch = await getCurrentBranch(cwd).catch(() => null);
  const repoRoot = await getRepoRoot(cwd).catch(() => null);

  if (!branch || !repoRoot) {
    process.exit(0);
    return;
  }

  // Get the latest commit hash
  const commitHash = await getLatestCommit(cwd);
  if (!commitHash) {
    process.exit(0);
    return;
  }

  // Add commit to plan tracking
  await addCommitToPlan(repoRoot, branch, commitHash.slice(0, 7));

  process.exit(0);
}

function isGitCommit(command: string): boolean {
  const commitPatterns = [
    /git\s+commit/,
    /git\s+merge\s+--no-ff/,
  ];
  return commitPatterns.some(pattern => pattern.test(command));
}

function readStdinSync(): string {
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}
