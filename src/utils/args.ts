import type { CLIArgs, Command } from '../lib/types.js';

const VALID_COMMANDS: Command[] = ['init', 'status', 'list', 'sync', 'hook', 'help', 'version'];

export function parseArgs(argv: string[]): CLIArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      flags[key] = true;
    } else {
      positional.push(arg);
    }
  }

  const commandStr = positional[0] || 'help';
  const command: Command = VALID_COMMANDS.includes(commandStr as Command)
    ? (commandStr as Command)
    : 'help';

  return {
    command,
    args: positional.slice(1),
    flags,
  };
}
