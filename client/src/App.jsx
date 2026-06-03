import { useEffect, useMemo, useState } from "react";
import Scheduling from "./components/Scheduling.jsx";
import ServingTeam from "./components/ServingTeam.jsx";
import Settings from "./components/Settings.jsx";
import { getFilters } from "./lib/transform.js";
import { getTargets, setTarget as apiSetTarget, setTargets as apiSetTargets } from "./lib/api.js";

const CATEGORIES = ["", "Sunday Services", "Conference", "Events"];

export default function App() {
  const [data, setData] = useState(null);
  const [targets, setTargets] = useState({});
  const [error, setError] = useState("");
  const [tab, setTab] = useState("scheduling");

  // scheduling filter state
  const [category, setCategory] = useState("Sunday Services");
  const [campusId, setCampusId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [primed, setPrimed] = useState(false);

  // ── load baked dataset + targets ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/data/dataset.json");
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        setData(await res.json());
        setTargets(await getTargets());
      } catch (e) {
        setError("Could not load dashboard data: " + e.message);
      }
    })();
  }, []);

  // ── open Settings from the gear icon on the Serving Team tab ────────────────
  useEffect(() => {
    const open = () => setTab("settings");
    window.addEventListener("open-settings", open);
    return () => window.removeEventListener("open-settings", open);
  }, []);

  const filterOpts = useMemo(
    () => (data ? getFilters(data, category || null) : null),
    [data, category]
  );

  // Auto-select Downtown + most recent period on first successful load.
  useEffect(() => {
    if (!filterOpts || primed) return;
    const downtown = filterOpts.campuses.find((c) => c.name.toLowerCase().includes("downtown"));
    if (downtown) setCampusId(downtown.id);
    if (filterOpts.periods.length) setPeriodKey(filterOpts.periods[0].key);
    setPrimed(true);
  }, [filterOpts, primed]);

  // When category changes, drop selections no longer valid.
  useEffect(() => {
    if (!filterOpts) return;
    if (campusId && !filterOpts.campuses.some((c) => c.id === campusId)) setCampusId("");
    if (teamName && !filterOpts.teams.some((t) => t.name === teamName)) setTeamName("");
    if (periodKey && !filterOpts.periods.some((p) => p.key === periodKey)) setPeriodKey("");
  }, [filterOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveTarget(team, value) {
    const next = { ...targets };
    if (value === "" || value == null) delete next[team];
    else next[team] = Number(value);
    setTargets(next);
    await apiSetTarget(team, value);
  }

  async function handleBulkSet(next) {
    setTargets(next);
    await apiSetTargets(next);
  }

  if (error) {
    return (
      <>
        <Header lastSynced={null} />
        <div className="status-banner status-banner--red">
          <div className="status-banner-inner">{error}</div>
        </div>
      </>
    );
  }

  if (!data || !filterOpts) {
    return (
      <>
        <Header lastSynced={null} />
        <div className="app-loading">Loading dashboard…</div>
      </>
    );
  }

  const filters = { category: category || null, campusId, teamName, periodKey };

  return (
    <>
      <Header lastSynced={data.last_synced} />

      <nav className="tab-nav">
        <div className="tab-nav-inner">
          <button
            className={`tab-btn${tab === "scheduling" ? " tab-btn--active" : ""}`}
            onClick={() => setTab("scheduling")}
          >
            Scheduling
          </button>
          <button
            className={`tab-btn${tab === "orientation" ? " tab-btn--active" : ""}`}
            onClick={() => setTab("orientation")}
          >
            Serving Team
          </button>
        </div>
      </nav>

      {tab === "scheduling" && (
        <div className="filter-bar">
          <div className="filter-bar-inner">
            <span className="filter-label">Filter by</span>
            <select className="filter-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c || "All Services"}</option>
              ))}
            </select>
            <select className="filter-select" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
              <option value="">All Campuses</option>
              {filterOpts.campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="filter-select" value={teamName} onChange={(e) => setTeamName(e.target.value)}>
              <option value="">All Teams</option>
              {filterOpts.teams.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
            <select className="filter-select" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
              <option value="">All Periods</option>
              {filterOpts.periods.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <main className="main-content">
        {tab === "scheduling" && <Scheduling data={data} filters={filters} />}
        {tab === "orientation" && (
          <ServingTeam data={data} targets={targets} onSaveTarget={handleSaveTarget} />
        )}
        {tab === "settings" && (
          <Settings
            data={data}
            targets={targets}
            onSaveTarget={handleSaveTarget}
            onBulkSet={handleBulkSet}
          />
        )}
      </main>
    </>
  );
}

function Header({ lastSynced }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="flex items-center gap-3">
          <div className="logo-mark">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="app-title">C3 Team Dashboard</h1>
            <p className="app-subtitle">Service Scheduling Dashboard</p>
          </div>
        </div>
        {lastSynced && (
          <span className="sync-badge">
            <span className="sync-dot" />
            Synced <span className="sync-time">{lastSynced}</span>
          </span>
        )}
      </div>
    </header>
  );
}
