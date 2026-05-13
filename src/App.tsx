import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { agents } from "./data";
import { AgentIcon } from "./agentIcons";
import type { AgentId, Plugin, Skill } from "./types";

type AgentFilter = AgentId | "all";
type Status = "synced" | "drift" | "pending";
type Tab = "content" | "diff" | "deploys";
type ViewMode = "edit" | "preview";
type SortKey = "updated" | "name";
type ViewMain = "skills" | "plugins";

type SkillResponse = {
  skills: Skill[];
  scannedRoots: Record<AgentId, string[]>;
};

type PluginResponse = {
  plugins: Plugin[];
  marketplaceCount: number;
};

const AGENT_TONE: Record<AgentId, string> = {
  claude: "c-claude",
  codex: "c-codex",
  cursor: "c-cursor",
  antigravity: "c-anti",
};

function computeStatus(skill: Skill): Status {
  if (!skill.contents) return "synced";
  const entries = skill.agents
    .map((a) => skill.contents?.[a])
    .filter((v): v is string => typeof v === "string");
  if (entries.length < 2) return "synced";
  const first = entries[0];
  return entries.every((e) => e === first) ? "synced" : "drift";
}

function relativeTime(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return iso.slice(0, 10);
}

export function App() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [selectedId, setSelectedId] = useState("");
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [draftAgents, setDraftAgents] = useState<AgentId[]>(["codex"]);
  const [scannedRoots, setScannedRoots] = useState<Record<AgentId, string[]>>({
    claude: [], codex: [], cursor: [], antigravity: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<ViewMain>("skills");
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pluginsError, setPluginsError] = useState("");
  const [marketplaceCount, setMarketplaceCount] = useState(0);
  const [pluginFilter, setPluginFilter] = useState<string>("");
  const [operationMessage, setOperationMessage] = useState("");
  const [operationError, setOperationError] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentId>("codex");
  const [editName, setEditName] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editContent, setEditContent] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("content");
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("skillmgmt-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("skillmgmt-theme", theme);
  }, [theme]);

  const loadSkills = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/skills");
      if (!response.ok) throw new Error(`Skill API returned ${response.status}`);
      const payload = (await response.json()) as SkillResponse;
      setSkills(payload.skills);
      setScannedRoots(payload.scannedRoots);
      setSelectedId((current) => current || payload.skills[0]?.id || "");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load skills");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlugins = async () => {
    setPluginsLoading(true);
    setPluginsError("");
    try {
      const response = await fetch("/api/plugins");
      if (!response.ok) throw new Error(`Plugin API returned ${response.status}`);
      const payload = (await response.json()) as PluginResponse;
      setPlugins(payload.plugins);
      setMarketplaceCount(payload.marketplaceCount);
    } catch (error) {
      setPluginsError(error instanceof Error ? error.message : "Unable to load plugins");
    } finally {
      setPluginsLoading(false);
    }
  };

  useEffect(() => { void loadSkills(); void loadPlugins(); }, []);

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = skills.filter((skill) => {
      if (pluginFilter && skill.pluginId !== pluginFilter) return false;
      if (activeAgent !== "all" && !skill.agents.includes(activeAgent)) return false;
      if (statusFilter !== "all" && computeStatus(skill) !== statusFilter) return false;
      if (!q) return true;
      return [skill.name, skill.summary, skill.owner, skill.triggers.join(" ")]
        .join(" ").toLowerCase().includes(q);
    });
    out = [...out].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });
    return out;
  }, [activeAgent, statusFilter, query, sortBy, skills, pluginFilter]);

  const selectedSkill = skills.find((s) => s.id === selectedId) ?? filteredSkills[0] ?? skills[0];
  const selectedStatus = selectedSkill ? computeStatus(selectedSkill) : "synced";

  useEffect(() => {
    if (!selectedSkill) return;
    const preferred = selectedSkill.agents.includes(editAgent) ? editAgent : selectedSkill.agents[0] ?? "codex";
    setEditAgent(preferred);
    setEditName(selectedSkill.name);
    setEditSummary(selectedSkill.summary);
    setEditContent(selectedSkill.contents?.[preferred] ?? selectedSkill.content ?? "");
    setActiveTab("content");
  }, [selectedSkill?.id]);

  const driftCount = useMemo(() => skills.filter((s) => computeStatus(s) === "drift").length, [skills]);
  const agentCounts = useMemo(() => {
    const m: Record<AgentId, number> = { claude: 0, codex: 0, cursor: 0, antigravity: 0 };
    skills.forEach((s) => s.agents.forEach((a) => { m[a]++; }));
    return m;
  }, [skills]);

  const selectEditAgent = (agentId: AgentId) => {
    setEditAgent(agentId);
    if (selectedSkill) setEditContent(selectedSkill.contents?.[agentId] ?? selectedSkill.content ?? "");
  };

  const toggleSyncTarget = (agentId: AgentId) => {
    setDraftAgents((c) => c.includes(agentId) ? c.filter((x) => x !== agentId) : [...c, agentId]);
  };

  const toggleAllSyncTargets = () => {
    const selectable = agents.map((a) => a.id).filter((id) => id !== editAgent);
    const allOn = selectable.every((id) => draftAgents.includes(id));
    setDraftAgents(allOn ? [] : selectable);
  };

  const toggleBulk = (id: string) => {
    setBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applySkillResponse = (payload: SkillResponse, message: string, error = false) => {
    setSkills(payload.skills);
    setScannedRoots(payload.scannedRoots);
    setSelectedId((current) =>
      payload.skills.find((s) => s.id === current)?.id || payload.skills[0]?.id || "",
    );
    setOperationMessage(message);
    setOperationError(error);
  };

  const mutateSkills = async (method: "POST" | "PUT" | "DELETE", url: string, body: Record<string, unknown>, message: string) => {
    setOperationMessage(""); setOperationError(false);
    try {
      const response = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error || `Request failed with ${response.status}`);
      applySkillResponse(payload as SkillResponse, message);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : "Operation failed");
      setOperationError(true);
    }
  };

  return (
    <main className="ca-root">
      <Topbar
        query={query}
        onQuery={setQuery}
        count={skills.length}
        drift={driftCount}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <div className={`ca-body ${selectedSkill ? "has-drawer" : ""}`}>
        <Sidebar
          activeAgent={activeAgent}
          onAgent={(a) => { setView("skills"); setActiveAgent(a); }}
          statusFilter={statusFilter}
          onStatus={setStatusFilter}
          counts={agentCounts}
          total={skills.length}
          driftCount={driftCount}
          scannedRoots={scannedRoots}
          view={view}
          onView={setView}
          pluginCount={plugins.length}
          pluginUpdateCount={plugins.filter((p) => p.updateAvailable).length}
        />

        {view === "plugins" ? (
          <PluginsPanel
            plugins={plugins}
            isLoading={pluginsLoading}
            loadError={pluginsError}
            marketplaceCount={marketplaceCount}
            onRefresh={() => void loadPlugins()}
            skillCountByPlugin={skills.reduce<Record<string, number>>((acc, s) => {
              if (s.pluginId) acc[s.pluginId] = (acc[s.pluginId] ?? 0) + 1;
              return acc;
            }, {})}
            onOpenInSkills={(pluginId) => {
              setPluginFilter(pluginId);
              setActiveAgent("all");
              setStatusFilter("all");
              setView("skills");
            }}
          />
        ) : (
        <section className="ca-main">
          <header className="ca-mainhead">
            <div>
              <div className="ca-crumb">
                <span>skillmgmt</span> <span style={{ color: "var(--dim)" }}>/</span>{" "}
                <b>{activeAgent === "all" ? "all-agents" : activeAgent}</b>
                {statusFilter !== "all" && <> <span style={{ color: "var(--dim)" }}>/</span> <b>{statusFilter}</b></>}
              </div>
              <h1>{activeAgent === "all" ? "All skills" : agents.find((a) => a.id === activeAgent)?.name}</h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ca-btn ca-btn--ghost" type="button" onClick={() => void loadSkills()}>
                <RefreshCw size={13} /> Refresh
              </button>
              <button className="ca-btn ca-btn--primary" type="button">
                <Plus size={13} /> New skill
              </button>
            </div>
          </header>

          <StatsStrip total={skills.length} drift={driftCount} agentCounts={agentCounts} skills={skills} />

          <div className="ca-toolbar">
            {pluginFilter && (
              <button
                className="ca-filter is-on"
                type="button"
                onClick={() => setPluginFilter("")}
                title="Clear plugin filter"
              >
                Plugin: <b>{pluginFilter.split("@")[0]}</b> <X size={11} />
              </button>
            )}
            <button
              className={`ca-filter ${statusFilter === "drift" ? "is-on warn" : ""}`}
              type="button"
              onClick={() => setStatusFilter((s) => (s === "drift" ? "all" : "drift"))}
            >
              <AlertTriangle size={12} /> Drift <b>{driftCount}</b>
            </button>
            <button
              className={`ca-filter ${statusFilter === "synced" ? "is-on" : ""}`}
              type="button"
              onClick={() => setStatusFilter((s) => (s === "synced" ? "all" : "synced"))}
            >
              <Check size={12} /> Synced
            </button>
            <div className="spacer" />
            <button
              className="ca-filter"
              type="button"
              onClick={() => setSortBy((s) => (s === "updated" ? "name" : "updated"))}
            >
              <ArrowUpDown size={12} /> Sort: <b>{sortBy === "updated" ? "Recent" : "A → Z"}</b>
            </button>
          </div>

          <div className="ca-table">
            <div className="ca-thead">
              <div>
                {filteredSkills.length > 0 && (
                  <input
                    type="checkbox"
                    className="ca-check"
                    aria-label="Select all skills"
                    checked={filteredSkills.every((s) => bulkIds.has(s.id))}
                    ref={(el) => {
                      if (el) {
                        const some = filteredSkills.some((s) => bulkIds.has(s.id));
                        const all = filteredSkills.every((s) => bulkIds.has(s.id));
                        el.indeterminate = some && !all;
                      }
                    }}
                    onChange={(e) => {
                      const next = new Set(bulkIds);
                      if (e.target.checked) filteredSkills.forEach((s) => next.add(s.id));
                      else filteredSkills.forEach((s) => next.delete(s.id));
                      setBulkIds(next);
                    }}
                  />
                )}
              </div>
              <div>Skill</div>
              <div>Agents</div>
              <div>Owner</div>
              <div>Status</div>
              <div>Updated</div>
              <div />
            </div>
            <div className="ca-tbody">
              {isLoading && (
                <div className="ca-empty"><RefreshCw size={20} /><strong>Scanning local agent folders…</strong></div>
              )}
              {loadError && (
                <div className="ca-empty error"><AlertTriangle size={20} /><strong>Could not load skills</strong><span>{loadError}</span></div>
              )}
              {!isLoading && !loadError && filteredSkills.length === 0 && (
                <div className="ca-empty"><Search size={20} /><strong>No matching skills</strong><span>Try a different filter.</span></div>
              )}
              {filteredSkills.map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  selected={selectedSkill?.id === skill.id}
                  checked={bulkIds.has(skill.id)}
                  onSelect={() => setSelectedId(skill.id)}
                  onCheck={() => toggleBulk(skill.id)}
                />
              ))}
            </div>
          </div>
        </section>
        )}

        {view === "skills" && selectedSkill && (
          <EditDrawer
            skill={selectedSkill}
            status={selectedStatus}
            editAgent={editAgent}
            editName={editName}
            editSummary={editSummary}
            editContent={editContent}
            activeTab={activeTab}
            viewMode={viewMode}
            syncTargets={draftAgents}
            operationMessage={operationMessage}
            operationError={operationError}
            onClose={() => setSelectedId("")}
            onEditAgent={selectEditAgent}
            onName={setEditName}
            onSummary={setEditSummary}
            onContent={setEditContent}
            onTab={setActiveTab}
            onViewMode={setViewMode}
            onToggleSync={toggleSyncTarget}
            onToggleAllSync={toggleAllSyncTargets}
            onSave={async () => {
              if (!selectedSkill.paths[editAgent]) return;
              await mutateSkills("PUT", "/api/skills", {
                agent: editAgent,
                path: selectedSkill.paths[editAgent],
                name: editName,
                description: editSummary,
                content: editContent,
              }, `Saved ${editName} → ${editAgent}`);
            }}
            onDelete={async () => {
              if (!selectedSkill.paths[editAgent]) return;
              await mutateSkills("DELETE", "/api/skills", {
                agent: editAgent,
                path: selectedSkill.paths[editAgent],
              }, `Deleted ${selectedSkill.name} from ${editAgent}`);
            }}
            onSync={async () => {
              if (!selectedSkill.paths[editAgent]) return;
              await mutateSkills("POST", "/api/skills/sync", {
                sourceAgent: editAgent,
                sourcePath: selectedSkill.paths[editAgent],
                targetAgents: draftAgents,
              }, `Synced ${selectedSkill.name} → ${draftAgents.join(", ")}`);
            }}
          />
        )}
      </div>

      {bulkIds.size > 0 && (
        <BulkBar
          count={bulkIds.size}
          onClear={() => setBulkIds(new Set())}
          onDelete={async () => {
            const targets = skills.filter((s) => bulkIds.has(s.id));
            if (targets.length === 0) return;
            const total = targets.reduce((n, s) => n + Object.keys(s.paths).length, 0);
            if (!window.confirm(`Delete ${total} file(s) across ${targets.length} skill(s)?`)) return;
            setOperationMessage(""); setOperationError(false);
            try {
              let lastPayload: SkillResponse | null = null;
              for (const skill of targets) {
                for (const [agent, filePath] of Object.entries(skill.paths)) {
                  const r = await fetch("/api/skills", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ agent, path: filePath }),
                  });
                  const payload = await r.json();
                  if (!r.ok || payload.error) throw new Error(payload.error || `Delete failed (${r.status})`);
                  lastPayload = payload as SkillResponse;
                }
              }
              if (lastPayload) applySkillResponse(lastPayload, `Deleted ${targets.length} skill(s)`);
              setBulkIds(new Set());
            } catch (error) {
              setOperationMessage(error instanceof Error ? error.message : "Bulk delete failed");
              setOperationError(true);
            }
          }}
        />
      )}
    </main>
  );
}

