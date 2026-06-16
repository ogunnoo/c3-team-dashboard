// All dashboard aggregation, ported faithfully from the original Flask app's
// database.py. The React app loads the baked dataset.json once and derives
// every view client-side from these pure functions.

export const EXCLUDED_TEAMS = new Set(["baptism", "child dedications"]);

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── period helpers ───────────────────────────────────────────────────────────
export function periodLabel(key) {
  if (!key) return "";
  const [year, mm] = key.split("-");
  const m = parseInt(mm, 10);
  if (!m || m < 1 || m > 12) return key;
  return `${MONTHS[m - 1]} – ${MONTHS[m % 12]} ${year}`;
}

// ── month math (mirrors _month_shift / _month_span) ──────────────────────────
function monthShift(ym, n) {
  // n>0 = earlier
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(5, 7), 10);
  const idx = y * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function monthSpan(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = monthShift(cur, -1); // forward one month
  }
  return out;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── frequency buckets (mirrors _freq_label) ──────────────────────────────────
function freqLabel(total, months) {
  if (total === 0) return "Not scheduled";
  const avg = total / months;
  if (avg <= 1.5) return "Once / month";
  if (avg <= 2.5) return "Twice / month";
  return "3×+ / month";
}

// ── campus id → name ─────────────────────────────────────────────────────────
function campusNameMap(data) {
  const m = new Map();
  for (const c of data.campuses) m.set(c.id, c.name);
  return m;
}

// ── row filters (mirrors _build_parts) ───────────────────────────────────────
function filterRows(rows, { campusId, teamName, periodKey, category } = {}) {
  return rows.filter(
    (r) =>
      (!category || r.g === category) &&
      (!campusId || r.c === campusId) &&
      (!teamName || r.t === teamName) &&
      (!periodKey || r.pk === periodKey)
  );
}

function filterRoster(roster, { campusId, teamName, category } = {}) {
  // Roster is never restricted by period (matches the SQL roster_where).
  return roster.filter(
    (r) =>
      (!category || r.g === category) &&
      (!campusId || r.c === campusId) &&
      (!teamName || r.t === teamName)
  );
}

// ── filters dropdowns (mirrors get_filters) ──────────────────────────────────
export function getFilters(data, category = null) {
  const rows = filterRows(data.rows, { category });
  const campusIds = new Set();
  const teams = new Set();
  const periods = new Set();
  for (const r of rows) {
    if (r.c) campusIds.add(r.c);
    if (r.t) teams.add(r.t);
    if (r.pk) periods.add(r.pk);
  }
  const nameMap = campusNameMap(data);
  const campuses = [...campusIds]
    .map((id) => ({ id, name: nameMap.get(id) || id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    campuses,
    teams: [...teams].sort((a, b) => a.localeCompare(b)).map((name) => ({ name })),
    periods: [...periods]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ key, label: periodLabel(key) })),
    last_synced: data.last_synced,
  };
}

// ── KPI metrics (mirrors get_metrics) ────────────────────────────────────────
export function getMetrics(data, filters = {}) {
  const rows = filterRows(data.rows, filters);
  const roster = filterRoster(data.roster, filters);

  const scheduledPeople = new Set(rows.map((r) => r.p));
  const totalMembers = new Set([...scheduledPeople, ...roster.map((r) => r.p)]).size;

  let scheduled = 0, accepted = 0, declined = 0, unresponsive = 0;
  const perPerson = new Map();
  const months = new Set();
  for (const r of rows) {
    scheduled += r.n;
    if (r.s === "C") accepted += r.n;
    else if (r.s === "D") declined += r.n;
    else if (r.s === "U") unresponsive += r.n;
    perPerson.set(r.p, (perPerson.get(r.p) || 0) + r.n);
    if (r.m) months.add(r.m);
  }
  const numMonths = Math.max(months.size, 1);

  let once = 0, twice = 0, more = 0;
  for (const total of perPerson.values()) {
    const label = freqLabel(total, numMonths);
    if (label === "Once / month") once++;
    else if (label === "Twice / month") twice++;
    else if (label === "3×+ / month") more++;
  }

  const zero = new Set(
    roster.filter((r) => !scheduledPeople.has(r.p)).map((r) => r.p)
  ).size;

  return {
    total_members: totalMembers,
    scheduled, zero, accepted, declined, unresponsive,
    once, twice, more,
  };
}

