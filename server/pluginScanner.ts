import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { Plugin, PluginComponentCounts } from "../src/types";

const home = homedir();

const installedPluginsPath = path.join(home, ".claude", "plugins", "installed_plugins.json");
const marketplacesPath = path.join(home, ".claude", "plugins", "known_marketplaces.json");
const marketplacesDir = path.join(home, ".claude", "plugins", "marketplaces");

type InstalledRecord = {
  scope: "user" | "project";
  projectPath?: string;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha?: string;
};

type InstalledPluginsFile = {
  version: number;
  plugins: Record<string, InstalledRecord[]>;
};

type MarketplaceSource = {
  source: "github" | "git" | string;
  repo?: string;
  url?: string;
};

type KnownMarketplaces = Record<
  string,
  {
    source: MarketplaceSource;
    installLocation: string;
    lastUpdated: string;
    autoUpdate?: boolean;
  }
>;

type MarketplacePluginEntry = {
  name: string;
  version?: string;
  description?: string;
  category?: string;
  author?: { name?: string } | string;
  keywords?: string[];
};

type MarketplaceManifest = {
  name: string;
  plugins?: MarketplacePluginEntry[];
};

type PluginManifest = {
  name: string;
  version?: string;
  description?: string;
  author?: { name?: string } | string;
  license?: string;
  keywords?: string[];
  skills?: string[];
  agents?: string[];
  commands?: string[];
  hooks?: unknown;
};

export type PluginSkillRoot = { pluginId: string; root: string };

export async function listPluginSkillRoots(): Promise<PluginSkillRoot[]> {
  if (!existsSync(installedPluginsPath)) return [];
  const installed = await safeReadJson<InstalledPluginsFile>(installedPluginsPath);
  if (!installed) return [];

  const roots: PluginSkillRoot[] = [];
  for (const [key, records] of Object.entries(installed.plugins ?? {})) {
    const [pluginName, marketplaceId] = key.split("@");
    for (const record of records) {
      const pluginId = `${pluginName}@${marketplaceId}@${record.scope}`;
      const manifest = await loadPluginManifest(record.installPath);
      const skillRefs = manifest?.skills ?? [];
      for (const ref of skillRefs) {
        const resolved = path.resolve(record.installPath, ref);
        if (existsSync(resolved)) roots.push({ pluginId, root: resolved });
      }
      const defaultSkillsDir = path.join(record.installPath, "skills");
      if (existsSync(defaultSkillsDir) && !skillRefs.length) {
        roots.push({ pluginId, root: defaultSkillsDir });
      }
    }
  }
  return roots;
}

export async function scanPlugins(): Promise<{ plugins: Plugin[]; marketplaceCount: number }> {
  if (!existsSync(installedPluginsPath)) {
    return { plugins: [], marketplaceCount: 0 };
  }

  const installed = await readJson<InstalledPluginsFile>(installedPluginsPath);
  const marketplaces = existsSync(marketplacesPath)
    ? await readJson<KnownMarketplaces>(marketplacesPath)
    : {};

  const marketplaceManifests = await loadMarketplaceManifests(marketplaces);

  const plugins: Plugin[] = [];

  for (const [key, records] of Object.entries(installed.plugins ?? {})) {
    for (const record of records) {
      const [pluginName, marketplaceId] = key.split("@");
      const manifest = await loadPluginManifest(record.installPath);
      const marketplaceEntry = marketplaceManifests[marketplaceId]?.plugins?.find(
        (entry) => entry.name === pluginName,
      );
      const latestVersion = marketplaceEntry?.version;
      const updateAvailable = isNewerVersion(latestVersion, record.version);
      const source = marketplaces[marketplaceId]?.source;

      plugins.push({
        id: `${pluginName}@${marketplaceId}@${record.scope}`,
        name: pluginName,
        marketplaceId,
        scope: record.scope,
        projectPath: record.projectPath,
        installPath: record.installPath,
        version: record.version,
        latestVersion: latestVersion ?? null,
        updateAvailable,
        installedAt: record.installedAt,
        lastUpdated: record.lastUpdated,
        gitCommitSha: record.gitCommitSha,
        description:
          manifest?.description ?? marketplaceEntry?.description ?? "No description provided.",
        author: pickAuthor(manifest?.author ?? marketplaceEntry?.author),
        license: manifest?.license,
        keywords: manifest?.keywords ?? marketplaceEntry?.keywords ?? [],
        category: marketplaceEntry?.category,
        sourceRepo: source?.repo ?? source?.url,
        components: countComponents(manifest),
      });
    }
  }

  plugins.sort((a, b) => {
    if (a.updateAvailable !== b.updateAvailable) return a.updateAvailable ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { plugins, marketplaceCount: Object.keys(marketplaces).length };
}

async function loadMarketplaceManifests(
  marketplaces: KnownMarketplaces,
): Promise<Record<string, MarketplaceManifest>> {
  const result: Record<string, MarketplaceManifest> = {};

  for (const id of Object.keys(marketplaces)) {
    const manifestPath = path.join(marketplacesDir, id, ".claude-plugin", "marketplace.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = await safeReadJson<MarketplaceManifest>(manifestPath);
    if (manifest) {
      result[id] = manifest;
    }
  }

  return result;
}

async function loadPluginManifest(installPath: string): Promise<PluginManifest | undefined> {
  const candidates = [
    path.join(installPath, ".claude-plugin", "plugin.json"),
    path.join(installPath, "plugin.json"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const manifest = await safeReadJson<PluginManifest>(candidate);
      if (manifest) return manifest;
    }
  }
  return undefined;
}

function countComponents(manifest: PluginManifest | undefined): PluginComponentCounts {
  if (!manifest) return { skills: 0, agents: 0, commands: 0, hooks: 0 };
  return {
    skills: manifest.skills?.length ?? 0,
    agents: manifest.agents?.length ?? 0,
    commands: manifest.commands?.length ?? 0,
    hooks: manifest.hooks ? 1 : 0,
  };
}

function pickAuthor(author: PluginManifest["author"]): string | undefined {
  if (!author) return undefined;
  if (typeof author === "string") return author;
  return author.name;
}

function isNewerVersion(latest: string | undefined, current: string): boolean {
  if (!latest || latest === "unknown" || current === "unknown") return false;
  if (latest === current) return false;
  const parse = (value: string) =>
    value
      .replace(/^v/, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  const a = parse(latest);
  const b = parse(current);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const x = a[index] ?? 0;
    const y = b[index] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function safeReadJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return await readJson<T>(filePath);
  } catch {
    return undefined;
  }
}
