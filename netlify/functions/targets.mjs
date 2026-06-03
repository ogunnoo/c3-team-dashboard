// Editable team targets, persisted in Netlify Blobs.
//
// GET  /api/targets            -> { targets: { [teamName]: number } }
// POST /api/targets            -> set one  { team_name, target }   (target "" or null deletes)
//                              -> set many { targets: { ... } }    (replaces the whole map)
//
// Blobs need no setup on Netlify — the store is provisioned automatically.

import { getStore } from "@netlify/blobs";

const STORE = "team-targets";
const KEY = "targets";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function readTargets(store) {
  const data = await store.get(KEY, { type: "json" });
  return data && typeof data === "object" ? data : {};
}

export default async function handler(req) {
  let store;
  try {
    store = getStore(STORE);
  } catch (e) {
    return json({ error: "Blobs unavailable: " + e.message }, 500);
  }

  if (req.method === "GET") {
    const targets = await readTargets(store);
    return json({ targets });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // Bulk replace.
    if (body && typeof body.targets === "object" && body.targets !== null) {
      const clean = {};
      for (const [team, val] of Object.entries(body.targets)) {
        const n = Number(val);
        if (Number.isFinite(n) && n > 0) clean[team] = n;
      }
      await store.setJSON(KEY, clean);
      return json({ targets: clean });
    }

    // Single update.
    if (body && body.team_name) {
      const targets = await readTargets(store);
      if (body.target === "" || body.target == null) {
        delete targets[body.team_name];
      } else {
        const n = Number(body.target);
        if (!Number.isFinite(n)) return json({ error: "target must be a number" }, 400);
        targets[body.team_name] = n;
      }
      await store.setJSON(KEY, targets);
      return json({ targets });
    }

    return json({ error: "Provide { team_name, target } or { targets }" }, 400);
  }

  return json({ error: "Method not allowed" }, 405);
}
