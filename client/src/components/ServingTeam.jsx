import { useMemo, useState } from "react";
import ChartCanvas from "./Chart.jsx";
import KpiCards from "./KpiCards.jsx";
import { Sparkline, StatusBadge, TargetInput } from "./StaffingBits.jsx";
import {
  getOrientationTrend,
  getActiveMembersTrend,
  getTeamsOverview,
  getCoachesByCampus,
} from "../lib/transform.js";

const ROLE_LABELS = {
  head_coach: "Head Coaches",
  coach: "Coaches",
  apprentice_coach: "Apprentice Coaches",
};
const ROLE_ORDER = ["head_coach", "coach", "apprentice_coach"];
const ROLE_COLORS = { head_coach: "#16a34a", coach: "#2563eb", apprentice_coach: "#d97706" };

function trendConfig(series, color) {
  return {
    type: "line",
    data: {
      labels: series.map((d) => d.month),
      datasets: [{
        data: series.map((d) => d.count),
        borderColor: color, backgroundColor: color + "22",
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y.toLocaleString()}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 11 } } },
        y: { grid: { color: "#f1f5f9" }, ticks: { precision: 0 }, beginAtZero: true },
      },
    },
  };
}

export default function ServingTeam({ data, targets, onSaveTarget }) {
  const [campusId, setCampusId] = useState("");

  const campuses = useMemo(() => getTeamsOverview(data, {}, null).campuses, [data]);
  const coaches = useMemo(() => getCoachesByCampus(data), [data]);
  const orientSeries = useMemo(() => getOrientationTrend(data, campusId || null), [data, campusId]);
  const activeSeries = useMemo(() => getActiveMembersTrend(data, campusId || null), [data, campusId]);
  const overview = useMemo(
    () => getTeamsOverview(data, targets, campusId || null, 12),
    [data, targets, campusId]
  );

  const campusName = useMemo(() => {
    if (!campusId) return null;
    const c = campuses.find((x) => x.id === campusId);
    return c ? c.name : null;
  }, [campusId, campuses]);

  const last = (arr) => (arr.length ? arr[arr.length - 1].count : 0);

  const coachTotal = useMemo(() => {
    let total = 0;
    for (const byCampus of Object.values(coaches.roles)) {
      if (campusName) total += byCampus[campusName] || 0;
      else for (const n of Object.values(byCampus)) total += n;
    }
    return total;
  }, [coaches, campusName]);

  const inNeed = overview.teams.filter((t) => t.in_need).length;

  const kpis = [
    { label: "Total Oriented", value: last(orientSeries), dot: "#6366f1" },
    { label: "Active Members", value: last(activeSeries), dot: "#16a34a" },
    { label: "Teams In Need", value: inNeed, dot: inNeed ? "#ef4444" : "#16a34a" },
    { label: "Coaches", value: coachTotal, dot: "#18181b" },
  ];

  const coachCampuses = campusName ? [campusName] : coaches.campuses;
  const coachConfig = {
    type: "bar",
    data: {
      labels: coachCampuses,
      datasets: ROLE_ORDER.filter((r) => coaches.roles[r]).map((role) => ({
        label: ROLE_LABELS[role] || role,
        data: coachCampuses.map((cp) => (coaches.roles[role] || {})[cp] || 0),
        backgroundColor: ROLE_COLORS[role],
        borderRadius: 4, maxBarThickness: 48,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12 } } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f1f5f9" } },
      },
    },
  };

  return (
    <div className="space-y-5">
      <div className="orient-filterbar">
        <span className="filter-label">Filter by</span>
        <select
          className="campus-filter"
          value={campusId}
          onChange={(e) => setCampusId(e.target.value)}
        >
          <option value="">All campuses</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <KpiCards cards={kpis} />

      <div className="grid-2">
        <div className="card">
          <p className="card-label">Total People Oriented (cumulative)</p>
          <div className="chart-wrap"><ChartCanvas config={trendConfig(orientSeries, "#6366f1")} /></div>
        </div>
        <div className="card">
          <p className="card-label">Active Sunday Team Members (rolling 3-month)</p>
          <div className="chart-wrap"><ChartCanvas config={trendConfig(activeSeries, "#16a34a")} /></div>
        </div>
      </div>

      <div className="card">
        <p className="card-label">Coaches by Campus</p>
        <div className="chart-wrap"><ChartCanvas config={coachConfig} /></div>
      </div>

      <div className="card card--flush">
        <div className="table-header">
          <p className="table-title">Team Staffing vs Target</p>
          <div className="table-header-right">
            <span className="table-count">{inNeed ? `${inNeed} in need` : "all staffed"}</span>
            <button
              type="button"
              className="icon-btn"
              title="Edit team targets"
              aria-label="Settings"
              onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Active (3&nbsp;mo)</th>
                <th>Target</th>
                <th>Trend (12&nbsp;mo)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {overview.teams.map((t) => (
                <tr key={t.team_name} className={`row-${t.status}`}>
                  <td>{t.team_name}</td>
                  <td className="muted">{t.active}</td>
                  <td><TargetInput team={t} onSave={onSaveTarget} /></td>
                  <td><Sparkline values={t.trend} status={t.status} /></td>
                  <td><StatusBadge team={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
