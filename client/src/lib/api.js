// Targets persistence. In production these hit the Netlify function backed by
// Netlify Blobs (/api/targets). When that endpoint isn't available (local
// `vite` dev with no functions server, or a fresh deploy), we fall back to
// localStorage so the editor still works.

const LS_KEY = "teamTargets";

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocal(targets) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(targets));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export async function getTargets() {
  try {
    const res = await fetch("/api/targets");
    if (res.ok) {
      const data = await res.json();
      const targets = data.targets || {};
      writeLocal(targets); // keep a local mirror for offline reloads
      return targets;
    }
  } catch {
    /* fall through to local */
  }
  return readLocal();
}

export async function setTarget(teamName, target) {
  const local = readLocal();
  if (target === "" || target == null) delete local[teamName];
  else local[teamName] = Number(target);
  writeLocal(local);

  try {
    await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_name: teamName, target }),
    });
  } catch {
    /* local mirror already updated */
  }
  return local;
}

// Bulk write — used by the "fill / reset to suggestions" buttons.
export async function setTargets(targets) {
  writeLocal(targets);
  try {
    await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets }),
    });
  } catch {
    /* local mirror already updated */
  }
  return targets;
}
