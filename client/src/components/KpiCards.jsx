import { useEffect, useRef, useState } from "react";

// Counts up to `value` over ~650ms on mount and whenever the value changes.
// Respects prefers-reduced-motion by snapping straight to the final value.
function useCountUp(value, duration = 650) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

function KpiValue({ value }) {
  const n = useCountUp(value);
  return <span className="kpi-value">{n.toLocaleString()}</span>;
}

// Trend chip + comparison label, e.g. "↑ +12  vs prior period".
function DeltaBadge({ delta }) {
  if (!delta || delta.value == null) return null;
  const v = delta.value;
  const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
  const arrow = v > 0 ? "↑" : v < 0 ? "↓" : "→";
  const sign = v > 0 ? "+" : "";
  return (
    <span className={`kpi-delta kpi-delta--${dir}`}>
      <span className="kpi-delta-chip">{arrow} {sign}{v.toLocaleString()}</span>
      <span className="kpi-delta-label">{delta.label}</span>
    </span>
  );
}

// Shared KPI card grid. `cards` is [{ label, value, dot, hero?, delta? }].
export default function KpiCards({ cards }) {
  return (
    <div className="grid-kpi">
      {cards.map((c) => (
        <div className={`card kpi-card${c.hero ? " kpi-card--hero" : ""}`} key={c.label}>
          <div className="kpi-indicator">
            <span className="kpi-dot" style={c.hero ? undefined : { background: c.dot }} />
            <span className="kpi-label">{c.label}</span>
          </div>
          <KpiValue value={c.value} />
          <DeltaBadge delta={c.delta} />
        </div>
      ))}
    </div>
  );
}
