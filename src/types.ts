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
};

export type Agent = {
  id: AgentId;
  name: string;
  home: string;
  skillPath: string;
  color: string;
};
