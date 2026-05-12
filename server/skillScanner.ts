import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { AgentId, Skill } from "../src/types";
import { listPluginSkillRoots } from "./pluginScanner";

type SkillCandidate = {
  agent: AgentId;
  filePath: string;
  root: string;
  name: string;
  summary: string;
  content: string;
  updatedAt: string;
  pluginId?: string;
};

const home = homedir();

const agentSpecificRoots: Record<AgentId, string[]> = {
  claude: [
    path.join(home, ".claude", "skills"),
    path.join(home, ".claude", ".cursor", "skills"),
  ],
  codex: [
    path.join(home, ".codex", "skills"),
    path.join(home, "Documents", "obsidian-wiki", ".skills"),
  ],
  cursor: [
    path.join(home, ".cursor", "skills"),
    path.join(home, ".cursor", "skills-cursor"),
    path.join(home, ".cursor", "commands"),
    path.join(home, ".cursor", "rules"),
  ],
  antigravity: [
    path.join(home, ".gemini", "antigravity", "skills"),
    path.join(home, ".antigravity", "skills"),
  ],
};

// Vendor-neutral AGENTS.md convention — skills here apply to every coding agent.
export const sharedSkillRoots: string[] = [
  path.join(home, ".agents", "skills"),
  path.join(home, ".claude", ".agents", "skills"),
];

const allAgents = Object.keys(agentSpecificRoots) as AgentId[];

// Agents that opt out of the vendor-neutral ~/.agents/skills convention.
// Antigravity only loads from its own skill folders.
const sharedRootOptOut: Set<AgentId> = new Set(["antigravity"]);

export const skillRoots: Record<AgentId, string[]> = Object.fromEntries(
  allAgents.map((agent) => [
    agent,
    sharedRootOptOut.has(agent)
      ? [...agentSpecificRoots[agent]]
      : [...agentSpecificRoots[agent], ...sharedSkillRoots],
  ]),
) as Record<AgentId, string[]>;

const targetFileNames = new Set(["SKILL.md"]);
const cursorFileNames = new Set(["AGENTS.md"]);

export async function scanSkills(): Promise<{ skills: Skill[]; scannedRoots: Record<AgentId, string[]> }> {
  const pluginRoots = await listPluginSkillRoots();
  const candidates = (
    await Promise.all([
      ...Object.entries(skillRoots).map(async ([agent, agentRoots]) =>
        Promise.all(
          agentRoots
            .filter((root) => existsSync(root))
            .map((root) => scanRoot(agent as AgentId, root)),
        ),
      ),
      ...pluginRoots.map((entry) => scanRoot("claude", entry.root, entry.pluginId)),
    ])
  ).flat(2);

  const groups = new Map<string, SkillCandidate[]>();
  for (const candidate of candidates) {
    const key = slug(candidate.name);
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  const skills = [...groups.entries()]
    .map(([id, group]) => toSkill(id, group))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));

  return {
    skills,
    scannedRoots: Object.fromEntries(
      Object.entries(skillRoots).map(([agent, agentRoots]) => [
        agent,
        agentRoots.filter((root) => existsSync(root)),
      ]),
    ) as Record<AgentId, string[]>,
  };
}

async function scanRoot(agent: AgentId, root: string, pluginId?: string): Promise<SkillCandidate[]> {
  const files = await walk(root, agent);
  const candidates = await Promise.all(
    files.map(async (filePath) => parseSkillFile(agent, root, filePath, pluginId)),
  );

  return candidates.filter((candidate): candidate is SkillCandidate => Boolean(candidate));
}

async function walk(root: string, agent: AgentId): Promise<string[]> {
  const found: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      let isDir = entry.isDirectory();
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        try {
          const resolved = await stat(fullPath);
          isDir = resolved.isDirectory();
          isFile = resolved.isFile();
        } catch {
          continue;
        }
      }
      if (isDir) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (isFile && isSkillFile(agent, entry.name, fullPath)) {
        found.push(fullPath);
      }
    }
  }

  return found;
}

