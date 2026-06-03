// Exercises buildDataset() against a synthetic mock PCO client to confirm the
// field-mapping + collapse logic produces the exact dataset shape the React app
// (and transform.js) expect. No network / credentials needed.
import { buildDataset } from "./build-data.mjs";

// Build sort_dates relative to "now" so they land inside the 2yr/6mo window.
const d = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString();
const SD1 = d(-10); // recent
const SD2 = d(-40);

const mock = {
  async getCampuses() {
    return [
      { id: "C_DT", attributes: { name: "Downtown" } },
      { id: "C_MT", attributes: { name: "Midtown" } },
    ];
  },
  async getServiceTypes() {
    return [
      { id: "ST1", attributes: { name: "Sunday Services // Downtown" } },
      { id: "ST2", attributes: { name: "Sunday Services // Midtown" } },
      { id: "ST3", attributes: { name: "Internal Meetings" } }, // category null -> excluded
    ];
  },
  async getTeams(stId) {
    return { ST1: [{ id: "T1", attributes: { name: "Hosting" } }],
             ST2: [{ id: "T2", attributes: { name: "Production" } }],
             ST3: [{ id: "T3", attributes: { name: "Staff" } }] }[stId] || [];
  },
  async getTeamPeople(teamId) {
    return { T1: [{ id: "P1", attributes: { full_name: "Ada Lovelace" } }],
             T2: [{ id: "P2", attributes: { first_name: "Alan", last_name: "Turing" } }],
             T3: [{ id: "P9", attributes: { full_name: "Grace Hopper" } }] }[teamId] || [];
  },
  async getPlans(stId) {
    return { ST1: [{ id: "PL1", attributes: { sort_date: SD1 } },
                   { id: "PL2", attributes: { sort_date: SD2 } }],
             ST2: [{ id: "PL3", attributes: { sort_date: SD1 } }],
             ST3: [{ id: "PL4", attributes: { sort_date: SD1 } }] }[stId] || [];
  },
  async getPlanTeamMembers(planId) {
    const mk = (id, pid, tid, status) => ({
      id, attributes: { status },
      relationships: { person: { data: { id: pid } }, team: { data: { id: tid } } },
    });
    // P1 serves twice in PL1 (accepted) -> collapses to n=2; once in PL2 (declined).
    return {
      PL1: [mk("a1", "P1", "T1", "C"), mk("a2", "P1", "T1", "C")],
      PL2: [mk("a3", "P1", "T1", "D")],
      PL3: [mk("a4", "P2", "T2", "U")],
      PL4: [mk("a5", "P9", "T3", "C")], // excluded category
    }[planId] || [];
  },
  async getFormSubmissions() {
    return [
      { id: "S1", attributes: { created_at: "2026-01-15T10:00:00Z" }, relationships: { person: { data: { id: "P1" } } } },
      { id: "S2", attributes: { created_at: "" }, relationships: { person: { data: { id: "P2" } } } }, // skipped
    ];
  },
  async getGroupTypes() {
    return [
      { id: "GT1", attributes: { name: "Head Coach Group" } },
      { id: "GT2", attributes: { name: "Random Group" } }, // ignored
    ];
  },
  async getGroups(gtId) {
    return gtId === "GT1" ? [{ id: "G1" }] : [];
  },
  async getGroupMemberships() {
    return [
      { attributes: { role: "leader" }, relationships: { person: { data: { id: "P1" } } } },
      { attributes: { role: "member" }, relationships: { person: { data: { id: "P2" } } } }, // not a leader
    ];
  },
  async getPersonCampus() {
    return "C_DT";
  },
};

function assert(cond, msg) {
  if (!cond) { console.error("✗ " + msg); process.exitCode = 1; }
  else console.log("✓ " + msg);
}

const data = await buildDataset(mock);

assert(data.campuses.length === 2, `campuses=2 (got ${data.campuses.length})`);
assert(data.campuses[0].name === "Downtown", "campuses sorted by name");
assert(Object.keys(data.names).length === 3, `names=3 (got ${Object.keys(data.names).length})`);
assert(data.names.P2 === "Alan Turing", "name built from first+last");

// rows: excluded category (Staff/P9) must NOT appear.
assert(!data.rows.some((r) => r.t === "Staff"), "excluded-category rows dropped");
const p1Accepted = data.rows.find((r) => r.p === "P1" && r.s === "C");
assert(p1Accepted && p1Accepted.n === 2, `P1 accepted collapses to n=2 (got ${p1Accepted?.n})`);
assert(p1Accepted.c === "C_DT" && p1Accepted.g === "Sunday Services", "plan campus + category mapped");
const p1Declined = data.rows.find((r) => r.p === "P1" && r.s === "D");
assert(p1Declined && p1Declined.n === 1, "P1 declined n=1");

// roster: P9 (excluded ST3) dropped; P1 Downtown, P2 Midtown.
assert(!data.roster.some((r) => r.p === "P9"), "roster excludes null-category team");
const rP2 = data.roster.find((r) => r.p === "P2");
assert(rP2 && rP2.c === "C_MT" && rP2.t === "Production", "roster campus from service type");

// orientations: only the one with a real timestamp.
assert(data.orientations.length === 1 && data.orientations[0].m === "2026-01", `orientations=1 month 2026-01`);

// coaches: only the leader in a recognised coach group.
assert(data.coaches.length === 1 && data.coaches[0].role === "head_coach" && data.coaches[0].c === "C_DT",
  "coaches: one head_coach leader with campus");

assert(typeof data.last_synced === "string" && data.last_synced.length === 16, "last_synced stamped");

console.log(process.exitCode ? "\nFAILED" : "\nALL PASSED");