// ── members table (mirrors get_table_data) ───────────────────────────────────
export function getTable(data, filters = {}) {
  const rows = filterRows(data.rows, filters);
  const nameMap = campusNameMap(data);

  const numMonths = Math.max(new Set(rows.map((r) => r.m).filter(Boolean)).size, 1);

  // group scheduled rows by person
  const byPerson = new Map();
  for (const r of rows) {
    let g = byPerson.get(r.p);
    if (!g) {
      g = { teams: new Set(), campuses: new Set(), total: 0, C: 0, D: 0, U: 0 };
      byPerson.set(r.p, g);
    }
    g.teams.add(r.t);
    if (r.c) g.campuses.add(nameMap.get(r.c) || r.c);
    g.total += r.n;
    if (r.s === "C") g.C += r.n;
    else if (r.s === "D") g.D += r.n;
    else if (r.s === "U") g.U += r.n;
  }

  const maxName = (set) => (set.size ? [...set].sort().slice(-1)[0] : null);
  const teamList = (set) => (set.size ? [...set].sort().join(", ") : null);

  const result = [];
  for (const [pid, g] of byPerson) {
    result.push({
      name: data.names[pid] || "",
      team_name: teamList(g.teams),
      campus_name: maxName(g.campuses),
      total_scheduled: g.total,
      accepted: g.C, declined: g.D, unresponsive: g.U,
      frequency: freqLabel(g.total, numMonths),
    });
  }

  // unscheduled roster members
  const roster = filterRoster(data.roster, filters);
  const scheduledPeople = new Set(byPerson.keys());
  const rosterByPerson = new Map();
  for (const r of roster) {
    if (scheduledPeople.has(r.p)) continue;
    let g = rosterByPerson.get(r.p);
    if (!g) {
      g = { teams: new Set(), campuses: new Set() };
      rosterByPerson.set(r.p, g);
    }
    g.teams.add(r.t);
    if (r.c) g.campuses.add(nameMap.get(r.c) || r.c);
  }
  for (const [pid, g] of rosterByPerson) {
    result.push({
      name: data.names[pid] || "",
      team_name: teamList(g.teams),
      campus_name: maxName(g.campuses),
      total_scheduled: 0,
      accepted: 0, declined: 0, unresponsive: 0,
      frequency: "Not scheduled",
    });
  }

  result.sort(
    (a, b) =>
      b.total_scheduled - a.total_scheduled ||
      (a.name || "").localeCompare(b.name || "")
  );
  return result;
}

// ── campus comparison chart (mirrors get_campus_chart_data) ──────────────────
export function getCampusChart(data, { teamName, periodKey, category } = {}) {
  const rows = filterRows(data.rows, { teamName, periodKey, category }).filter((r) => r.c);
  const nameMap = campusNameMap(data);
  const byCampus = new Map();
  for (const r of rows) {
    let g = byCampus.get(r.c);
    if (!g) {
      g = { campus_name: nameMap.get(r.c) || r.c, accepted: 0, declined: 0, unresponsive: 0 };
      byCampus.set(r.c, g);
    }
    if (r.s === "C") g.accepted += r.n;
    else if (r.s === "D") g.declined += r.n;
    else if (r.s === "U") g.unresponsive += r.n;
  }
  return [...byCampus.values()].sort((a, b) =>
    a.campus_name.localeCompare(b.campus_name)
  );
}

