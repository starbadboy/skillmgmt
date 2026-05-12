import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentId } from "../src/types";
import { scanSkills, skillRoots, slug } from "./skillScanner";

export type SkillPayload = {
  name: string;
  description: string;
  content?: string;
  targetAgents: AgentId[];
};

export type SkillUpdatePayload = {
  agent: AgentId;
  path: string;
  name: string;
  description: string;
  content: string;
};

export type SkillDeletePayload = {
  agent: AgentId;
  path: string;
};

export type SkillSyncPayload = {
  sourceAgent: AgentId;
  sourcePath: string;
  targetAgents: AgentId[];
};

export async function createSkill(payload: SkillPayload) {
  const id = slug(payload.name);
  const content = payload.content?.trim() || buildSkillContent(payload.name, payload.description);

  await Promise.all(
    payload.targetAgents.map((agent) => writeAgentSkill(agent, id, content)),
  );

  return scanSkills();
}

export async function updateSkill(payload: SkillUpdatePayload) {
  assertAgentPath(payload.agent, payload.path);
  const content = mergeFrontmatter(payload.content, payload.name, payload.description);
  await writeFile(payload.path, content, "utf8");
  return scanSkills();
}

export async function deleteSkill(payload: SkillDeletePayload) {
  assertAgentPath(payload.agent, payload.path);
  await rm(payload.path);
  await removeEmptySkillDirectory(payload.path);
  return scanSkills();
}

export async function syncSkill(payload: SkillSyncPayload) {
  assertAgentPath(payload.sourceAgent, payload.sourcePath);
  const sourceContent = await readFile(payload.sourcePath, "utf8");
  const id = skillIdFromPath(payload.sourcePath);

  await Promise.all(
    payload.targetAgents
      .filter((agent) => agent !== payload.sourceAgent)
      .map((agent) => writeAgentSkill(agent, id, sourceContent)),
  );

  return scanSkills();
}

export function primaryRoot(agent: AgentId) {
  return skillRoots[agent][0];
}

function buildSkillContent(name: string, description: string) {
  return `---\nname: ${quoteYaml(name)}\ndescription: ${quoteYaml(description || "No description yet.")}\n---\n\n# ${name}\n\n${description || "Describe when and how this skill should be used."}\n`;
}

function mergeFrontmatter(content: string, name: string, description: string) {
  const body = content.replace(/^---[\s\S]*?\n---\s*/, "").trim();
  return `---\nname: ${quoteYaml(name)}\ndescription: ${quoteYaml(description || "No description yet.")}\n---\n\n${body || `# ${name}\n\n${description || "Describe when and how this skill should be used."}`}\n`;
}

async function writeAgentSkill(agent: AgentId, id: string, content: string) {
  const root = primaryRoot(agent);
  const filePath = path.join(root, id, "SKILL.md");
  assertAgentPath(agent, filePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function removeEmptySkillDirectory(filePath: string) {
  const directory = path.dirname(filePath);
  if (path.basename(filePath) !== "SKILL.md") {
    return;
  }

  try {
    await rm(directory, { recursive: false });
  } catch {
    // Keep directories that still contain references, templates, or other skill assets.
  }
}

function assertAgentPath(agent: AgentId, filePath: string) {
  const absolute = path.resolve(filePath);
  const allowedRoots = skillRoots[agent].map((root) => path.resolve(root));
  const isAllowed = allowedRoots.some((root) => absolute === root || absolute.startsWith(`${root}${path.sep}`));

  if (!isAllowed) {
    throw new Error(`Path is not inside a configured ${agent} skill root`);
  }
}

function skillIdFromPath(filePath: string) {
  return path.basename(filePath) === "SKILL.md"
    ? slug(path.basename(path.dirname(filePath)))
    : slug(path.basename(filePath, path.extname(filePath)));
}

function quoteYaml(value: string) {
  return JSON.stringify(value.replace(/\n/g, " ").trim());
}
