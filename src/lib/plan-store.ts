import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { PlanMetadata, TrackedPlan } from './types.js';

/**
 * Sanitize branch name for use as filename
 * feature/auth → feature-auth
 */
function sanitizeBranchName(branch: string): string {
  return branch.replace(/\//g, '-');
}

/**
 * Get path to plan file in repo
 */
export function getPlanPath(repoRoot: string, branch: string): string {
  const filename = `${sanitizeBranchName(branch)}.md`;
  return path.join(repoRoot, '.claude', 'plans', filename);
}

/**
 * Parse frontmatter from plan content
 */
function parseFrontmatter(content: string): { metadata: PlanMetadata | null; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: null, content };
  }

  const [, frontmatterStr, bodyContent] = match;

  try {
    // Simple YAML parsing for our specific format
    const metadata: Partial<PlanMetadata> = {};
    const lines = frontmatterStr.split('\n');
    let inCommits = false;
    const commits: string[] = [];

    for (const line of lines) {
      if (line.startsWith('branch:')) {
        metadata.branch = line.slice(7).trim();
      } else if (line.startsWith('source:')) {
        metadata.source = line.slice(7).trim();
      } else if (line.startsWith('last_updated:')) {
        metadata.last_updated = line.slice(13).trim();
      } else if (line.startsWith('commits:')) {
        inCommits = true;
      } else if (inCommits && line.trim().startsWith('-')) {
        commits.push(line.trim().slice(1).trim());
      }
    }

    metadata.commits = commits;

    return {
      metadata: metadata as PlanMetadata,
      content: bodyContent.trim(),
    };
  } catch {
    return { metadata: null, content };
  }
}

/**
 * Generate frontmatter string
 */
function generateFrontmatter(metadata: PlanMetadata): string {
  const lines = [
    '---',
    `branch: ${metadata.branch}`,
    `source: ${metadata.source}`,
    `last_updated: ${metadata.last_updated}`,
    'commits:',
    ...metadata.commits.map(c => `  - ${c}`),
    '---',
  ];
  return lines.join('\n');
}

/**
 * Save plan to repo
 */
export async function savePlan(
  repoRoot: string,
  branch: string,
  content: string,
  metadata: PlanMetadata
): Promise<void> {
  const planPath = getPlanPath(repoRoot, branch);
  const planDir = path.dirname(planPath);

  await fs.mkdir(planDir, { recursive: true });

  const fullContent = `${generateFrontmatter(metadata)}\n\n${content}`;
  await fs.writeFile(planPath, fullContent);
}

/**
 * Load plan from repo
 */
export async function loadPlan(
  repoRoot: string,
  branch: string
): Promise<TrackedPlan | null> {
  const planPath = getPlanPath(repoRoot, branch);

  try {
    const content = await fs.readFile(planPath, 'utf-8');
    const { metadata, content: planContent } = parseFrontmatter(content);

    if (!metadata) {
      return null;
    }

    return {
      metadata,
      content: planContent,
    };
  } catch {
    return null;
  }
}

/**
 * List all tracked plans in repo
 */
export async function listTrackedPlans(repoRoot: string): Promise<TrackedPlan[]> {
  const plansDir = path.join(repoRoot, '.claude', 'plans');
  const plans: TrackedPlan[] = [];

  try {
    const files = await fs.readdir(plansDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    for (const file of mdFiles) {
      try {
        const content = await fs.readFile(path.join(plansDir, file), 'utf-8');
        const { metadata, content: planContent } = parseFrontmatter(content);

        if (metadata) {
          plans.push({ metadata, content: planContent });
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return plans.sort((a, b) =>
    new Date(b.metadata.last_updated).getTime() - new Date(a.metadata.last_updated).getTime()
  );
}

/**
 * Add commit to plan
 */
export async function addCommitToPlan(
  repoRoot: string,
  branch: string,
  commitHash: string
): Promise<void> {
  const existing = await loadPlan(repoRoot, branch);

  if (!existing) {
    return;
  }

  if (!existing.metadata.commits.includes(commitHash)) {
    existing.metadata.commits.push(commitHash);
    existing.metadata.last_updated = new Date().toISOString();
    await savePlan(repoRoot, branch, existing.content, existing.metadata);
  }
}
