import { getCurrentBranch, getRepoRoot } from '../lib/git-utils.js';
import { findLatestPlanForBranch, loadPlanContent } from '../lib/claude-storage.js';
import { savePlan, loadPlan } from '../lib/plan-store.js';

interface SyncFlags {
  force?: boolean;
  all?: boolean;
  [key: string]: string | boolean | undefined;
}

export async function syncCommand(flags: SyncFlags): Promise<void> {
  const cwd = process.cwd();

  let branch: string;
  let repoRoot: string;
  try {
    branch = await getCurrentBranch(cwd);
    repoRoot = await getRepoRoot(cwd);
  } catch {
    console.log('Not in a git repository.');
    return;
  }

  console.log(`Syncing plan for branch: ${branch}`);

  // Find latest plan from Claude storage
  const slug = await findLatestPlanForBranch(cwd, branch);
  if (!slug) {
    console.log('No plan found in Claude storage for this branch.');
    return;
  }

  const content = await loadPlanContent(slug);
  if (!content) {
    console.log(`Could not load plan content: ${slug}.md`);
    return;
  }

  // Check existing repo plan
  const existingPlan = await loadPlan(repoRoot, branch);
  if (existingPlan && !flags.force) {
    const existingDate = new Date(existingPlan.metadata.last_updated);
    const now = new Date();
    if (now.getTime() - existingDate.getTime() < 60000) {
      console.log('Repo plan was updated less than a minute ago. Use --force to override.');
      return;
    }
  }

  // Save to repo
  await savePlan(repoRoot, branch, content, {
    branch,
    source: `${slug}.md`,
    last_updated: new Date().toISOString(),
    commits: existingPlan?.metadata.commits || [],
  });

  console.log(`Plan synced to .claude/plans/`);
  console.log(`  Source: ${slug}.md`);
}
