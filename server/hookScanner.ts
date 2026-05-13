import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { Hook, HookEvent, HookSource } from "../src/types";

const home = homedir();

const sources: { source: HookSource; file: string }[] = [
  { source: "user", file: path.join(home, ".claude", "settings.json") },
  { source: "user-local", file: path.join(home, ".claude", "settings.local.json") },
  { source: "project", file: path.join(process.cwd(), ".claude", "settings.json") },
  { source: "project-local", file: path.join(process.cwd(), ".claude", "settings.local.json") },
];

type RawHookEntry = {
  matcher?: string;
  hooks?: { type?: string; command?: string; timeout?: number }[];
};

type RawSettings = {
  hooks?: Record<string, RawHookEntry[]>;
};

export async function scanHooks(): Promise<{ hooks: Hook[]; scannedFiles: string[] }> {
  const hooks: Hook[] = [];
  const scannedFiles: string[] = [];

  for (const { source, file } of sources) {
    if (!existsSync(file)) continue;
    scannedFiles.push(file);
    try {
      const raw = JSON.parse(await readFile(file, "utf8")) as RawSettings;
      if (!raw.hooks) continue;
      for (const [event, entries] of Object.entries(raw.hooks)) {
        if (!Array.isArray(entries)) continue;
        entries.forEach((entry, entryIndex) => {
          const matcher = entry.matcher ?? "*";
          (entry.hooks ?? []).forEach((h, hookIndex) => {
            if (!h.command) return;
            hooks.push({
              id: `${source}:${event}:${entryIndex}:${hookIndex}`,
              source,
              file,
              event: event as HookEvent,
              matcher,
              type: h.type ?? "command",
              command: h.command,
              timeout: h.timeout,
            });
          });
        });
      }
    } catch {
      // ignore malformed settings file
    }
  }

  return { hooks, scannedFiles };
}