/* ─────────────────────────────────────────── Topbar */
function Topbar({ query, onQuery, count, drift, theme, onToggleTheme }: {
  query: string; onQuery: (v: string) => void; count: number; drift: number;
  theme: "dark" | "light"; onToggleTheme: () => void;
}) {
  return (
    <header className="ca-topbar">
      <div className="ca-brand">
        <div className="ca-brand-mark">S</div>
        <b>SKILLMGMT</b>
        <span className="div">/</span>
        <span>console</span>
      </div>
      <label className="ca-cmd">
        <Search size={14} />
        <input
          placeholder="Search skills, paths, triggers…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search"
        />
        <span className="ca-kbd">⌘K</span>
      </label>
      <div className="ca-topright">
        <span className="ca-pill" title={`${count} skills · ${drift} drift`}>
          <span className="ca-status-dot" style={drift > 0 ? { background: "var(--amber)", boxShadow: "0 0 6px var(--amber)" } : undefined} />
          {drift > 0 ? `${drift} drifted` : "All in sync"}
        </span>
        <button
          type="button"
          className="ca-iconbtn"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <span className="ca-av">SM</span>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────── Sidebar */
function Sidebar({ activeAgent, onAgent, statusFilter, onStatus, counts, total, driftCount, scannedRoots, view, onView, pluginCount, pluginUpdateCount }: {
  activeAgent: AgentFilter;
  onAgent: (a: AgentFilter) => void;
  statusFilter: Status | "all";
  onStatus: (s: Status | "all") => void;
  counts: Record<AgentId, number>;
  total: number;
  driftCount: number;
  scannedRoots: Record<AgentId, string[]>;
  view: ViewMain;
  onView: (v: ViewMain) => void;
  pluginCount: number;
  pluginUpdateCount: number;
}) {
  return (
    <aside className="ca-rail">
      <div className="ca-rail-section">
        <div className="ca-rail-heading">Library</div>
        <button
          className={`ca-rail-item ${view === "skills" && activeAgent === "all" ? "is-active" : ""}`}
          onClick={() => onAgent("all")}
          type="button"
        >
          <span className="ca-rail-dot" style={{ background: "var(--text-2)" }} />
          <span>All skills</span>
          <span className="ca-rail-count">{total}</span>
        </button>
        {agents.map((agent) => {
          const Icon = AgentIcon[agent.id];
          return (
            <button
              key={agent.id}
              className={`ca-rail-item ${view === "skills" && activeAgent === agent.id ? "is-active" : ""}`}
              onClick={() => onAgent(agent.id)}
              type="button"
            >
              <span style={{ color: agent.color, display: "grid", placeItems: "center" }}><Icon /></span>
              <span>{agent.name}</span>
              <span className="ca-rail-count">{counts[agent.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="ca-rail-section">
        <div className="ca-rail-heading">Plugins</div>
        <button
          className={`ca-rail-item ${view === "plugins" ? "is-active" : ""}`}
          onClick={() => onView("plugins")}
          type="button"
        >
          <span className="ca-rail-dot" style={{ background: "var(--accent)" }} />
          <span>Installed</span>
          <span className="ca-rail-count">{pluginCount}</span>
        </button>
        {pluginUpdateCount > 0 && (
          <button
            className="ca-rail-item"
            onClick={() => onView("plugins")}
            type="button"
          >
            <span className="ca-rail-dot" style={{ background: "var(--amber)" }} />
            <span className="ca-rail-warn">Updates</span>
            <span className="ca-rail-count">{pluginUpdateCount}</span>
          </button>
        )}
      </div>

      <div className="ca-rail-section">
        <div className="ca-rail-heading">Status</div>
        <button
          className={`ca-rail-item ${statusFilter === "drift" ? "is-active" : ""}`}
          onClick={() => onStatus(statusFilter === "drift" ? "all" : "drift")}
          type="button"
        >
          <span className="ca-rail-dot" style={{ background: "var(--amber)" }} />
          <span className="ca-rail-warn">Drift</span>
          <span className="ca-rail-count">{driftCount}</span>
        </button>
        <button
          className={`ca-rail-item ${statusFilter === "synced" ? "is-active" : ""}`}
          onClick={() => onStatus(statusFilter === "synced" ? "all" : "synced")}
          type="button"
        >
          <span className="ca-rail-dot" style={{ background: "var(--accent)" }} />
          <span>Synced</span>
          <span className="ca-rail-count">{total - driftCount}</span>
        </button>
      </div>

      <div className="ca-rail-section">
        <div className="ca-rail-heading">Paths</div>
        <div className="ca-rail-paths">
          {agents.map((agent) => (
            <div key={agent.id} title={scannedRoots[agent.id]?.join(", ") || agent.skillPath}>
              <span style={{ color: agent.color }}>● </span>
              {scannedRoots[agent.id]?.[0] || agent.skillPath}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────── Stats */
function StatsStrip({ total, drift, agentCounts, skills }: {
  total: number; drift: number; agentCounts: Record<AgentId, number>; skills: Skill[];
}) {
  const activeAgents = (Object.keys(agentCounts) as AgentId[]).filter((a) => agentCounts[a] > 0).length;
  const recent = skills.filter((s) => {
    const t = new Date(s.updatedAt).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t < 7 * 86_400_000;
  }).length;
  return (
    <div className="ca-stats">
      <div className="ca-stat">
        <span className="ca-stat-label">Total skills</span>
        <span className="ca-stat-value">{total}</span>
        <span className="ca-stat-sub">across all agents</span>
      </div>
      <div className="ca-stat">
        <span className="ca-stat-label">In drift</span>
        <span className="ca-stat-value" style={{ color: drift > 0 ? "var(--amber)" : undefined }}>{drift}</span>
        <span className="ca-stat-sub">{drift === 0 ? "all aligned" : "need attention"}</span>
      </div>
      <div className="ca-stat">
        <span className="ca-stat-label">Active agents</span>
        <span className="ca-stat-value">{activeAgents}<span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 400 }}> / {agents.length}</span></span>
        <span className="ca-stat-sub">scanning local folders</span>
      </div>
      <div className="ca-stat">
        <span className="ca-stat-label">Updated · 7d</span>
        <span className="ca-stat-value">{recent}</span>
        <span className="ca-stat-sub">recent changes</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── Skill row */
function SkillRow({ skill, selected, checked, onSelect, onCheck }: {
  skill: Skill; selected: boolean; checked: boolean; onSelect: () => void; onCheck: () => void;
}) {
  const status = computeStatus(skill);
  return (
    <button
      type="button"
      className={`ca-trow ${selected ? "is-selected" : ""} ${checked ? "is-checked" : ""}`}
      onClick={onSelect}
    >
      <div onClick={(e) => { e.stopPropagation(); onCheck(); }}>
        <span className={`ca-check ${checked ? "is-on" : ""}`} />
      </div>
      <div className="name">
        <b>{skill.name}</b>
        <span className="desc">{skill.summary}</span>
      </div>
      <div>
        <span className="ca-matrix">
          {agents.map((agent) => {
            const on = skill.agents.includes(agent.id);
            const Icon = AgentIcon[agent.id];
            return (
              <span key={agent.id} className={`dot ${on ? `is-on ${AGENT_TONE[agent.id]}` : ""}`} title={agent.name}>
                {on ? <Icon /> : null}
              </span>
            );
          })}
        </span>
      </div>
      <div style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {skill.owner}
      </div>
      <div>
        <span className={`ca-status s-${status}`}>
          <span className="pip" />
          {status === "synced" ? "Synced" : status === "drift" ? "Drift" : "Pending"}
        </span>
      </div>
      <div style={{ color: "var(--muted)", fontFamily: "Geist Mono, monospace", fontSize: 11.5 }}>
        {relativeTime(skill.updatedAt)}
      </div>
      <div className="more"><MoreHorizontal size={14} /></div>
    </button>
  );
}

/* ─────────────────────────────────────────── Bulk action bar */
function BulkBar({ count, onClear, onDelete }: { count: number; onClear: () => void; onDelete: () => void }) {
  return (
    <div className="ca-bulkbar" role="region" aria-label="Bulk actions">
      <span className="count"><b>{count}</b> selected</span>
      <button className="ca-btn ca-btn--ghost" type="button" disabled title="Bulk sync not implemented yet"><Copy size={13} /> Sync</button>
      <button className="ca-btn ca-btn--danger" type="button" onClick={onDelete}><Trash2 size={13} /> Delete</button>
      <button className="ca-btn ca-btn--ghost" type="button" onClick={onClear} title="Clear selection">
        <X size={13} />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────── Edit drawer */
function EditDrawer(props: {
  skill: Skill;
  status: Status;
  editAgent: AgentId;
  editName: string;
  editSummary: string;
  editContent: string;
  activeTab: Tab;
  viewMode: ViewMode;
  syncTargets: AgentId[];
  operationMessage: string;
  operationError: boolean;
  onClose: () => void;
  onEditAgent: (a: AgentId) => void;
  onName: (v: string) => void;
  onSummary: (v: string) => void;
  onContent: (v: string) => void;
  onTab: (t: Tab) => void;
  onViewMode: (m: ViewMode) => void;
  onToggleSync: (a: AgentId) => void;
  onToggleAllSync: () => void;
  onSave: () => void;
  onDelete: () => void;
  onSync: () => void;
}) {
  const { skill, status, editAgent, editName, editSummary, editContent, activeTab, viewMode,
    syncTargets, operationMessage, operationError } = props;

  const installedAgents = agents.filter((a) => Boolean(skill.paths[a.id]));
  const Icon = AgentIcon[editAgent];

  return (
    <aside className="ca-drawer" aria-label="Skill editor">
      <div className="ca-drawer-head">
        <div className="ca-drawer-eyebrow">
          <span>{skill.id.toUpperCase()}</span>
          <ChevronRight size={11} />
          <span>{editAgent}</span>
          {status === "drift" && (
            <span className="ca-drift-pill"><AlertTriangle /> Drift</span>
          )}
          <span style={{ flex: 1 }} />
          <button className="ca-btn ca-btn--ghost" style={{ height: 22, padding: "0 6px" }} type="button" onClick={props.onClose}>
            <X size={13} />
          </button>
        </div>
        <h2>{skill.name || "Untitled"}</h2>
        <div className="meta">
          <span><b>{skill.owner}</b></span>
          <span>v{skill.version}</span>
          <span>· {relativeTime(skill.updatedAt)}</span>
          <span>· {skill.agents.length}/{agents.length} agents</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {installedAgents.map((agent) => {
            const AIcon = AgentIcon[agent.id];
            const active = agent.id === editAgent;
            return (
              <button
                key={agent.id}
                type="button"
                className={`ca-btn ${active ? "" : "ca-btn--ghost"}`}
                style={{
                  height: 26, padding: "0 8px", fontSize: 11.5,
                  color: active ? "#0a0a0a" : agent.color,
                  background: active ? agent.color : "transparent",
                  borderColor: active ? agent.color : "var(--hairline)",
                }}
                onClick={() => props.onEditAgent(agent.id)}
              >
                <AIcon /> {agent.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ca-drawer-foot ca-drawer-foot--top">
        <div className="sync-targets">
          <span>Sync →</span>
          {(() => {
            const selectable = agents.filter((a) => a.id !== editAgent);
            const allOn = selectable.length > 0 && selectable.every((a) => syncTargets.includes(a.id));
            return (
              <button
                type="button"
                onClick={props.onToggleAllSync}
                className="ca-sync-all"
                title={allOn ? "Clear all" : "Select all"}
              >
                {allOn ? "Clear" : "All"}
              </button>
            );
          })()}
          {agents.map((agent) => {
            const AIcon = AgentIcon[agent.id];
            const on = syncTargets.includes(agent.id);
            const disabled = agent.id === editAgent;
            return (
              <button
                key={agent.id}
                type="button"
                disabled={disabled}
                onClick={() => props.onToggleSync(agent.id)}
                className={`ca-matrix`}
                style={{ background: "none", border: 0, padding: 0, opacity: disabled ? 0.35 : 1 }}
                title={agent.name}
              >
                <span className={`dot ${on ? `is-on ${AGENT_TONE[agent.id]}` : ""}`}><AIcon /></span>
              </button>
            );
          })}
        </div>
        <div className="actions">
          <button className="ca-btn ca-btn--ghost" type="button" onClick={props.onSync} disabled={!skill.paths[editAgent] || syncTargets.length === 0}>
            <Copy size={13} /> Sync
          </button>
          <button className="ca-btn ca-btn--danger" type="button" onClick={props.onDelete} disabled={!skill.paths[editAgent]}>
            <Trash2 size={13} />
          </button>
          <button className="ca-btn ca-btn--primary" type="button" onClick={props.onSave} disabled={!skill.paths[editAgent]}>
            <Save size={13} /> Save
          </button>
        </div>
      </div>

      <div className="ca-tabs">
        <button className={`ca-tab ${activeTab === "content" ? "is-active" : ""}`} type="button" onClick={() => props.onTab("content")}>Content</button>
        <button className={`ca-tab ${activeTab === "diff" ? "is-active" : ""}`} type="button" onClick={() => props.onTab("diff")}>
          Diff{status === "drift" ? " ●" : ""}
        </button>
        <button className={`ca-tab ${activeTab === "deploys" ? "is-active" : ""}`} type="button" onClick={() => props.onTab("deploys")}>Deploys</button>
      </div>

      {activeTab === "content" && (
        <div className="ca-content">
          <div className="ca-content-bar">
            <span className="ca-label mono" title={skill.paths[editAgent]}>
              <span style={{ color: agents.find((a) => a.id === editAgent)?.color }}><Icon /></span>
              <span style={{ marginLeft: 6 }}>{skill.paths[editAgent] || "not installed"}</span>
            </span>
            <span className="ca-segment">
              <button className={viewMode === "edit" ? "is-on" : ""} type="button" onClick={() => props.onViewMode("edit")}>Edit</button>
              <button className={viewMode === "preview" ? "is-on" : ""} type="button" onClick={() => props.onViewMode("preview")}>Preview</button>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
            <div className="ca-fields">
              <input
                className="ca-input"
                value={editName}
                onChange={(e) => props.onName(e.target.value)}
                placeholder="Skill name"
              />
              <textarea
                className="ca-textarea"
                value={editSummary}
                onChange={(e) => props.onSummary(e.target.value)}
                placeholder="Short description"
                rows={2}
              />
            </div>
            <div className="ca-editor">
              {viewMode === "edit" ? (
                <textarea
                  className="ca-textarea mono"
                  value={editContent}
                  onChange={(e) => props.onContent(e.target.value)}
                  placeholder="# Skill markdown..."
                />
              ) : (
                <pre className="ca-textarea mono" style={{ overflow: "auto", margin: 0 }}>
                  {editContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "diff" && (
        <DiffView skill={skill} editAgent={editAgent} />
      )}

      {activeTab === "deploys" && (
        <DeploysView skill={skill} editAgent={editAgent} onSelect={props.onEditAgent} />
      )}

      {operationMessage && (
        <div className={`ca-op-msg ${operationError ? "is-error" : ""}`}>{operationMessage}</div>
      )}
    </aside>
  );
}

function DiffView({ skill, editAgent }: { skill: Skill; editAgent: AgentId }) {
  const others = skill.agents.filter((a) => a !== editAgent);
  const compareAgent = others[0];
  const left = skill.contents?.[editAgent] ?? skill.content ?? "";
  const right = compareAgent ? skill.contents?.[compareAgent] ?? "" : "";
  return (
    <div className="ca-diff">
      <div className="ca-diff-pane">
        <div className="ca-diff-head">
          <span style={{ color: agents.find((a) => a.id === editAgent)?.color }}>●</span>
          {editAgent}
        </div>
        <pre className="ca-diff-body">{left || "—"}</pre>
      </div>
      <div className="ca-diff-pane">
        <div className="ca-diff-head">
          {compareAgent ? (
            <>
              <span style={{ color: agents.find((a) => a.id === compareAgent)?.color }}>●</span>
              {compareAgent}
            </>
          ) : "no other deployments"}
        </div>
        <pre className={`ca-diff-body ${!compareAgent ? "empty" : ""}`}>{compareAgent ? (right || "—") : "Install on another agent to compare"}</pre>
      </div>
    </div>
  );
}

function DeploysView({ skill, editAgent, onSelect }: { skill: Skill; editAgent: AgentId; onSelect: (a: AgentId) => void }) {
  return (
    <div style={{ padding: 14, overflow: "auto", display: "grid", gap: 8 }}>
      {agents.map((agent) => {
        const Icon = AgentIcon[agent.id];
        const installed = Boolean(skill.paths[agent.id]);
        const active = agent.id === editAgent;
        return (
          <button
            key={agent.id}
            type="button"
            disabled={!installed}
            onClick={() => onSelect(agent.id)}
            className={`ca-btn ${active ? "ca-btn--primary" : ""}`}
            style={{
              height: "auto", padding: "10px 12px", justifyContent: "flex-start",
              display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, textAlign: "left",
              background: active ? agent.color : "var(--surface-2)",
              color: active ? "#0a0a0a" : "var(--text)",
              borderColor: active ? agent.color : "var(--hairline)",
              opacity: installed ? 1 : 0.45,
            }}
          >
            <span style={{ color: active ? "#0a0a0a" : agent.color }}><Icon /></span>
            <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <b style={{ fontSize: 12.5 }}>{agent.name}</b>
              <code style={{ fontSize: 11, fontFamily: "Geist Mono, monospace", color: active ? "#0a0a0a" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {skill.paths[agent.id] || "not installed"}
              </code>
            </div>
            <span style={{ fontSize: 10.5, fontFamily: "Geist Mono, monospace", color: active ? "#0a0a0a" : "var(--muted)" }}>
              {installed ? "INSTALLED" : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────── Plugins Panel */
function PluginsPanel({ plugins, isLoading, loadError, marketplaceCount, onRefresh, skillCountByPlugin, onOpenInSkills }: {
  plugins: Plugin[];
  isLoading: boolean;
  loadError: string;
  marketplaceCount: number;
  onRefresh: () => void;
  skillCountByPlugin: Record<string, number>;
  onOpenInSkills: (pluginId: string) => void;
}) {
  const updates = plugins.filter((p) => p.updateAvailable).length;
  return (
    <section className="ca-main">
      <header className="ca-mainhead">
        <div>
          <div className="ca-crumb">
            <span>skillmgmt</span> <span style={{ color: "var(--dim)" }}>/</span> <b>plugins</b>
          </div>
          <h1>Installed plugins</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ca-btn ca-btn--ghost" type="button" onClick={onRefresh}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      {updates > 0 && (
        <div className="ca-update-banner">
          <AlertTriangle size={14} />
          <span><b>{updates}</b> plugin{updates > 1 ? "s have" : " has"} an update available.</span>
          <code>/plugin</code>
          <span className="ca-update-banner-sub">— run this in Claude Code to update.</span>
        </div>
      )}

      <div className="ca-stats">
        <div className="ca-stat">
          <span className="ca-stat-label">Plugins</span>
          <span className="ca-stat-value">{plugins.length}</span>
          <span className="ca-stat-sub">from {marketplaceCount} marketplaces</span>
        </div>
        <div className="ca-stat">
          <span className="ca-stat-label">Updates available</span>
          <span className="ca-stat-value" style={updates > 0 ? { color: "var(--amber)" } : undefined}>{updates}</span>
          <span className="ca-stat-sub">run /plugin to update</span>
        </div>
        <div className="ca-stat">
          <span className="ca-stat-label">User-scoped</span>
          <span className="ca-stat-value">{plugins.filter((p) => p.scope === "user").length}</span>
          <span className="ca-stat-sub">project: {plugins.filter((p) => p.scope === "project").length}</span>
        </div>
      </div>

      <div className="ca-table ca-table--plugins">
        <div className="ca-thead">
          <div>Plugin</div>
          <div>Version</div>
          <div>Marketplace</div>
          <div>Scope</div>
          <div>Components</div>
          <div>Updated</div>
        </div>
        <div className="ca-tbody">
          {isLoading && (
            <div className="ca-empty"><RefreshCw size={20} /><strong>Scanning plugin manifests…</strong></div>
          )}
          {loadError && (
            <div className="ca-empty error"><AlertTriangle size={20} /><strong>Could not load plugins</strong><span>{loadError}</span></div>
          )}
          {!isLoading && !loadError && plugins.length === 0 && (
            <div className="ca-empty"><Search size={20} /><strong>No plugins installed</strong><span>Use /plugin to install one.</span></div>
          )}
          {plugins.map((plugin) => (
            <PluginRow
              key={plugin.id}
              plugin={plugin}
              skillCount={skillCountByPlugin[plugin.id] ?? 0}
              onOpenInSkills={() => onOpenInSkills(plugin.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PluginRow({ plugin, skillCount, onOpenInSkills }: { plugin: Plugin; skillCount: number; onOpenInSkills: () => void }) {
  const { components } = plugin;
  const hasSkills = skillCount > 0 || components.skills > 0;
  return (
    <div
      className={`ca-row ca-row--plugin ${hasSkills ? "is-clickable" : ""}`}
      title={hasSkills ? `${plugin.description}\n\nClick to view bundled skills` : plugin.description}
      onClick={hasSkills ? onOpenInSkills : undefined}
      role={hasSkills ? "button" : undefined}
    >
      <div className="ca-row-skill">
        <strong>{plugin.name}</strong>
        <span className="ca-row-sub">{plugin.description}</span>
        {plugin.sourceRepo && <span className="ca-row-sub repo">{plugin.sourceRepo}</span>}
      </div>
      <div>
        <span className={plugin.updateAvailable ? "ca-pill warn" : "ca-pill"}>
          {plugin.version}
          {plugin.updateAvailable && plugin.latestVersion && <> → <b>{plugin.latestVersion}</b></>}
        </span>
      </div>
      <div>
        <span className="ca-row-sub">{plugin.marketplaceId}</span>
      </div>
      <div>
        <span className="ca-scope">{plugin.scope}</span>
      </div>
      <div>
        {skillCount > 0 ? (
          <span className="ca-skills-link">{skillCount} skill{skillCount > 1 ? "s" : ""} <ChevronRight size={12} /></span>
        ) : (
          <span className="ca-row-sub">
            {components.skills > 0 && `${components.skills} skills `}
            {components.agents > 0 && `${components.agents} agents `}
            {components.commands > 0 && `${components.commands} cmds `}
            {components.hooks > 0 && "hooks"}
            {components.skills + components.agents + components.commands + components.hooks === 0 && "—"}
          </span>
        )}
      </div>
      <div className="ca-row-sub">{relativeTime(plugin.lastUpdated)}</div>
    </div>
  );
}
