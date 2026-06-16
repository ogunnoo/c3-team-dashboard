// Build-time PCO sync → bakes client/public/data/dataset.json directly from the
// Planning Center API, with no SQLite in between. This is a faithful JS port of
// the original sync.py + export_dataset.py: it fetches the same resources,
// derives the same campus/category/period mappings, and emits the exact same
// dataset shape the React app expects.
//
// Usage (needs PCO_APP_ID / PCO_SECRET in the environment):
//     node scripts/build-data.mjs [output.json]
//
// On Netlify this runs as part of the build (see netlify.toml). If the PCO
// credentials are absent it exits 0 without touching the committed dataset, so
// deploys still succeed using the last baked snapshot.

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { PCOClient } from "../shared/pco.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const DEFAULT_OUT = resolve(REPO, "client", "public", "data", "dataset.json");

// Team Orientation form in Planning Center People.
const TEAM_ORIENTATION_FORM_ID = "991394";

// Group types whose group LEADERS are the coaches, mapped to a role key.
const COACH_GROUP_TYPES = {
  "Coach Group": "coach",
  "Head Coach Group": "head_coach",
  "Apprentice Coach Group": "apprentice_coach",
};

// Group type whose members are tracked for the Connect Groups tab. Every person
// in any group of this type is considered "in a Connect Group".
const CONNECT_GROUP_TYPE = "Connect Groups";

const log = (msg) => console.log(msg);

// ── mappings (ports of database.derive_category / sync.get_period_key) ────────
function deriveCategory(name) {
  const n = (name || "").toUpperCase();
  if (n.includes("SUNDAY SERVICE")) return "Sunday Services";
  if (n.includes("CONFERENCE")) return "Conference";
  if (n.includes("EVENT") || n.includes("EVENTOS")) return "Events";
  return null;
}

