import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { HookSource } from "../src/types";
import { scanHooks } from "./hookScanner";

const home = homedir();

const sourceToFile: Record<HookSource, string> = {
  user: path.join(home, ".claude", "settings.json"),
  "user-local": path.join(home, ".claude", "settings.local.json"),
  project: path.join(process.cwd(), ".claude", "settings.json"),
  "project-local": path.join(process.cwd(), ".claude", "settings.local.json"),
};

export type HookDeletePayload = { id: string };

export type HookUpdatePayload = {
  id: string;
  matcher?: string;
  command?: string;
  timeout?: number | null;
};

type ParsedId = {
  source: HookSource;
  event: string;
  entryIndex: number;
  hookIndex: number;
};

function parseId(id: string): ParsedId {
  const lastColon = id.lastIndexOf(":");
  const secondLast = id.lastIndexOf(":", lastColon - 1);
  const thirdLast = id.lastIndexOf(":", secondLast - 1);
  if (lastColon < 0 || secondLast < 0 || thirdLast < 0) {
    throw new Error(`Malformed hook id: ${id}`);
  }
  const source = id.slice(0, thirdLast) as HookSource;
  const event = id.slice(thirdLast + 1, secondLast);
  const entryIndex = Number(id.slice(secondLast + 1, lastColon));
  const hookIndex = Number(id.slice(lastColon + 1));
  if (!sourceToFile[source]) throw new Error(`Unknown hook source: ${source}`);
  if (Number.isNaN(entryIndex) || Number.isNaN(hookIndex)) {
    throw new Error(`Malformed hook id indexes: ${id}`);
  }
  return { source, event, entryIndex, hookIndex };
}

async function loadSettings(file: string): Promise<any> {
  if (!existsSync(file)) throw new Error(`Settings file not found: ${file}`);
  return JSON.parse(await readFile(file, "utf8"));
}

async function saveSettings(file: string, data: any) {
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function deleteHook(payload: HookDeletePayload) {
  const { source, event, entryIndex, hookIndex } = parseId(payload.id);
  const file = sourceToFile[source];
  const data = await loadSettings(file);
  const events = data.hooks?.[event];
  if (!Array.isArray(events) || !events[entryIndex]) {
    throw new Error("Hook entry not found");
  }
  const entry = events[entryIndex];
  if (!Array.isArray(entry.hooks) || !entry.hooks[hookIndex]) {
    throw new Error("Hook not found");
  }
  entry.hooks.splice(hookIndex, 1);
  if (entry.hooks.length === 0) {
    events.splice(entryIndex, 1);
  }
  if (events.length === 0) {
    delete data.hooks[event];
  }
  if (data.hooks && Object.keys(data.hooks).length === 0) {
    delete data.hooks;
  }
  await saveSettings(file, data);
  return scanHooks();
}

export async function updateHook(payload: HookUpdatePayload) {
  const { source, event, entryIndex, hookIndex } = parseId(payload.id);
  const file = sourceToFile[source];
  const data = await loadSettings(file);
  const events = data.hooks?.[event];
  if (!Array.isArray(events) || !events[entryIndex]) {
    throw new Error("Hook entry not found");
  }
  const entry = events[entryIndex];
  if (!Array.isArray(entry.hooks) || !entry.hooks[hookIndex]) {
    throw new Error("Hook not found");
  }
  if (typeof payload.matcher === "string") {
    entry.matcher = payload.matcher;
  }
  if (typeof payload.command === "string") {
    entry.hooks[hookIndex].command = payload.command;
  }
  if (payload.timeout === null) {
    delete entry.hooks[hookIndex].timeout;
  } else if (typeof payload.timeout === "number") {
    entry.hooks[hookIndex].timeout = payload.timeout;
  }
  await saveSettings(file, data);
  return scanHooks();
}
