export type AgentId = "claude" | "codex" | "cursor" | "antigravity";

export type Skill = {
  id: string;
  name: string;
  summary: string;
  content?: string;
  contents?: Partial<Record<AgentId, string>>;
  owner: string;
  updatedAt: string;
  version: string;
  agents: AgentId[];
  paths: Partial<Record<AgentId, string>>;
  triggers: string[];
  pluginId?: string;
};

export type Agent = {
  id: AgentId;
  name: string;
  home: string;
  skillPath: string;
  color: string;
};

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "UserPromptSubmit"
  | "Stop"
  | "SessionStart"
  | "SessionEnd"
  | "Notification"
  | "PreCompact"
  | string;

export type HookSource = "user" | "user-local" | "project" | "project-local";

export type Hook = {
  id: string;
  source: HookSource;
  file: string;
  event: HookEvent;
  matcher: string;
  type: string;
  command: string;
  timeout?: number;
};

export type PluginComponentCounts = {
  skills: number;
  agents: number;
  commands: number;
  hooks: number;
};

export type Plugin = {
  id: string;
  name: string;
  marketplaceId: string;
  scope: "user" | "project";
  projectPath?: string;
  installPath: string;
  version: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha?: string;
  description: string;
  author?: string;
  license?: string;
  keywords: string[];
  category?: string;
  sourceRepo?: string;
  components: PluginComponentCounts;
};
