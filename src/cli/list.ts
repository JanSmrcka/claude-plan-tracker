import { getRepoRoot } from '../lib/git-utils.js';
import { listTrackedPlans } from '../lib/plan-store.js';

export async function listCommand(): Promise<void> {
  const cwd = process.cwd();

  let repoRoot: string;
  try {
    repoRoot = await getRepoRoot(cwd);
  } catch {
    console.log('Not in a git repository.');
    return;
  }

  const plans = await listTrackedPlans(repoRoot);

  if (plans.length === 0) {
    console.log('No tracked plans found.');
    console.log('');
    console.log('Run "claude-plan-tracker init" to set up plan tracking.');
    return;
  }

  console.log('Tracked Plans:');
  console.log('');

  // Header
  const cols = {
    branch: 20,
    source: 25,
    updated: 20,
    commits: 8,
  };

  const header = [
    'Branch'.padEnd(cols.branch),
    'Source'.padEnd(cols.source),
    'Last Updated'.padEnd(cols.updated),
    'Commits'.padEnd(cols.commits),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const plan of plans) {
    const row = [
      plan.metadata.branch.slice(0, cols.branch).padEnd(cols.branch),
      plan.metadata.source.slice(0, cols.source).padEnd(cols.source),
      plan.metadata.last_updated.slice(0, cols.updated).padEnd(cols.updated),
      String(plan.metadata.commits.length).padEnd(cols.commits),
    ].join(' | ');

    console.log(row);
  }
}
