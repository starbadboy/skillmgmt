# skillmgmt

English | [简体中文](./README.zh-CN.md)

A local web app for managing **coding-agent skills** across multiple AI coding assistants — Claude, Codex, Cursor, and Antigravity — from a single UI.

It scans your machine for installed skills (markdown files under each agent's skill directory), shows them in one library, and lets you edit, sync, and delete skills across agents.

## What it does

- **Discovers skills** on disk by scanning each agent's known skill paths (`~/.claude/skills`, `~/.codex/skills`, `~/.cursor/rules`, `~/.gemini/antigravity/skills`, the vendor-neutral `~/.agents/skills`, etc.). Symlinked skill directories are followed.
- **Detects drift** — when the same skill exists on more than one agent but the markdown content differs. Drift status refreshes automatically after every sync, edit, or delete.
- **Edits skills** with a per-agent markdown editor (Content / Diff / Deploys tabs).
- **Syncs skills** across agents — push one agent's version to selected targets in a click. **Select-all / Clear** pill in the drawer toggles every non-source target at once.
- **Deletes skills** from individual agents.
- **Lists installed Claude Code plugins** in a dedicated Plugins view, with bundled skill counts and a one-click link to filter the Skills view by plugin source.
- **Bulk select** rows with a master checkbox in the header (supports indeterminate state); wired up for bulk delete across all agents a skill is installed on.
- **Dark / light theme** toggle, persisted in `localStorage`.

The UI is the **Console** design direction: dense, dark-by-default, Linear/Raycast energy — Geist + Geist Mono, lime accent, amber drift indicator.

## Tech stack

- **Frontend** — React 19 + Vite 7 + TypeScript, `lucide-react` icons.
- **Backend** — Vite dev-server middleware (`vite.config.ts`) exposing a small REST API:
  - `GET /api/skills` — scan & return all discovered skills + per-agent content map
  - `PUT /api/skills` — update a skill's name, summary, content for a given agent
  - `DELETE /api/skills` — remove a skill from an agent
  - `POST /api/skills/sync` — copy a skill's content from one agent to a list of target agents
  - `GET /api/plugins` — list installed Claude Code plugins, with bundled skill / agent / command / hook counts
- **No database** — all state lives in the on-disk skill files; the app is a thin editor over the filesystem.

## Project layout

```
src/
  App.tsx          # main UI (topbar, rail, table, drawer)
  styles.css       # Console design tokens + dark/light themes
  agentIcons.tsx   # SVG marks for Claude / Codex / Cursor / Antigravity
  data.ts          # agent metadata (paths, colors)
  types.ts         # shared TS types
  main.tsx         # React root
server/
  skillScanner.ts  # filesystem scanner — reads each agent's skill dir (symlink-aware)
  skillStore.ts    # CRUD + cross-agent sync
  pluginScanner.ts # Claude Code plugin discovery (installed_plugins.json + manifests)
vite.config.ts     # dev server + /api/* middleware
```

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (defaults to `http://127.0.0.1:5178` if pinned, otherwise the next free port).

To build for production:

```bash
npm run build
npm run preview
```

## Notes

- The scanner reads real files on your machine. Edits and deletes write back to disk — there's no undo. Back up anything important first.
- "Drift" is computed by comparing the markdown content of the same skill across the agents it's installed on. A skill installed on only one agent is always "Synced".
- The four-agent list is hard-coded in `src/data.ts` — to support more agents, extend the `AgentId` union in `src/types.ts` and add an entry there.
