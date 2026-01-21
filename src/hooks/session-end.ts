import type { SessionEndInput } from '../lib/types.js';
import { getCurrentBranch, getRepoRoot } from '../lib/git-utils.js';
import { findLatestPlanForBranch, loadPlanContent } from '../lib/claude-storage.js';
import { savePlan, loadPlan } from '../lib/plan-store.js';

export async function sessionEndHook(): Promise<void> {
  // Read input from stdin
  const stdin = await readStdin();
  if (!stdin) {
    process.exit(0);
    return;
  }

  let input: SessionEndInput;
  try {
    input = JSON.parse(stdin);
  } catch {
    process.exit(0);
    return;
  }

  const { cwd } = input;

  // Get current branch and repo root
  const branch = await getCurrentBranch(cwd).catch(() => null);
  const repoRoot = await getRepoRoot(cwd).catch(() => null);

  if (!branch || !repoRoot) {
    process.exit(0);
    return;
  }

  // Find latest plan from Claude storage
  const slug = await findLatestPlanForBranch(cwd, branch);
  if (!slug) {
    process.exit(0);
    return;
  }

  const content = await loadPlanContent(slug);
  if (!content) {
    process.exit(0);
    return;
  }

  // Load existing plan to preserve commits
  const existingPlan = await loadPlan(repoRoot, branch);
  const commits = existingPlan?.metadata.commits || [];

  // Save plan to repo
  await savePlan(repoRoot, branch, content, {
    branch,
    source: `${slug}.md`,
    last_updated: new Date().toISOString(),
    commits,
  });

  process.exit(0);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));

    setTimeout(() => resolve(data), 1000);
  });
}
