import { useMemo } from "react";
import { StatusBadge, TargetInput } from "./StaffingBits.jsx";
import { getTeamsOverview, suggestedTargets } from "../lib/transform.js";

export default function Settings({ data, targets, onSaveTarget, onBulkSet }) {
  const overview = useMemo(() => getTeamsOverview(data, targets, null, 12), [data, targets]);

  const teams = useMemo(
    () => [...overview.teams].sort((a, b) => a.team_name.localeCompare(b.team_name)),
    [overview]
  );

  function applySuggested(overwrite) {
    const msg = overwrite
      ? "Reset every team's target to its suggested value?"
      : "Fill in targets for teams that don't have one yet?";
    if (!window.confirm(msg)) return;
    const suggested = suggestedTargets(data);
    const next = { ...targets };
    for (const [team, val] of Object.entries(suggested)) {
      if (overwrite || next[team] == null) next[team] = val;
    }
    onBulkSet(next);
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <p className="card-label">Team Targets</p>
        <p className="settings-help">
          Each team is assigned a <strong>suggested target</strong> equal to its highest
          rolling-3-month headcount over the last year. Adjust any value below — changes save
          automatically and flag the team on the <strong>Serving Team</strong> tab.
        </p>
        <div className="legend">
          <span className="legend-item"><span className="legend-dot legend-dot--green" /> On target (≥100%)</span>
          <span className="legend-item"><span className="legend-dot legend-dot--yellow" /> Close (75–99%)</span>
          <span className="legend-item"><span className="legend-dot legend-dot--red" /> Understaffed (&lt;75%)</span>
        </div>
        <div className="settings-actions">
          <button onClick={() => applySuggested(false)} className="btn-ghost">Fill empty targets with suggestions</button>
          <button onClick={() => applySuggested(true)} className="btn-ghost">Reset all to suggestions</button>
        </div>
      </div>

      <div className="card card--flush">
        <div className="table-header">
          <p className="table-title">All Teams</p>
          <span className="table-count">{teams.length} team{teams.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Active (3&nbsp;mo)</th>
                <th>Suggested</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.team_name} className={`row-${t.status}`}>
                  <td>{t.team_name}</td>
                  <td className="muted">{t.active}</td>
                  <td className="muted">{t.suggested ?? "—"}</td>
                  <td><TargetInput key={t.target ?? "empty"} team={t} onSave={onSaveTarget} /></td>
                  <td><StatusBadge team={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