// ── person → primary campus (mirrors _person_primary_campus) ─────────────────
function personPrimaryCampus(data) {
  const counts = new Map(); // pid -> Map(campusId -> n)
  for (const r of data.rows) {
    if (!r.c) continue;
    let m = counts.get(r.p);
    if (!m) { m = new Map(); counts.set(r.p, m); }
    m.set(r.c, (m.get(r.c) || 0) + r.n);
  }
  const best = new Map();
  for (const [pid, m] of counts) {
    let bc = null, bn = -1;
    for (const [cid, n] of m) if (n > bn) { bn = n; bc = cid; }
    best.set(pid, bc);
  }
  return best;
}

// ── orientation trend (mirrors get_orientation_trend) ────────────────────────
export function getOrientationTrend(data, campusId = null) {
  // first submission month per person
  const firstMonth = new Map();
  for (const o of data.orientations) {
    if (!o.m) continue;
    const cur = firstMonth.get(o.p);
    if (cur === undefined || o.m < cur) firstMonth.set(o.p, o.m);
  }

  let entries = [...firstMonth.entries()];
  if (campusId) {
    const pc = personPrimaryCampus(data);
    entries = entries.filter(([pid]) => pc.get(pid) === campusId);
  }
  if (!entries.length) return [];

  const byMonth = new Map();
  for (const [, m] of entries) byMonth.set(m, (byMonth.get(m) || 0) + 1);

  const keys = [...byMonth.keys()].sort();
  const months = monthSpan(keys[0], keys[keys.length - 1]);
  let cum = 0;
  return months.map((m) => {
    cum += byMonth.get(m) || 0;
    return { month: m, count: cum };
  });
}

// ── active-by-month + rolling helpers ────────────────────────────────────────
function activeByMonth(rows, category, campusId) {
  const m2p = new Map();
  for (const r of rows) {
    if (r.g !== category) continue;
    if (campusId && r.c !== campusId) continue;
    if (!r.m) continue;
    let s = m2p.get(r.m);
    if (!s) { s = new Set(); m2p.set(r.m, s); }
    s.add(r.p);
  }
  return m2p;
}

function rollingActive(m2p, month, window = 3) {
  const active = new Set();
  for (let i = 0; i < window; i++) {
    const s = m2p.get(monthShift(month, i));
    if (s) for (const p of s) active.add(p);
  }
  return active;
}

// ── active members trend (mirrors get_active_members_trend) ──────────────────
export function getActiveMembersTrend(data, campusId = null, category = "Sunday Services") {
  const m2p = activeByMonth(data.rows, category, campusId);
  if (!m2p.size) return [];
  const keys = [...m2p.keys()].sort();
  const months = monthSpan(keys[0], keys[keys.length - 1]);
  return months.slice(2).map((m) => ({ month: m, count: rollingActive(m2p, m).size }));
}

// ── staffing status (mirrors _staffing_status) ───────────────────────────────
export function staffingStatus(active, target) {
  if (!target || target <= 0) return "none";
  const ratio = active / target;
  if (ratio >= 1.0) return "green";
  if (ratio >= 0.75) return "yellow";
  return "red";
}

