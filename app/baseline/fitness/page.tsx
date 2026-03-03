// app/baseline/fitness/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import {
  fetchReadinessStatus,
  fetchRunConsistency,
  fetchLongRunProgression,
  fetchLoadRecoveryBalance,
  fetchRaceReadiness,
} from "@/lib/data/fitness";

const USER_ID = "agrey127@gmail.com";

function n(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}
function fmt1(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? x.toFixed(1) : "—";
}
function fmt0(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? Math.round(x).toString() : "—";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return d.slice(0, 10);
}

function dotColor(color: string | null | undefined) {
  const c = (color ?? "gray").toLowerCase();
  const map: Record<string, string> = {
    green: "rgba(34,197,94,0.92)",
    yellow: "rgba(234,179,8,0.92)",
    orange: "rgba(249,115,22,0.92)",
    red: "rgba(239,68,68,0.92)",
    gray: "rgba(148,163,184,0.9)",
  };
  return map[c] ?? map.gray;
}

function bandPanel(band: string | null | undefined) {
  const b = (band ?? "red").toLowerCase();
  const map: Record<string, { bg: string; border: string }> = {
    green: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.40)" },
    yellow: { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.40)" },
    orange: { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.40)" },
    red: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.40)" },
  };
  return map[b] ?? map.red;
}

function uniqTop(items: string[], limit = 3) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const k = it.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= limit) break;
  }
  return out;
}

