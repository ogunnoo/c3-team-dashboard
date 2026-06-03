import { useMemo, useState } from "react";
import ChartCanvas from "./Chart.jsx";
import KpiCards from "./KpiCards.jsx";
import { getMetrics, getTable, getCampusChart } from "../lib/transform.js";

const COLORS = {
  accepted: "#16a34a",
  declined: "#ef4444",
  unresponsive: "#f59e0b",
  once: "#16a34a",
  twice: "#4ade80",
  more: "#166534",
};

const FREQ_CLASS = {
  "Not scheduled": "freq--none",
  "Once / month": "freq--once",
  "Twice / month": "freq--twice",
  "3×+ / month": "freq--more",
};

const COLUMNS = [
  { col: "name", label: "Name" },
  { col: "team_name", label: "Team" },
  { col: "campus_name", label: "Campus" },
  { col: "frequency", label: "Frequency" },
];

function toCSV(rows) {
  const head = ["Name", "Team", "Campus", "Total Scheduled", "Accepted", "Declined", "Unresponsive", "Frequency"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push([
      r.name, r.team_name, r.campus_name, r.total_scheduled,
      r.accepted, r.declined, r.unresponsive, r.frequency,
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

export default function Scheduling({ data, filters }) {
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const metrics = useMemo(() => getMetrics(data, filters), [data, filters]);
  const table = useMemo(() => getTable(data, filters), [data, filters]);
  const showCampus = !filters.campusId;
  const campusRows = useMemo(
    () => (showCampus ? getCampusChart(data, filters) : []),
    [data, filters, showCampus]
  );

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...table].sort(
      (a, b) => dir * String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""))
    );
  }, [table, sortCol, sortDir]);

  function onSort(col) {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function exportCSV() {
    const blob = new Blob([toCSV(sorted)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team-members.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = [
    { label: "Team Members", value: metrics.total_members, dot: "#18181b" },
    { label: "Once / month", value: metrics.once, dot: "#16a34a" },
    { label: "Twice / month", value: metrics.twice, dot: "#22c55e" },
    { label: "3×+ / month", value: metrics.more, dot: "#4ade80" },
  ];

  const donutConfig = {
    type: "doughnut",
    data: {
      labels: ["Accepted", "Declined", "Unresponsive"],
      datasets: [{
        data: [metrics.accepted, metrics.declined, metrics.unresponsive],
        backgroundColor: [COLORS.accepted, COLORS.declined, COLORS.unresponsive],
        borderWidth: 2, borderColor: "#fff", hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "68%",
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 12 }, padding: 16, usePointStyle: true } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString()}` } },
      },
    },
  };

  const freqConfig = {
    type: "bar",
    data: {
      labels: ["Once", "Twice", "3× or more"],
      datasets: [{
        label: "People", data: [metrics.once, metrics.twice, metrics.more],
        backgroundColor: [COLORS.once, COLORS.twice, COLORS.more],
        borderRadius: 6, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x.toLocaleString()} people` } },
      },
      scales: {
        x: { grid: { color: "#f1f5f9" }, ticks: { precision: 0 } },
        y: { grid: { display: false } },
      },
    },
  };

  const campusConfig = {
    type: "bar",
    data: {
      labels: campusRows.map((r) => r.campus_name),
      datasets: [
        { label: "Accepted", data: campusRows.map((r) => r.accepted), backgroundColor: COLORS.accepted, borderRadius: 4 },
        { label: "Declined", data: campusRows.map((r) => r.declined), backgroundColor: COLORS.declined, borderRadius: 4 },
        { label: "Unresponsive", data: campusRows.map((r) => r.unresponsive), backgroundColor: COLORS.unresponsive, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { size: 12 }, padding: 16, usePointStyle: true } } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "#f1f5f9" }, ticks: { precision: 0 } },
      },
    },
  };

  return (
    <div className="space-y-5">
      <KpiCards cards={kpis} />

      <div className="grid-2">
        <div className="card">
          <p className="card-label">Response Breakdown</p>
          <div className="chart-wrap"><ChartCanvas config={donutConfig} /></div>
        </div>
        <div className="card">
          <p className="card-label">Serving Frequency</p>
          <div className="chart-wrap"><ChartCanvas config={freqConfig} /></div>
        </div>
      </div>

      {showCampus && (
        <div className="card">
          <p className="card-label">Campus Comparison</p>
          <div className="chart-wrap"><ChartCanvas config={campusConfig} /></div>
        </div>
      )}

      <div className="card card--flush">
        <div className="table-header">
          <p className="table-title">Team Members</p>
          <span className="table-count">
            {sorted.length ? `${sorted.length.toLocaleString()} member${sorted.length !== 1 ? "s" : ""}` : ""}
          </span>
          <button onClick={exportCSV} className="btn-ghost" style={{ marginLeft: "auto" }}>Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {COLUMNS.map(({ col, label }) => (
                  <th
                    key={col}
                    className={`sortable${col === sortCol ? " col-active" : ""}`}
                    onClick={() => onSort(col)}
                  >
                    {label}{" "}
                    <span className="sort-icon">
                      {col === sortCol ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td className="empty-cell" colSpan={4}>No records match the current filters.</td></tr>
              ) : (
                sorted.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td className="muted">{r.team_name}</td>
                    <td className="muted">{r.campus_name ?? "—"}</td>
                    <td><span className={`freq-badge ${FREQ_CLASS[r.frequency] ?? ""}`}>{r.frequency}</span></td>
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