function orientationCampuses(data, category = "Sunday Services") {
  const ids = new Set();
  for (const r of data.rows) if (r.g === category && r.c) ids.add(r.c);
  const nameMap = campusNameMap(data);
  return [...ids]
    .map((id) => ({ id, name: nameMap.get(id) || id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── teams overview (mirrors get_teams_overview) ──────────────────────────────
export function getTeamsOverview(data, targets = {}, campusId = null, monthsBack = 12) {
  const teamMonthPeople = new Map(); // team -> Map(ym -> Set(p))
  for (const r of data.rows) {
    if (r.g !== "Sunday Services") continue;
    if (campusId && r.c !== campusId) continue;
    if (!r.m) continue;
    if (EXCLUDED_TEAMS.has(r.t.trim().toLowerCase())) continue;
    let mm = teamMonthPeople.get(r.t);
    if (!mm) { mm = new Map(); teamMonthPeople.set(r.t, mm); }
    let s = mm.get(r.m);
    if (!s) { s = new Set(); mm.set(r.m, s); }
    s.add(r.p);
  }

  const cur = currentMonth();
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) months.push(monthShift(cur, i));

  const teams = [];
  for (const [team, mm] of teamMonthPeople) {
    const trend = months.map((m) => rollingActive(mm, m).size);
    const current = trend[trend.length - 1];
    const target = team in targets ? targets[team] : null;
    const suggested = trend.length ? Math.max(...trend) : current;
    teams.push({
      team_name: team,
      active: current,
      target,
      suggested,
      status: staffingStatus(current, target),
      in_need: target != null && current < target,
      trend,
    });
  }

  teams.sort(
    (a, b) =>
      Number(a.in_need ? 0 : 1) - Number(b.in_need ? 0 : 1) ||
      a.team_name.localeCompare(b.team_name)
  );

  return { months, teams, campuses: orientationCampuses(data), campus_id: campusId };
}

// suggested target = each team's 12-month peak (used to seed)
export function suggestedTargets(data) {
  const ov = getTeamsOverview(data, {}, null);
  const out = {};
  for (const t of ov.teams) out[t.team_name] = t.suggested;
  return out;
}

// ── connect groups ───────────────────────────────────────────────────────────
// "People on the team" = recently scheduled people (those appearing in rows),
// scoped by campus + team. Each is flagged in/out of a Connect Group. The donut
// reflects the campus+team universe; `status` ("in" | "out") filters the table.
export function getConnectGroups(data, { campusId, teamName, status } = {}) {
  const synced = Array.isArray(data.connect_groups);
  const inSet = new Set(data.connect_groups || []);
  const rows = filterRows(data.rows, { campusId, teamName });
  const nameMap = campusNameMap(data);

  const byPerson = new Map(); // pid -> { teams:Set, campuses:Set }
  for (const r of rows) {
    let g = byPerson.get(r.p);
    if (!g) { g = { teams: new Set(), campuses: new Set() }; byPerson.set(r.p, g); }
    g.teams.add(r.t);
    if (r.c) g.campuses.add(nameMap.get(r.c) || r.c);
  }

  let inCount = 0, outCount = 0;
  const people = [];
  for (const [pid, g] of byPerson) {
    const inGroup = inSet.has(pid);
    if (inGroup) inCount++; else outCount++;
    people.push({
      name: data.names[pid] || "",
      team_name: g.teams.size ? [...g.teams].sort().join(", ") : null,
      campus_name: g.campuses.size ? [...g.campuses].sort().slice(-1)[0] : null,
      in_group: inGroup,
    });
  }

  let tableRows = people;
  if (status === "in") tableRows = people.filter((p) => p.in_group);
  else if (status === "out") tableRows = people.filter((p) => !p.in_group);
  tableRows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const total = inCount + outCount;
  return {
    synced,
    total,
    in_count: inCount,
    out_count: outCount,
    in_pct: total ? Math.round((inCount / total) * 100) : 0,
    rows: tableRows,
  };
}

// ── coaches by campus (mirrors get_coaches_by_campus) ────────────────────────
export function getCoachesByCampus(data) {
  const nameMap = campusNameMap(data);
  const seen = new Set(); // role|campus|person to count distinct
  const roles = {};
  const campuses = new Set();
  for (const c of data.coaches) {
    const campus = c.c ? nameMap.get(c.c) || "Unassigned" : "Unassigned";
    const key = `${c.role}|${campus}|${c.p}`;
    if (seen.has(key)) continue;
    seen.add(key);
    campuses.add(campus);
    roles[c.role] = roles[c.role] || {};
    roles[c.role][campus] = (roles[c.role][campus] || 0) + 1;
  }
  return { campuses: [...campuses].sort((a, b) => a.localeCompare(b)), roles };
}