function shouldSkipDirectory(name: string) {
  return [
    ".git",
    "node_modules",
    "dist",
    "build",
    "extensions",
    "projects",
    "plans",
    "browser_recordings",
    "code_tracker",
    "Safe Browsing",
    "Snapshots",
  ].includes(name);
}

function isSkillFile(agent: AgentId, fileName: string, filePath: string) {
  if (targetFileNames.has(fileName)) {
    return true;
  }

  if (agent !== "cursor") {
    return false;
  }

  return (
    cursorFileNames.has(fileName) ||
    (filePath.includes(`${path.sep}.cursor${path.sep}commands${path.sep}`) && fileName.endsWith(".md")) ||
    (filePath.includes(`${path.sep}.cursor${path.sep}rules${path.sep}`) && fileName.endsWith(".md"))
  );
}

async function parseSkillFile(
  agent: AgentId,
  root: string,
  filePath: string,
  pluginId?: string,
): Promise<SkillCandidate | undefined> {
  try {
    const [content, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    const frontmatter = parseFrontmatter(content);
    const fallbackName = path.basename(filePath) === "SKILL.md"
      ? path.basename(path.dirname(filePath))
      : path.basename(filePath, path.extname(filePath));

    const parentFallbackName = path.basename(path.dirname(filePath)) === "."
      ? path.basename(filePath, path.extname(filePath))
      : path.basename(path.dirname(filePath));

    return {
      agent,
      filePath,
      root,
      name: titleCase(frontmatter.name ?? fallbackName ?? parentFallbackName),
      summary: frontmatter.description ?? firstMeaningfulLine(content) ?? "No description found.",
      content,
      updatedAt: info.mtime.toISOString().slice(0, 10),
      pluginId,
    };
  } catch {
    return undefined;
  }
}

function parseFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith("---")) {
    return {};
  }

  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return {};
  }

  const lines = content.slice(3, end).split("\n");
  const values: Record<string, string> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith(" ") || line.startsWith("\t")) {
      continue;
    }
    const separator = line.indexOf(":");
      if (separator === -1) {
      continue;
      }
      const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    const isFolded = rawValue === ">" || rawValue === ">-" || rawValue === "|" || rawValue === "|-";
    const value = isFolded
      ? readFoldedValue(lines, index + 1)
      : rawValue.replace(/^["']|["']$/g, "");

      if (key && value) {
      values[key] = value;
      }
  }

  return values;
}

function readFoldedValue(lines: string[], startIndex: number) {
  const parts: string[] = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() && !line.startsWith(" ") && !line.startsWith("\t")) {
      break;
    }
    if (line.trim()) {
      parts.push(line.trim());
    }
  }

  return parts.join(" ");
}

function firstMeaningfulLine(content: string) {
  return content
    .replace(/^---[\s\S]*?\n---/, "")
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find((line) => line.length > 20);
}

function toSkill(id: string, group: SkillCandidate[]): Skill {
  const primary = group.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const agentSet = new Set(group.map((candidate) => candidate.agent));
  const pluginId = group.find((candidate) => candidate.pluginId)?.pluginId;

  return {
    id,
    name: primary.name,
    summary: primary.summary,
    content: primary.content,
    owner: pluginId ? `Plugin: ${pluginId.split("@")[0]}` : "Local filesystem",
    updatedAt: primary.updatedAt,
    version: "local",
    agents: [...agentSet],
    paths: Object.fromEntries(
      group.map((candidate) => [candidate.agent, candidate.filePath]),
    ) as Skill["paths"],
    contents: Object.fromEntries(
      group.map((candidate) => [candidate.agent, candidate.content]),
    ) as Skill["contents"],
    triggers: inferTriggers(primary.summary),
    pluginId,
  };
}

function inferTriggers(summary: string) {
  return summary
    .split(/,|;|\bor\b|\band\b/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 3 && part.length < 42)
    .slice(0, 4);
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
