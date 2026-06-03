import { readFileSync } from "fs";
import * as T from "../client/src/lib/transform.js";

const data = JSON.parse(
  readFileSync(new URL("../client/public/data/dataset.json", import.meta.url))
);

function show(label, val) {
  console.log(label, JSON.stringify(val));
}

// METRICS for Sunday Services
const f = { category: "Sunday Services" };
show("METRICS_SS", T.getMetrics(data, f));

const table = T.getTable(data, f);
console.log("TABLE_SS_len", table.length);
show("TABLE_SS_first", table[0]);

const teams = T.getTeamsOverview(data, {}, null, 12);
console.log("TEAMS_count", teams.teams.length);
show("TEAMS_sample", teams.teams.slice(0, 3).map(t => ({
  name: t.team_name, active: t.active, sug: t.suggested, status: t.status
})));

const orient = T.getOrientationTrend(data, null);
console.log("ORIENT_last", orient[orient.length - 1]?.count);

const active = T.getActiveMembersTrend(data, null, "Sunday Services");
console.log("ACTIVE_last", active[active.length - 1]?.count);

// Campus-filtered (Hamilton) — find its id
const ham = data.campuses.find((c) => c.name === "Hamilton");
const hamOrient = T.getOrientationTrend(data, ham.id);
const hamActive = T.getActiveMembersTrend(data, ham.id, "Sunday Services");
console.log("HAM_orient", hamOrient[hamOrient.length - 1]?.count,
            "HAM_active", hamActive[hamActive.length - 1]?.count);

const coaches = T.getCoachesByCampus(data);
const coachTotals = {};
for (const role of Object.keys(coaches.roles))
  coachTotals[role] = Object.values(coaches.roles[role]).reduce((a, b) => a + b, 0);
show("COACH_totals", coachTotals);

const filters = T.getFilters(data, "Sunday Services");
console.log("FILTERS", filters.campuses.length, filters.teams.length, filters.periods.length);

show("CAMPUSCHART", T.getCampusChart(data, { category: "Sunday Services" }));
