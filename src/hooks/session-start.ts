import { readFileSync } from 'fs';
import type { SessionStartInput } from '../lib/types.js';
import { getCurrentBranch, getRepoRoot } from '../lib/git-utils.js';
import { findLatestPlanForBranch, loadPlanContent } from '../lib/claude-storage.js';
import { loadPlan } from '../lib/plan-store.js';

export async function sessionStartHook(): Promise<void> {
  // Read input from stdin (synchronous for reliability with npx)
  const stdin = readStdinSync();
  if (!stdin) {
    process.exit(0);
  }

  let input: SessionStartInput;
  try {
    input = JSON.parse(stdin);
  } catch {
    process.exit(0);
    return; // TypeScript flow control
  }

  const { cwd } = input;

  // Get current branch
  const branch = await getCurrentBranch(cwd).catch(() => null);
  const repoRoot = await getRepoRoot(cwd).catch(() => null);

  if (!branch || !repoRoot) {
    process.exit(0);
    return;
  }

  // Build context from previous plans
  const contextParts: string[] = [];

  // Check repo plan first
  const repoPlan = await loadPlan(repoRoot, branch);
  if (repoPlan) {
    contextParts.push(`## Previous Plan for branch "${branch}"`);
    contextParts.push('');
    contextParts.push(repoPlan.content);

    if (repoPlan.metadata.commits.length > 0) {
      contextParts.push('');
      contextParts.push('### Commits from previous sessions:');
      for (const commit of repoPlan.metadata.commits.slice(0, 10)) {
        contextParts.push(`- ${commit}`);
      }
    }
  } else {
    // Try Claude storage
    const slug = await findLatestPlanForBranch(cwd, branch);
    if (slug) {
      const content = await loadPlanContent(slug);
      if (content) {
        contextParts.push(`## Previous Plan for branch "${branch}"`);
        contextParts.push(`(Source: ${slug}.md)`);
        contextParts.push('');
        contextParts.push(content);
      }
    }
  }

  // Output context if we found anything
  // Use plain text output - Claude Code adds it directly to context
  if (contextParts.length > 0) {
    console.log(contextParts.join('\n'));
  }

  process.exit(0);
}

function readStdinSync(): string {
  try {
    // Use synchronous read from file descriptor 0 (stdin)
    // This is more reliable than event-based reading for piped data
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}
