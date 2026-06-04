const STATUS_COLOR = { green: "#16a34a", yellow: "#d97706", red: "#dc2626", none: "#6366f1" };
const STATUS_FILL = { green: "g", yellow: "y", red: "r" };

// Active-vs-target progress bar: fill scales with attainment %, a tick marks the
// target (100%), and the meta line spells out active / target · % · shortfall.
export function StaffingBar({ team }) {
  const { active, target, status } = team;
  if (target == null || target === 0) {
    return (
      <div className="staff-bar-wrap">
        <div className="staff-bar"><span className="staff-fill staff-fill--none" /></div>
        <div className="staff-meta"><b>{active}</b> active · no target set</div>
      </div>
    );
  }
  const pct = Math.round((active / target) * 100);
  const fillWidth = Math.min(pct, 100);
  // When over target, the tick sits inside the (capped) bar at target's position.
  const tickLeft = pct > 100 ? `${(10000 / pct).toFixed(1)}%` : "100%";
  const short = target - active;
  const cls = STATUS_FILL[status] || "none";
  return (
    <div className="staff-bar-wrap">
      <div className="staff-bar">
        <span className={`staff-fill staff-fill--${cls}`} style={{ width: `${fillWidth}%` }} />
        <span className="staff-tick" style={{ left: tickLeft }} />
      </div>
      <div className="staff-meta">
        <b>{active}</b> / {target} · {pct}%{short > 0 ? ` · ${short} short` : ""}
      </div>
    </div>
  );
}

export function Sparkline({ values, status }) {
  if (!values || !values.length) return null;
  const w = 90, h = 22;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * (w - 2) + 1;
      const y = h - 1 - ((v - min) / range) * (h - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = STATUS_COLOR[status] || STATUS_COLOR.none;
  return (
    <svg width={w} height={h} className="sparkline">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

export function StatusBadge({ team }) {
  if (team.target == null || team.target === 0)
    return <span className="status-pill status-pill--neutral">No target</span>;
  const pct = Math.round((team.active / team.target) * 100);
  const short = team.target - team.active;
  const map = {
    green: ["status-pill--ok", `On target · ${pct}%`],
    yellow: ["status-pill--warn", `${pct}% · ${short} short`],
    red: ["status-pill--need", `${pct}% · ${short} short`],
  };
  const [cls, label] = map[team.status] || ["status-pill--neutral", "—"];
  return <span className={`status-pill ${cls}`}>{label}</span>;
}

// Controlled target <input> that commits on blur / Enter via onSave.
export function TargetInput({ team, onSave }) {
  return (
    <input
      type="number"
      min="0"
      className="target-input"
      defaultValue={team.target ?? ""}
      placeholder={team.suggested ?? "—"}
      onBlur={(e) => onSave(team.team_name, e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
    />
  );
}
