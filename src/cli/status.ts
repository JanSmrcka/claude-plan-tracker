import { getCurrentBranch, getRepoRoot } from '../lib/git-utils.js';
import { findLatestPlanForBranch, loadPlanContent } from '../lib/claude-storage.js';
import { loadPlan } from '../lib/plan-store.js';

export async function statusCommand(): Promise<void> {
  const cwd = process.cwd();

  // Get git info
  let branch: string;
  let repoRoot: string;
  try {
    branch = await getCurrentBranch(cwd);
    repoRoot = await getRepoRoot(cwd);
  } catch {
    console.log('Not in a git repository.');
    return;
  }

  console.log(`Branch: ${branch}`);
  console.log('');

  // Check repo plan
  const repoPlan = await loadPlan(repoRoot, branch);
  if (repoPlan) {
    console.log('Repo Plan:');
    console.log(`  Source: ${repoPlan.metadata.source}`);
    console.log(`  Last Updated: ${repoPlan.metadata.last_updated}`);
    console.log(`  Commits: ${repoPlan.metadata.commits.length} tracked`);
    if (repoPlan.metadata.commits.length > 0) {
      console.log(`    ${repoPlan.metadata.commits.slice(0, 5).join(', ')}${repoPlan.metadata.commits.length > 5 ? '...' : ''}`);
    }
    console.log('');
  } else {
    console.log('Repo Plan: None');
    console.log('');
  }

  // Check Claude storage
  const claudeSlug = await findLatestPlanForBranch(cwd, branch);
  if (claudeSlug) {
    const claudePlan = await loadPlanContent(claudeSlug);
    console.log('Claude Storage:');
    console.log(`  Latest Plan: ${claudeSlug}.md`);
    if (claudePlan) {
      const preview = claudePlan.slice(0, 200).replace(/\n/g, ' ');
      console.log(`  Preview: ${preview}${claudePlan.length > 200 ? '...' : ''}`);
    }
  } else {
    console.log('Claude Storage: No plan found for this branch');
  }
}
