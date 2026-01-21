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
 * JSONL entry structure (partial - only fields we care about)
 */
interface JsonlEntry {
  slug?: string;
  gitBranch?: string;
  sessionId?: string;
  cwd?: string;
  timestamp?: string;
  type?: string;
}

/**
 * Extract session info from a JSONL file for a specific branch
 * Reads the file and finds entries with slug matching the target branch
 */
async function extractSessionFromJsonl(
  filePath: string,
  targetBranch?: string
): Promise<ClaudeSession | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // Find entry with slug and gitBranch (optionally matching target branch)
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as JsonlEntry;
        if (entry.slug && entry.gitBranch) {
          // If targetBranch specified, only match that branch
          if (targetBranch && entry.gitBranch !== targetBranch) {
            continue;
          }
          return {
            slug: entry.slug,
            gitBranch: entry.gitBranch,
            sessionId: entry.sessionId || '',
            cwd: entry.cwd || '',
            timestamp: entry.timestamp || new Date().toISOString(),
          };
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // File read error
  }
  return null;
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
    // Look for .jsonl files (transcript files)
    const jsonlFiles = files.filter((f: string) => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const session = await extractSessionFromJsonl(path.join(sessionsPath, file), branch);
      if (session) {
        sessions.push(session);
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
    const jsonlFiles = files.filter((f: string) => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const session = await extractSessionFromJsonl(path.join(sessionsPath, file));
      if (session) {
        sessions.push(session);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return sessions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
