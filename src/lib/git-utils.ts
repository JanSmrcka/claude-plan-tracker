import { execSync } from 'node:child_process';

export async function getCurrentBranch(cwd: string): Promise<string> {
  const result = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd,
    encoding: 'utf-8',
  });
  return result.trim();
}

export async function getRepoRoot(cwd: string): Promise<string> {
  const result = execSync('git rev-parse --show-toplevel', {
    cwd,
    encoding: 'utf-8',
  });
  return result.trim();
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    execSync('git rev-parse --git-dir', { cwd, encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

export async function getRecentCommits(cwd: string, count = 10): Promise<string[]> {
  try {
    const result = execSync(`git log --format=%H -n ${count}`, {
      cwd,
      encoding: 'utf-8',
    });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export async function getLatestCommit(cwd: string): Promise<string | null> {
  try {
    const result = execSync('git rev-parse HEAD', {
      cwd,
      encoding: 'utf-8',
    });
    return result.trim();
  } catch {
    return null;
  }
}