export default async function FitnessPage() {
  const [gate, consistency, longrun, balance, race] = await Promise.all([
    fetchReadinessStatus(USER_ID),
    fetchRunConsistency(USER_ID),
    fetchLongRunProgression(USER_ID),
    fetchLoadRecoveryBalance(USER_ID),
    fetchRaceReadiness(USER_ID),
  ]);

  const gateColor = (gate?.readiness_color ?? "gray").toLowerCase();
  const band = ((race as any)?.readiness_band ?? "red").toLowerCase() as string; // keeps build happy even if type lags
  const panel = bandPanel(band);

  // ---- Actionables (score-driven, not metric soup) ----
  const drivers = (race?.drivers ?? []).map((s) => (s ?? "").toString());
  const actionables: string[] = [];

  const runs7dBelow = drivers.some((d) => d.toLowerCase().includes("7d runs below"));
  const strength7dBelow = drivers.some((d) => d.toLowerCase().includes("7d strength below"));
  const mileage30Needs = drivers.some((d) => d.toLowerCase().includes("30d mileage needs"));
  const longRunNotReady = drivers.some((d) => d.toLowerCase().includes("long run not"));

  if (runs7dBelow) actionables.push("Hit 5 runs in the next 7 days (no excuses, just logistics).");
  if (strength7dBelow) actionables.push("Get 4 strength sessions in the next 7 days (short sessions count).");
  if (mileage30Needs) actionables.push("Raise 30-day average weekly mileage toward 26.2+ (add easy volume).");
  if (longRunNotReady) actionables.push("In the next 30 days: complete a long run that meets race demand (13.1 mi OR your predicted race duration).");

  // Always include your “≤2 days without a run” rule as a behavioral guardrail
  const daysSinceRun = consistency?.days_since_last_run ?? null;
  if ((daysSinceRun ?? 0) >= 3) actionables.unshift("You broke the 2-day gap rule: do an easy run today.");

  // Trim to top 3, but ensure *something* shows
  const topActions = uniqTop(
    actionables.length
      ? actionables
      : [
          "Keep the 2 hard-day ceiling. Make the rest boring-easy volume.",
          "Long run every 7–10 days. Don’t skip the cornerstone.",
          "Sleep/RHR gate decides intensity, not your mood.",
        ],
    3
  );

  // ---- Next Action (single sentence) ----
  const overreach = !!balance?.overreach_risk;
  let reco = "Execute the plan: easy volume + keep strength on track.";
  if (gateColor === "red" || overreach) reco = "Recovery day: walk + mobility. No intensity.";
  else if (gateColor === "gray") reco = "Data pending: default to easy effort until sleep/RHR syncs.";
  else if ((daysSinceRun ?? 0) >= 3) reco = "Easy run today (30–45 min). Re-establish rhythm.";
  else if ((race?.readiness_score ?? 0) < 75) reco = "Build day: easy run + strength. Consistency beats hero days.";

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      {/* Header */}
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Fitness</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Score + actionables. Everything else is noise.
        </p>
      </header>

      {/* Top row */}
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {/* Race Readiness */}
        <div className="card" style={{ background: panel.bg, borderColor: panel.border }}>
          <div className="card-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="card-title">Race Readiness</div>
              <div
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid ${panel.border}`,
                  background: "rgba(0,0,0,0.10)",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.2,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 999, background: dotColor(band) }} />
                {band.toUpperCase()}
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 46, fontWeight: 950, letterSpacing: -0.8 }}>
              {race?.readiness_score ?? "—"}
            </div>

            <div className="card-muted" style={{ marginTop: 6, fontSize: 12 }}>
              Rolling 7d + 30d (last 45d only)
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {topActions.map((a, idx) => (
                <div key={idx} style={{ fontSize: 13, fontWeight: 700 }}>
                  • {a}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Readiness Gate (compact) */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Readiness Gate</div>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: dotColor(gateColor),
                  boxShadow: "0 0 0 5px rgba(255,255,255,0.05)",
                }}
                aria-label={`readiness-${gateColor}`}
              />
              <div style={{ fontSize: 16, fontWeight: 900, textTransform: "capitalize" }}>
                {gateColor === "gray" ? "Pending" : gateColor}
              </div>
              <div className="card-muted" style={{ marginLeft: "auto", fontSize: 13 }}>
                as of {fmtDate(gate?.as_of_day)}
              </div>
            </div>

            <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
              Sleep: {gate?.sleep_score ?? "—"} • RHR Δ: {fmt1(gate?.rhr_delta)} • Age: {gate?.data_age_hours ?? "—"}h
            </div>
          </div>
        </div>
      </section>

      {/* Recommendation */}
      <section style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Next Action</div>
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 800 }}>{reco}</div>
            <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
              ≤2-day rule: <strong>{consistency?.within_2_day_rule ? "holding" : "broken"}</strong> • Last run:{" "}
              {fmtDate(consistency?.last_run_date)}
              {balance?.overreach_risk ? " • ⚠️ overreach risk" : ""}
            </div>
          </div>
        </div>
      </section>

      {/* Long Run + Consistency */}
      <section style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {/* Long Run */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Long Run</div>

            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 950 }}>
              {longrun?.last_long_min ? `${fmt0(longrun.last_long_min)} min` : "—"}
              <span className="card-muted" style={{ fontSize: 13, fontWeight: 650, marginLeft: 10 }}>
                last: {fmtDate(longrun?.last_long_day)}
              </span>
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Strongest (30d):{" "}
              {(longrun as any)?.max_long_min_30d
                ? `${fmt0((longrun as any)?.max_long_min_30d)} min`
                : "—"}{" "}
              • {fmtDate((longrun as any)?.max_long_day_30d)}
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Next target: {longrun?.next_target_min ? `${fmt0(longrun.next_target_min)} min` : "—"}
              {longrun?.jumped_too_fast ? " • ⚠️ last jump > 15 min" : ""}
            </div>
          </div>
        </div>

        {/* Consistency */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Consistency</div>

            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 950 }}>
              {consistency?.days_since_last_run ?? "—"}
              <span className="card-muted" style={{ fontSize: 13, fontWeight: 650, marginLeft: 10 }}>
                days since run
              </span>
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Worst gap (30d): {n(consistency?.max_gap_last_30d)} days
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Load/Recovery flag: <strong>{balance?.overreach_risk ? "ON" : "off"}</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}