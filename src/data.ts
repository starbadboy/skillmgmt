import type { Agent } from "./types";

export const agents: Agent[] = [
  {
    id: "claude",
    name: "Claude",
    home: "~/.claude",
    skillPath: "~/.claude/skills",
    color: "#C97B45",
  },
  {
    id: "codex",
    name: "Codex",
    home: "~/.codex",
    skillPath: "~/.codex/skills",
    color: "#5B8FF9",
  },
  {
    id: "cursor",
    name: "Cursor",
    home: "~/.cursor",
    skillPath: "~/.cursor/rules",
    color: "#9CA3AF",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    home: "~/.antigravity",
    skillPath: "~/.antigravity/skills",
    color: "#10B981",
  },
];
