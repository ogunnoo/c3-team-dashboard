import { useMemo, useState } from "react";
import ChartCanvas from "./Chart.jsx";
import KpiCards from "./KpiCards.jsx";
import { getConnectGroups, getFilters } from "../lib/transform.js";
import { chartColors } from "../lib/theme.js";

const STATUS_OPTIONS = [
  { value: "", label: "Everyone" },
  { value: "in", label: "In a Connect Group" },
  { value: "out", label: "Not in a Connect Group" },
];

export default function ConnectGroups({ data, theme }) {
  const [campusId, setCampusId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [status, setStatus] = useState("");

  const cc = chartColors(theme);
  const outColor = theme === "dark" ? "#33473d" : "#cdd9d2";

  const opts = useMemo(() => getFilters(data, null), [data]);
  const result = useMemo(
    () => getConnectGroups(data, { campusId, teamName, status }),
    [data, campusId, teamName, status]
  );

  const kpis = [
    { label: "People Scheduled", value: result.total, dot: "#18181b", hero: true },
    { label: "In a Connect Group", value: result.in_count, dot: cc.accepted },
    { label: "Not in a Group", value: result.out_count, dot: outColor },
  ];

  const gaugeConfig = {
    type: "doughnut",
    data: {
      labels: ["In a Connect Group", "Not in a Connect Group"],
      datasets: [{
        data: [result.in_count, result.out_count],
        backgroundColor: [cc.accepted, outColor],
        borderWidth: 2, borderColor: cc.surface, hoverOffset: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: "72%", circumference: 180, rotation: 270,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString()}` } },
      },
    },
  };

  return (
    <div className="space-y-5">
      <div className="orient-filterbar">
        <span className="filter-label">Filter by</span>
        <select className="campus-filter" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
          <option value="">All campuses</option>
          {opts.campuses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="campus-filter" value={teamName} onChange={(e) => setTeamName(e.target.value)}>
          <option value="">All teams</option>
          {opts.teams.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        <select className="campus-filter" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {!result.synced && (
        <div className="notice notice--warn">
          Connect Group data hasn’t been synced yet. Run the Planning Center sync
          (<code>npm run sync</code> with PCO credentials) to populate this tab.
        </div>
      )}

      <KpiCards cards={kpis} />

      <div className="grid-2">
        <div className="card">
          <p className="card-label">Connect Group Participation</p>
          <div className="gauge">
            <div className="chart-wrap chart-wrap--gauge"><ChartCanvas config={gaugeConfig} /></div>
            <div className="gauge-center">
              <span className="gauge-value">{result.in_pct}%</span>
              <span className="gauge-sub">In a Group</span>
            </div>
          </div>
          <div className="gauge-legend">
            <span className="gl-item"><span className="gl-dot" style={{ background: cc.accepted }} />In a Group <b>{result.in_count.toLocaleString()}</b></span>
            <span className="gl-item"><span className="gl-dot" style={{ background: outColor }} />Not in a Group <b>{result.out_count.toLocaleString()}</b></span>
          </div>
        </div>

        <div className="card connect-summary">
          <p className="card-label">Summary</p>
          <p className="connect-summary-lead">
            <b>{result.in_count.toLocaleString()}</b> of <b>{result.total.toLocaleString()}</b> scheduled
            {teamName ? ` ${teamName}` : ""} team members are in a Connect Group.
          </p>
          <p className="connect-summary-sub">
            {result.in_pct}% participation · {result.out_count.toLocaleString()} not yet connected.
          </p>
        </div>
      </div>

      <div className="card card--flush">
        <div className="table-header">
          <p className="table-title">People</p>
          <span className="table-count">
            {result.rows.length ? `${result.rows.length.toLocaleString()} ${result.rows.length === 1 ? "person" : "people"}` : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Team</th>
                <th className="hide-sm">Campus</th>
                <th>Connect Group</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr><td className="empty-cell" colSpan={4}>No people match the current filters.</td></tr>
              ) : (
                result.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td className="muted">{r.team_name ?? "—"}</td>
                    <td className="muted hide-sm">{r.campus_name ?? "—"}</td>
                    <td>
                      <span className={`status-pill ${r.in_group ? "status-pill--ok" : "status-pill--neutral"}`}>
                        {r.in_group ? "In a group" : "Not in a group"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
