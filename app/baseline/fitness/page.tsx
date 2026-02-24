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
  // keep it simple: YYYY-MM-DD
  return d.slice(0, 10);
}

function readinessStyles(color: string | null | undefined) {
  // Uses border/background only; no fancy libs, no CSS dependencies.
  // green/yellow/red/gray expected
  const c = (color ?? "gray").toLowerCase();
  const map: Record<string, { border: string; bg: string; label: string }> = {
    green: { border: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.12)", label: "Green" },
    yellow: { border: "rgba(234,179,8,0.35)", bg: "rgba(234,179,8,0.12)", label: "Yellow" },
    red: { border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.12)", label: "Red" },
    gray: { border: "rgba(148,163,184,0.28)", bg: "rgba(148,163,184,0.10)", label: "Pending" },
  };
  return map[c] ?? map.gray;
}

export default async function FitnessPage() {
  const [readiness, consistency, longrun, balance, race] = await Promise.all([
    fetchReadinessStatus(USER_ID),
    fetchRunConsistency(USER_ID),
    fetchLongRunProgression(USER_ID),
    fetchLoadRecoveryBalance(USER_ID),
    fetchRaceReadiness(USER_ID),
  ]);

  // ----- Primary recommendation (bossy, but not annoying) -----
  const readinessColor = (readiness?.readiness_color ?? "gray").toLowerCase();
  const daysSinceRun = consistency?.days_since_last_run ?? null;
  const within2 = !!consistency?.within_2_day_rule;
  const overreach = !!balance?.overreach_risk;
  const jumped = !!longrun?.jumped_too_fast;

  let reco = "Maintenance day: walk + mobility.";
  if (readinessColor === "red" || overreach) {
    reco = "Recovery day. Easy walk + mobility. No hero workouts today.";
  } else if (readinessColor === "gray") {
    reco = "Sleep/RHR not in yet. Default to easy effort until it syncs.";
  } else if (!within2 && (daysSinceRun ?? 99) >= 3) {
    reco = "You’re drifting. 30–45 min easy run today.";
  } else if (!longrun?.last_long_day) {
    reco = "No long run logged yet. Plan one this week (80–95 min).";
  } else if (jumped) {
    reco = "Long run jumped too fast last time. Hold steady this week.";
  }

  const rs = readinessStyles(readiness?.readiness_color);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      {/* Header */}
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Fitness</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Half marathon prep. The plan is simple. Life isn’t.
        </p>
      </header>

      {/* Top row: Race readiness + Readiness color gate */}
      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        {/* Race Readiness Snapshot */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Race Readiness</div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>
              {race?.readiness_score ?? "—"}
              <span className="card-muted" style={{ fontSize: 14, fontWeight: 650, marginLeft: 10 }}>
                / 100
              </span>
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Runs this week: {n(race?.runs_this_week)} • Strength this week: {n(race?.strength_this_week)} • Long run:{" "}
              {race?.last_long_min ? `${fmt0(race.last_long_min)} min` : "—"}
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {(race?.drivers ?? []).slice(0, 2).map((d, idx) => (
                <div key={idx} className="card-muted" style={{ fontSize: 13 }}>
                  • {d}
                </div>
              ))}
              {(race?.drivers ?? []).length === 0 ? (
                <div className="card-muted" style={{ fontSize: 13 }}>
                  • Not enough data yet (or RLS said “no”).
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Readiness Gate (Color-first) */}
        <div className="card" style={{ borderColor: rs.border, background: rs.bg }}>
          <div className="card-inner">
            <div className="card-title">Readiness Gate</div>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <div
                aria-label={`readiness-${readinessColor}`}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background:
                    readinessColor === "green"
                      ? "rgba(34,197,94,0.9)"
                      : readinessColor === "yellow"
                      ? "rgba(234,179,8,0.9)"
                      : readinessColor === "red"
                      ? "rgba(239,68,68,0.9)"
                      : "rgba(148,163,184,0.9)",
                  boxShadow: "0 0 0 5px rgba(255,255,255,0.05)",
                }}
              />
              <div style={{ fontSize: 22, fontWeight: 800 }}>{rs.label}</div>
              <div className="card-muted" style={{ fontSize: 13, marginLeft: "auto" }}>
                as of {fmtDate(readiness?.as_of_day)}
              </div>
            </div>

            <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
              Sleep: {readiness?.sleep_score ?? "—"} • RHR Δ: {fmt1(readiness?.rhr_delta)} • Age:{" "}
              {readiness?.data_age_hours ?? "—"}h
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {(readiness?.reasons ?? []).slice(0, 3).map((r, idx) => (
                <div key={idx} className="card-muted" style={{ fontSize: 13 }}>
                  • {r}
                </div>
              ))}
              {(readiness?.reasons ?? []).length === 0 ? (
                <div className="card-muted" style={{ fontSize: 13 }}>
                  • No flags. Don’t waste it.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Recommendation */}
      <section style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Next Action</div>
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700 }}>{reco}</div>
            <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
              (Rule: no more than 2 days without a run • long run &gt; 75 min counts as hard)
            </div>
          </div>
        </div>
      </section>

      {/* Middle row: Long Run + Consistency */}
      <section
        style={{
          marginTop: 14,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        {/* Long Run Progression */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Long Run Progression</div>

            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>
              {longrun?.last_long_min ? `${fmt0(longrun.last_long_min)} min` : "—"}
              <span className="card-muted" style={{ fontSize: 13, fontWeight: 650, marginLeft: 10 }}>
                last: {fmtDate(longrun?.last_long_day)}
              </span>
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Prev: {longrun?.prev_long_min ? `${fmt0(longrun.prev_long_min)} min` : "—"} ({fmtDate(longrun?.prev_long_day)}) •
              Δ {fmt1(longrun?.delta_min)} min
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Next target: {longrun?.next_target_min ? `${fmt0(longrun.next_target_min)} min` : "—"}
              {longrun?.jumped_too_fast ? " • ⚠️ last jump > 15 min" : ""}
            </div>
          </div>
        </div>

        {/* Run Consistency */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Consistency</div>

            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>
              {consistency?.days_since_last_run ?? "—"}
              <span className="card-muted" style={{ fontSize: 13, fontWeight: 650, marginLeft: 10 }}>
                days since run
              </span>
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Rule (≤2 days):{" "}
              <strong>{consistency?.within_2_day_rule ? "holding" : "broken"}</strong> • Last run:{" "}
              {fmtDate(consistency?.last_run_date)}
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Worst gap (30d): {n(consistency?.max_gap_last_30d)} days
            </div>
          </div>
        </div>
      </section>

      {/* Bottom row: Load vs Recovery */}
      <section style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Load vs Recovery (7d vs 30d)</div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              }}
            >
              <div>
                <div className="card-muted" style={{ fontSize: 12 }}>Run minutes (7d)</div>
                <div style={{ fontSize: 18, fontWeight: 750 }}>{fmt0(balance?.run_minutes_7d)}</div>
              </div>
              <div>
                <div className="card-muted" style={{ fontSize: 12 }}>Run minutes (30d)</div>
                <div style={{ fontSize: 18, fontWeight: 750 }}>{fmt0(balance?.run_minutes_30d)}</div>
              </div>
              <div>
                <div className="card-muted" style={{ fontSize: 12 }}>Sleep Δ (7–30)</div>
                <div style={{ fontSize: 18, fontWeight: 750 }}>{fmt1(balance?.sleep_delta_7v30)}</div>
              </div>
              <div>
                <div className="card-muted" style={{ fontSize: 12 }}>RHR Δ (7–30)</div>
                <div style={{ fontSize: 18, fontWeight: 750 }}>{fmt1(balance?.rhr_delta_7v30)}</div>
              </div>
            </div>

            <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
              Risk flag: <strong>{balance?.overreach_risk ? "ON" : "off"}</strong>
              {balance?.overreach_risk ? " • You’re stacking load while recovery slips." : " • Keep stacking smart."}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}