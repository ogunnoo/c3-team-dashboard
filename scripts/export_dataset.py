#!/usr/bin/env python3
"""
Export a compact JSON dataset from the existing Flask app's SQLite database.

This is the *fast path* for baking data: it reads the already-synced
`data/teams.db` from the original Python project and writes
`client/public/data/dataset.json`, which the React app reads at runtime and
aggregates entirely client-side.

Usage:
    python scripts/export_dataset.py [path/to/teams.db] [output.json]

Defaults:
    db  = ../teams/data/teams.db   (relative to this repo)
    out = client/public/data/dataset.json
"""
import json
import os
import sqlite3
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DEFAULT_DB = os.path.normpath(os.path.join(REPO, "..", "teams", "data", "teams.db"))
DEFAULT_OUT = os.path.join(REPO, "client", "public", "data", "dataset.json")


def period_key(sort_date: str) -> str:
    if not sort_date:
        return ""
    try:
        dt = datetime.fromisoformat(sort_date.replace("Z", "+00:00"))
        start = ((dt.month - 1) // 2) * 2 + 1
        return f"{dt.year}-{start:02d}"
    except Exception:
        return ""


def export(db_path: str, out_path: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    campuses = [
        {"id": r["id"], "name": r["name"]}
        for r in c.execute("SELECT id, name FROM campuses ORDER BY name")
    ]

    names = {r["id"]: r["name"] for r in c.execute("SELECT id, name FROM people")}

    # ── Scheduling facts (collapsed) ─────────────────────────────────────────
    # One entry per (person, team, plan-campus, month, period, category, status).
    rows = []
    for r in c.execute(
        """
        SELECT pp.person_id AS p, t.name AS t, p.campus_id AS c,
               substr(p.sort_date,1,7) AS m, p.period_key AS pk,
               st.category AS g, pp.status AS s, COUNT(*) AS n
        FROM plan_people pp
        JOIN plans p          ON pp.plan_id        = p.id
        JOIN service_types st ON p.service_type_id = st.id
        JOIN teams t          ON pp.team_id        = t.id
        WHERE st.category IS NOT NULL
          AND p.sort_date IS NOT NULL AND p.sort_date != ''
        GROUP BY pp.person_id, t.name, p.campus_id, m, p.period_key, st.category, pp.status
        """
    ):
        rows.append({
            "p": r["p"], "t": r["t"], "c": r["c"], "m": r["m"],
            "pk": r["pk"], "g": r["g"], "s": r["s"], "n": r["n"],
        })

    # ── Roster facts (team membership; campus comes from the service type) ────
    roster = [
        {"p": r["p"], "t": r["t"], "c": r["c"], "g": r["g"]}
        for r in c.execute(
            """
            SELECT DISTINCT tm.person_id AS p, t.name AS t,
                   st.campus_id AS c, st.category AS g
            FROM team_members tm
            JOIN teams t          ON tm.team_id        = t.id
            JOIN service_types st ON t.service_type_id = st.id
            WHERE st.category IS NOT NULL
            """
        )
    ]

    # ── Team Orientation submissions (month only) ────────────────────────────
    orientations = []
    for r in c.execute(
        "SELECT person_id AS p, substr(submitted_at,1,7) AS m FROM orientations "
        "WHERE submitted_at IS NOT NULL AND submitted_at != ''"
    ):
        orientations.append({"p": r["p"], "m": r["m"]})

    # ── Coaches (group leaders) ──────────────────────────────────────────────
    coaches = [
        {"p": r["person_id"], "role": r["role"], "c": r["campus_id"]}
        for r in c.execute("SELECT person_id, role, campus_id FROM coach_roles")
    ]

    last = c.execute(
        "SELECT synced_at FROM sync_log WHERE status='success' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    last_synced = last["synced_at"][:16].replace("T", " ") if last else None

    conn.close()

    data = {
        "last_synced": last_synced,
        "campuses": campuses,
        "names": names,
        "rows": rows,
        "roster": roster,
        "orientations": orientations,
        "coaches": coaches,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    size = os.path.getsize(out_path) / 1024
    print(f"✓ wrote {out_path} ({size:.0f} KB)")
    print(f"  campuses={len(campuses)} people={len(names)} rows={len(rows)} "
          f"roster={len(roster)} orientations={len(orientations)} coaches={len(coaches)}")


if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB
    out = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    if not os.path.exists(db):
        sys.exit(f"DB not found: {db}")
    export(db, out)
