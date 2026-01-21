import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ClaudeSession } from './types.js';

/**
 * Convert cwd path to Claude's project directory naming convention
 * /Users/jansmrcka/git/project → -Users-jansmrcka-git-project
 */
export function cwdToProjectDir(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

/**
 * Get path to Claude's project sessions directory
 */
export function getProjectSessionsPath(cwd: string): string {
  const projectDir = cwdToProjectDir(cwd);
  return path.join(os.homedir(), '.claude', 'projects', projectDir);
}

/**
 * Get path to Claude's plans directory
 */
export function getPlansPath(): string {
  return path.join(os.homedir(), '.claude', 'plans');
}

/**
 * Find all sessions for a specific branch
 */
export async function findSessionsForBranch(
  cwd: string,
  branch: string
): Promise<ClaudeSession[]> {
  const sessionsPath = getProjectSessionsPath(cwd);
  const sessions: ClaudeSession[] = [];

  try {
    const files = await fs.readdir(sessionsPath);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('agent-'));

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(sessionsPath, file), 'utf-8');
        const data = JSON.parse(content) as Partial<ClaudeSession>;

        if (data.gitBranch === branch && data.slug) {
          sessions.push(data as ClaudeSession);
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist
  }

  // Sort by timestamp, newest first
  return sessions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Find the latest plan slug for a branch
 */
export async function findLatestPlanForBranch(
  cwd: string,
  branch: string
): Promise<string | null> {
  const sessions = await findSessionsForBranch(cwd, branch);
  return sessions[0]?.slug || null;
}

/**
 * Load plan content from Claude's plans directory
 */
export async function loadPlanContent(slug: string): Promise<string | null> {
  const planPath = path.join(getPlansPath(), `${slug}.md`);
  try {
    return await fs.readFile(planPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Get all sessions for a project
 */
export async function getAllProjectSessions(cwd: string): Promise<ClaudeSession[]> {
  const sessionsPath = getProjectSessionsPath(cwd);
  const sessions: ClaudeSession[] = [];

  try {
    const files = await fs.readdir(sessionsPath);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('agent-'));

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(sessionsPath, file), 'utf-8');
        const data = JSON.parse(content) as Partial<ClaudeSession>;

        if (data.slug && data.gitBranch) {
          sessions.push(data as ClaudeSession);
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return sessions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
