import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ClaudeSettings, HookMatcher } from '../lib/types.js';

const HOOKS_CONFIG: Record<string, HookMatcher[]> = {
  SessionStart: [
    {
      hooks: [
        {
          type: 'command',
          command: 'npx claude-plan-tracker hook session-start',
        },
      ],
    },
  ],
  SessionEnd: [
    {
      hooks: [
        {
          type: 'command',
          command: 'npx claude-plan-tracker hook session-end',
        },
      ],
    },
  ],
  PostToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: 'npx claude-plan-tracker hook post-tool-use',
        },
      ],
    },
  ],
};

export async function initCommand(): Promise<void> {
  const cwd = process.cwd();
  const claudeDir = path.join(cwd, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const plansDir = path.join(claudeDir, 'plans');

  // Create .claude directory if it doesn't exist
  await fs.mkdir(claudeDir, { recursive: true });
  await fs.mkdir(plansDir, { recursive: true });

  // Load existing settings or create new
  let settings: ClaudeSettings = {};
  try {
    const existing = await fs.readFile(settingsPath, 'utf-8');
    settings = JSON.parse(existing);
  } catch {
    // File doesn't exist, start fresh
  }

  // Merge hooks configuration
  settings.hooks = {
    ...settings.hooks,
    ...HOOKS_CONFIG,
  };

  // Write settings
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  console.log('Claude Plan Tracker initialized successfully!');
  console.log('');
  console.log('Created:');
  console.log(`  ${settingsPath}`);
  console.log(`  ${plansDir}/`);
  console.log('');
  console.log('Hooks configured:');
  console.log('  - SessionStart: Load previous plan context');
  console.log('  - SessionEnd: Persist plan to repo');
  console.log('  - PostToolUse: Track git commits');
  console.log('');
  console.log('Start a new Claude Code session to begin tracking plans.');
}
