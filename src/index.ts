#!/usr/bin/env node

import { parseArgs } from './utils/args.js';
import { initCommand } from './cli/init.js';
import { statusCommand } from './cli/status.js';
import { listCommand } from './cli/list.js';
import { syncCommand } from './cli/sync.js';
import { runHook } from './hooks/index.js';

const VERSION = '0.1.0';

const HELP = `
claude-plan-tracker - Persist Claude Code plans across sessions

Usage:
  claude-plan-tracker <command> [options]

Commands:
  init          Setup hooks in .claude/settings.json
  status        Show plan status for current branch
  list          List all tracked branches and plans
  sync          Manually sync current plan to repo
  hook <name>   Run a hook (used internally by Claude Code)

Options:
  --help, -h    Show this help message
  --version     Show version number

Examples:
  claude-plan-tracker init
  claude-plan-tracker status
  claude-plan-tracker list
`;

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv.slice(2));

  if (flags.help || flags.h) {
    console.log(HELP);
    process.exit(0);
  }

  if (flags.version) {
    console.log(VERSION);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'init':
        await initCommand();
        break;
      case 'status':
        await statusCommand();
        break;
      case 'list':
        await listCommand();
        break;
      case 'sync':
        await syncCommand(flags);
        break;
      case 'hook':
        await runHook(args[0]);
        break;
      case 'help':
        console.log(HELP);
        break;
      case 'version':
        console.log(VERSION);
        break;
      default:
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