function periodKey(sortDate) {
  if (!sortDate) return "";
  const dt = new Date(sortDate.replace("Z", "+00:00"));
  if (isNaN(dt)) return "";
  const month = dt.getUTCMonth() + 1; // 1-12
  const start = (Math.floor((month - 1) / 2)) * 2 + 1;
  return `${dt.getUTCFullYear()}-${String(start).padStart(2, "0")}`;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function nowStamp() {
  // "YYYY-MM-DD HH:MM" — mirrors the Python export's last_synced format.
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export async function buildDataset(client) {
  // ── 1. Campuses ────────────────────────────────────────────────────────────
  log("Syncing campuses…");
  const campusesRaw = await client.getCampuses();
  const campusName = new Map(); // id -> name
  const campusIdByName = new Map(); // UPPER(name) -> id
  for (const c of campusesRaw) {
    const name = c.attributes?.name || "";
    campusName.set(c.id, name);
    campusIdByName.set(name.toUpperCase(), c.id);
  }

  const campusFromServiceTypeName = (stName) => {
    if (!stName.includes("//")) return null;
    const suffix = stName.split("//").pop().trim().toUpperCase();
    if (campusIdByName.has(suffix)) return campusIdByName.get(suffix);
    for (const [cn, cid] of campusIdByName) {
      if (cn.includes(suffix) || suffix.includes(cn)) return cid;
    }
    return null;
  };

  // ── 2. Service types ───────────────────────────────────────────────────────
  log("Syncing service types…");
  const serviceTypes = await client.getServiceTypes();
  const stInfo = new Map(); // stId -> { name, campusId, category }
  for (const st of serviceTypes) {
    const name = st.attributes?.name || "";
    stInfo.set(st.id, {
      name,
      campusId: campusFromServiceTypeName(name),
      category: deriveCategory(name),
    });
  }

  // ── 3. Teams + rosters ─────────────────────────────────────────────────────
  const teamInfo = new Map(); // teamId -> { name, serviceTypeId }
  const people = new Map(); // personId -> name
  const teamMembers = new Set(); // `${teamId}|${personId}`
  for (let i = 0; i < serviceTypes.length; i++) {
    const st = serviceTypes[i];
    const stName = st.attributes?.name || "Unknown";
    log(`Syncing teams for '${stName}' (${i + 1}/${serviceTypes.length})…`);
    for (const team of await client.getTeams(st.id)) {
      teamInfo.set(team.id, { name: team.attributes?.name || "", serviceTypeId: st.id });
      for (const person of await client.getTeamPeople(team.id)) {
        const a = person.attributes || {};
        const name = a.full_name || `${a.first_name || ""} ${a.last_name || ""}`.trim();
        people.set(person.id, name);
        teamMembers.add(`${team.id}|${person.id}`);
      }
    }
  }

  // ── 4. Plans + scheduled people ────────────────────────────────────────────
  const now = new Date();
  const cutoffStart = ymd(new Date(now.getTime() - 730 * 86400000));
  const cutoffEnd = ymd(new Date(now.getTime() + 180 * 86400000));

  // plan_people keyed by assignment id (mirrors INSERT OR REPLACE on PK).
  const planPeople = new Map(); // tmId -> { personId, teamId, status, campusId, sortDate, pk, category }

  for (let i = 0; i < serviceTypes.length; i++) {
    const st = serviceTypes[i];
    const stName = st.attributes?.name || "Unknown";
    const campusId = stInfo.get(st.id).campusId;
    const category = stInfo.get(st.id).category;
    log(`Fetching plans for '${stName}' (${i + 1}/${serviceTypes.length})…`);
    const allPlans = await client.getPlans(st.id);
    const inWindow = allPlans.filter((p) => {
      const sd = p.attributes?.sort_date || "";
      return sd && sd.slice(0, 10) >= cutoffStart && sd.slice(0, 10) <= cutoffEnd;
    });
    log(`  → ${inWindow.length} plans in range, syncing team members…`);

    for (let j = 0; j < inWindow.length; j++) {
      const plan = inWindow[j];
      const sortDate = plan.attributes?.sort_date || "";
      const pk = periodKey(sortDate);
      for (const tm of await client.getPlanTeamMembers(plan.id)) {
        const personRel = tm.relationships?.person?.data;
        const teamRel = tm.relationships?.team?.data;
        if (!personRel || !teamRel) continue;
        if (tm.attributes?.name) people.set(personRel.id, tm.attributes.name);
        planPeople.set(tm.id, {
          personId: personRel.id,
          teamId: teamRel.id,
          status: tm.attributes?.status || "U",
          campusId,
          sortDate,
          pk,
          category,
        });
      }
      if ((j + 1) % 25 === 0) log(`  ${j + 1}/${inWindow.length} plans processed…`);
    }
  }

  // ── 5. Team Orientation submissions ────────────────────────────────────────
  log("Syncing Team Orientation submissions…");
  const subs = await client.getFormSubmissions(TEAM_ORIENTATION_FORM_ID);
  const orientations = []; // { p, m }
  for (const sub of subs) {
    const personRel = sub.relationships?.person?.data;
    const submittedAt = sub.attributes?.created_at || "";
    if (!personRel || !submittedAt) continue;
    orientations.push({ p: personRel.id, m: submittedAt.slice(0, 7) });
  }
  log(`  → ${orientations.length} orientation submissions`);

  // ── 6. Coaches + Connect Group members (from Groups) ───────────────────────
  log("Syncing coaches and Connect Group members from Groups…");
  const groupTypes = await client.getGroupTypes();
  const coachRoles = new Map(); // `${personId}|${role}` -> { p, role, c }
  const campusCache = new Map();
  const connectMembers = new Set(); // person IDs in any Connect Group
  for (const gt of groupTypes) {
    const gtName = gt.attributes?.name || "";
    const role = COACH_GROUP_TYPES[gtName];
    const isConnect = gtName === CONNECT_GROUP_TYPE;
    if (!role && !isConnect) continue;
    const groups = await client.getGroups(gt.id);
    log(`  ${gtName}: ${groups.length} groups`);
    for (const g of groups) {
      for (const m of await client.getGroupMemberships(g.id)) {
        const pid = m.relationships?.person?.data?.id || null;
        if (!pid) continue;
        if (isConnect) {
          connectMembers.add(pid);
          continue;
        }
        if ((m.attributes?.role || "").toLowerCase() !== "leader") continue;
        if (!campusCache.has(pid)) {
          try {
            campusCache.set(pid, await client.getPersonCampus(pid));
          } catch {
            campusCache.set(pid, null);
          }
        }
        coachRoles.set(`${pid}|${role}`, { p: pid, role, c: campusCache.get(pid) });
      }
    }
  }
  log(`  → ${coachRoles.size} coach role assignments, ${connectMembers.size} Connect Group members`);

  // ── Collapse into the dataset shape (mirrors export_dataset.py) ─────────────
  // rows: GROUP BY (person, team-name, plan-campus, month, period, category, status)
  const rowAgg = new Map();
  for (const pp of planPeople.values()) {
    if (!pp.category) continue;
    if (!pp.sortDate) continue;
    const team = teamInfo.get(pp.teamId);
    if (!team) continue;
    const m = pp.sortDate.slice(0, 7);
    const c = pp.campusId || null;
    const key = `${pp.personId}\t${team.name}\t${c || ""}\t${m}\t${pp.pk}\t${pp.category}\t${pp.status}`;
    let row = rowAgg.get(key);
    if (!row) {
      row = { p: pp.personId, t: team.name, c, m, pk: pp.pk, g: pp.category, s: pp.status, n: 0 };
      rowAgg.set(key, row);
    }
    row.n += 1;
  }
  const rows = [...rowAgg.values()];

  // roster: DISTINCT (person, team-name, service-type-campus, category)
  const rosterSet = new Map();
  for (const key of teamMembers) {
    const [teamId, personId] = key.split("|");
    const team = teamInfo.get(teamId);
    if (!team) continue;
    const st = stInfo.get(team.serviceTypeId);
    if (!st || !st.category) continue;
    const c = st.campusId || null;
    const rk = `${personId}\t${team.name}\t${c || ""}\t${st.category}`;
    if (!rosterSet.has(rk)) {
      rosterSet.set(rk, { p: personId, t: team.name, c, g: st.category });
    }
  }
  const roster = [...rosterSet.values()];

  const names = {};
  for (const [id, name] of people) names[id] = name;

  const campuses = [...campusName.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    last_synced: nowStamp(),
    campuses,
    names,
    rows,
    roster,
    orientations,
    coaches: [...coachRoles.values()],
    connect_groups: [...connectMembers],
  };
}

async function main() {
  const out = process.argv[2] || DEFAULT_OUT;

  if (!process.env.PCO_APP_ID || !process.env.PCO_SECRET) {
    console.warn(
      "⚠ PCO_APP_ID / PCO_SECRET not set — skipping live sync, " +
        "keeping the committed dataset.json."
    );
    if (!existsSync(out)) {
      console.error(`✗ No existing dataset at ${out} and no credentials to build one.`);
      process.exit(1);
    }
    return; // graceful no-op
  }

  const client = new PCOClient();
  const data = await buildDataset(client);

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data));
  const kb = Buffer.byteLength(JSON.stringify(data)) / 1024;
  console.log(`✓ wrote ${out} (${kb.toFixed(0)} KB)`);
  console.log(
    `  campuses=${data.campuses.length} people=${Object.keys(data.names).length} ` +
      `rows=${data.rows.length} roster=${data.roster.length} ` +
      `orientations=${data.orientations.length} coaches=${data.coaches.length}`
  );
}

// Only run when executed directly (not when imported by a test).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => {
    console.error("✗ build-data failed:", e.message);
    process.exit(1);
  });
}
