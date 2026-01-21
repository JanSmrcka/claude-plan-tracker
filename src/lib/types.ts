/**
 * Claude Code Hook Input/Output Types
 */

// Base hook input that all hooks receive
export interface HookInputBase {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions';
  hook_event_name: string;
}

// SessionStart hook input
export interface SessionStartInput extends HookInputBase {
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact';
}

// SessionEnd hook input
export interface SessionEndInput extends HookInputBase {
  hook_event_name: 'SessionEnd';
  reason: 'clear' | 'logout' | 'prompt_input_exit' | 'other';
}

// PostToolUse hook input
export interface PostToolUseInput extends HookInputBase {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: Record<string, unknown>;
  tool_use_id: string;
}

// Union type for all hook inputs
export type HookInput = SessionStartInput | SessionEndInput | PostToolUseInput;

// Hook output structure
export interface HookOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext?: string;
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
  };
}

/**
 * Claude's Internal Storage Types
 */

// Session JSON structure from ~/.claude/projects/{project}/{uuid}.json
export interface ClaudeSession {
  slug: string;           // Links to ~/.claude/plans/{slug}.md
  gitBranch: string;      // e.g., "master", "feature/auth"
  sessionId: string;      // UUID
  cwd: string;            // Full project path
  timestamp: string;      // ISO date string
}

/**
 * Plan Tracking Types
 */

// Metadata stored in plan frontmatter
export interface PlanMetadata {
  branch: string;
  source: string;         // Original slug filename
  last_updated: string;   // ISO date string
  commits: string[];      // Commit hashes
}

// Full tracked plan with content
export interface TrackedPlan {
  metadata: PlanMetadata;
  content: string;
}

/**
 * CLI Types
 */

export type Command = 'init' | 'status' | 'list' | 'sync' | 'hook' | 'help' | 'version';

export interface CLIArgs {
  command: Command;
  args: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Configuration Types
 */

export interface HookConfig {
  type: 'command';
  command: string;
  timeout?: number;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookConfig[];
}

export interface ClaudeSettings {
  hooks?: {
    SessionStart?: HookMatcher[];
    SessionEnd?: HookMatcher[];
    PreToolUse?: HookMatcher[];
    PostToolUse?: HookMatcher[];
    [key: string]: HookMatcher[] | undefined;
  };
  [key: string]: unknown;
}
