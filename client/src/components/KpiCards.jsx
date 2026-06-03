// Shared KPI card grid. `cards` is [{ label, value, dot }].
export default function KpiCards({ cards }) {
  return (
    <div className="grid-kpi">
      {cards.map((c) => (
        <div className="card kpi-card" key={c.label}>
          <div className="kpi-indicator">
            <span className="kpi-dot" style={{ background: c.dot }} />
            <span className="kpi-label">{c.label}</span>
          </div>
          <span className="kpi-value">{c.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
