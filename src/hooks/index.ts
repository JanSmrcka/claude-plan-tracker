import { sessionStartHook } from './session-start.js';
import { sessionEndHook } from './session-end.js';
import { postToolUseHook } from './post-tool-use.js';

export async function runHook(hookName: string): Promise<void> {
  switch (hookName) {
    case 'session-start':
      await sessionStartHook();
      break;
    case 'session-end':
      await sessionEndHook();
      break;
    case 'post-tool-use':
      await postToolUseHook();
      break;
    default:
      console.error(`Unknown hook: ${hookName}`);
      process.exit(1);
  }
}
