import { useMemo } from "react";
import {
  getMetrics,
  getTeamsOverview,
  getActiveMembersTrend,
  getCoachesByCampus,
} from "../lib/transform.js";

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TeamIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.5-4.5" />
  </svg>
);

function Stat({ value, label, alert }) {
  return (
    <div>
      <div className={`home-stat-value${alert ? " is-alert" : ""}`}>{value}</div>
      <div className="home-stat-label">{label}</div>
    </div>
  );
}

export default function Home({ data, targets, onNavigate }) {
  // Scheduling headline stats (Sunday Services, all campuses/periods).
  const sched = useMemo(
    () => getMetrics(data, { category: "Sunday Services" }),
    [data]
  );
  const responses = sched.accepted + sched.declined + sched.unresponsive;
  const acceptRate = responses ? Math.round((sched.accepted / responses) * 100) : 0;

  // Serving Team headline stats.
  const overview = useMemo(() => getTeamsOverview(data, targets, null, 12), [data, targets]);
  const inNeed = overview.teams.filter((t) => t.in_need).length;
  const activeSeries = useMemo(() => getActiveMembersTrend(data, null), [data]);
  const activeNow = activeSeries.length ? activeSeries[activeSeries.length - 1].count : 0;
  const coaches = useMemo(() => getCoachesByCampus(data), [data]);
  const coachTotal = useMemo(() => {
    let n = 0;
    for (const byCampus of Object.values(coaches.roles))
      for (const c of Object.values(byCampus)) n += c;
    return n;
  }, [coaches]);

  const fmt = (n) => n.toLocaleString();

  return (
    <div className="space-y-5">
      <div className="home-hero">
        <p className="home-eyebrow">Overview</p>
        <h2 className="home-title">Welcome to the C3 Team Dashboard</h2>
        <p className="home-lede">
          A live read on how your teams are serving across every campus. Jump into a
          dashboard below to explore scheduling activity or track team staffing against
          targets.
        </p>
      </div>

      <div className="home-grid">
        <button type="button" className="home-card" onClick={() => onNavigate("scheduling")}>
          <div className="home-card-top">
            <span className="home-card-icon"><CalendarIcon /></span>
            <span className="home-card-title">Scheduling</span>
          </div>
          <p className="home-card-desc">
            Response breakdown, serving frequency and a sortable member roster — filter by
            service, campus, team and period, then export to CSV.
          </p>
          <div className="home-stats">
            <Stat value={fmt(sched.total_members)} label="Team Members" />
            <Stat value={`${acceptRate}%`} label="Accept Rate" />
            <Stat value={fmt(sched.more)} label="3×+ / Month" />
          </div>
          <span className="home-card-cta">Open Scheduling <Arrow /></span>
        </button>

        <button type="button" className="home-card" onClick={() => onNavigate("orientation")}>
          <div className="home-card-top">
            <span className="home-card-icon"><TeamIcon /></span>
            <span className="home-card-title">Serving Team</span>
          </div>
          <p className="home-card-desc">
            Orientation and active-member trends, coaches by campus, and team staffing versus
            target with at-a-glance traffic-light status.
          </p>
          <div className="home-stats">
            <Stat value={fmt(activeNow)} label="Active (3 mo)" />
            <Stat value={fmt(inNeed)} label="Teams In Need" alert={inNeed > 0} />
            <Stat value={fmt(coachTotal)} label="Coaches" />
          </div>
          <span className="home-card-cta">Open Serving Team <Arrow /></span>
        </button>
      </div>
    </div>
  );
}
