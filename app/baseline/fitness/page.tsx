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
<<<<<<< HEAD
  return d.slice(0, 10);
}

function readinessDot(color: string | null | undefined) {
  const c = (color ?? "gray").toLowerCase();
  const map: Record<string, string> = {
    green: "rgba(34,197,94,0.92)",
    yellow: "rgba(234,179,8,0.92)",
    orange: "rgba(249,115,22,0.92)",
    red: "rgba(239,68,68,0.92)",
    gray: "rgba(148,163,184,0.9)",
=======
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
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
  };
  return map[c] ?? map.gray;
}

<<<<<<< HEAD
function bandPanelStyles(band: string | null | undefined) {
  const b = (band ?? "red").toLowerCase();
  const map: Record<string, { bg: string; border: string; label: string }> = {
    green: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.40)", label: "Green" },
    yellow: { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.40)", label: "Yellow" },
    orange: { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.40)", label: "Orange" },
    red: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.40)", label: "Red" },
    gray: { bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.28)", label: "—" },
  };
  return map[b] ?? map.red;
}

function MiniBar({
  label,
  value,
  max,
  note,
}: {
  label: string;
  value: number;
  max: number;
  note?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div className="card-muted" style={{ fontSize: 12 }}>
          {label}
        </div>
        <div className="card-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {note ?? ""}
        </div>
      </div>
      <div
        style={{
          height: 7,
          marginTop: 4,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: 7,
            background: "rgba(124,58,237,0.85)",
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

export default async function FitnessPage() {
  const [gate, consistency, longrun, balance, race] = await Promise.all([
=======
export default async function FitnessPage() {
  const [readiness, consistency, longrun, balance, race] = await Promise.all([
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
    fetchReadinessStatus(USER_ID),
    fetchRunConsistency(USER_ID),
    fetchLongRunProgression(USER_ID),
    fetchLoadRecoveryBalance(USER_ID),
    fetchRaceReadiness(USER_ID),
  ]);

<<<<<<< HEAD
  // Daily readiness gate (green/yellow/red/gray)
  const gateColor = (gate?.readiness_color ?? "gray").toLowerCase();
=======
  // ----- Primary recommendation (bossy, but not annoying) -----
  const readinessColor = (readiness?.readiness_color ?? "gray").toLowerCase();
  const daysSinceRun = consistency?.days_since_last_run ?? null;
  const within2 = !!consistency?.within_2_day_rule;
  const overreach = !!balance?.overreach_risk;
  const jumped = !!longrun?.jumped_too_fast;
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a

  // Race readiness band (green/yellow/orange/red)
  const band = (race?.readiness_band ?? "red").toLowerCase();
  const bandPanel = bandPanelStyles(band);

  const daysSinceRun = consistency?.days_since_last_run ?? null;
  const within2 = !!consistency?.within_2_day_rule;
  const overreach = !!balance?.overreach_risk;

  // Primary recommendation (simple, useful, not “today stats”)
  let reco = "Maintenance day: walk + mobility.";
<<<<<<< HEAD
  if (gateColor === "red" || overreach) {
    reco = "Recovery day. Easy walk + mobility. Skip intensity.";
  } else if (gateColor === "gray") {
    reco = "Sleep/RHR not synced yet. Default to easy effort until it lands.";
  } else if (!within2 && (daysSinceRun ?? 99) >= 3) {
    reco = "You’re at/over the 2-day gap rule. 30–45 min easy run today.";
  } else if ((race?.readiness_score ?? 0) < 75) {
    reco = "Build day: easy run + keep strength on track. Don’t chase hero workouts.";
  } else {
    reco = "You’re trending well. Execute the plan (and don’t get cute).";
=======
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
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
  }

  const rs = readinessStyles(readiness?.readiness_color);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      {/* Header */}
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Fitness</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
<<<<<<< HEAD
          Rolling windows. Stricter rules. Less self-deception.
        </p>
      </header>

      {/* Top row: Race readiness + Daily readiness gate */}
=======
          Half marathon prep. The plan is simple. Life isn’t.
        </p>
      </header>

      {/* Top row: Race readiness + Readiness color gate */}
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
<<<<<<< HEAD
        {/* Race Readiness */}
        <div
          className="card"
          style={{
            background: bandPanel.bg,
            borderColor: bandPanel.border,
          }}
        >
          <div className="card-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>
                Race Readiness
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid ${bandPanel.border}`,
                  background: "rgba(0,0,0,0.10)",
                  fontSize: 12,
                  fontWeight: 750,
                  letterSpacing: 0.2,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: readinessDot(band),
                  }}
                />
                {band.toUpperCase()}
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 14 }}>
              <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -0.6 }}>
                {race?.readiness_score ?? "—"}
              </div>
              <div className="card-muted" style={{ fontSize: 13 }}>
                7d + 30d rolling • last 45d only
              </div>
            </div>

            {/* Mini status bars */}
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <MiniBar
                label="7d runs"
                value={n(race?.runs_this_week)}
                max={5}
                note={`${n(race?.runs_this_week)}/5`}
              />
              <MiniBar
                label="7d strength"
                value={n(race?.strength_this_week)}
                max={4}
                note={`${n(race?.strength_this_week)}/4`}
              />
              {/* These fields exist in the view we discussed; if they’re not in your current view yet, they’ll just show 0/—.
                  You can remove them if you haven’t exposed miles_7d / avg_weekly_miles_30d / est_race_minutes in v_race_readiness. */}
              <MiniBar
                label="30d avg weekly mileage"
                value={n((race as any)?.avg_weekly_miles_30d)}
                max={26.2}
                note={`${fmt1((race as any)?.avg_weekly_miles_30d)} / 26.2`}
              />
              <MiniBar
                label="Long run vs race demand"
                value={n(race?.last_long_min)}
                max={n((race as any)?.est_race_minutes) || 120}
                note={`${fmt0(race?.last_long_min)} / ${fmt0((race as any)?.est_race_minutes)}`}
              />
            </div>

            {/* Drivers */}
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              {(race?.drivers ?? []).slice(0, 4).map((d, idx) => {
                const isBad = d.toLowerCase().includes("below") || d.toLowerCase().includes("needs");
                return (
                  <div
                    key={idx}
                    style={{
                      fontSize: 13,
                      opacity: isBad ? 0.95 : 0.7,
                      fontWeight: isBad ? 750 : 550,
                    }}
                  >
                    • {d}
                  </div>
                );
              })}
              {(race?.drivers ?? []).length === 0 ? (
                <div className="card-muted" style={{ fontSize: 13 }}>
                  • Not enough data yet.
=======
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
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
                </div>
              ) : null}
            </div>
          </div>
        </div>

<<<<<<< HEAD
        {/* Daily Readiness Gate (color dot, latest-available) */}
        <div className="card">
=======
        {/* Readiness Gate (Color-first) */}
        <div className="card" style={{ borderColor: rs.border, background: rs.bg }}>
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
          <div className="card-inner">
            <div className="card-title">Readiness Gate</div>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <div
<<<<<<< HEAD
=======
                aria-label={`readiness-${readinessColor}`}
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
<<<<<<< HEAD
                  background: readinessDot(gateColor),
                  boxShadow: "0 0 0 5px rgba(255,255,255,0.05)",
                }}
                aria-label={`readiness-${gateColor}`}
              />
              <div style={{ fontSize: 18, fontWeight: 850, textTransform: "capitalize" }}>
                {gateColor === "gray" ? "Pending" : gateColor}
              </div>

              <div className="card-muted" style={{ marginLeft: "auto", fontSize: 13 }}>
                as of {fmtDate(gate?.as_of_day)}
=======
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
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
              </div>
            </div>

            <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
<<<<<<< HEAD
              Sleep: {gate?.sleep_score ?? "—"} • RHR Δ: {fmt1(gate?.rhr_delta)} • Age:{" "}
              {gate?.data_age_hours ?? "—"}h
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {(gate?.reasons ?? []).slice(0, 3).map((r, idx) => (
=======
              Sleep: {readiness?.sleep_score ?? "—"} • RHR Δ: {fmt1(readiness?.rhr_delta)} • Age:{" "}
              {readiness?.data_age_hours ?? "—"}h
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {(readiness?.reasons ?? []).slice(0, 3).map((r, idx) => (
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
                <div key={idx} className="card-muted" style={{ fontSize: 13 }}>
                  • {r}
                </div>
              ))}
<<<<<<< HEAD
              {(gate?.reasons ?? []).length === 0 ? (
=======
              {(readiness?.reasons ?? []).length === 0 ? (
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
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
<<<<<<< HEAD
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 750 }}>{reco}</div>
            <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
              Rule: no more than 2 days without a run.
              {consistency?.last_run_date ? ` Last run: ${fmtDate(consistency.last_run_date)}.` : ""}
=======
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700 }}>{reco}</div>
            <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
              (Rule: no more than 2 days without a run • long run &gt; 75 min counts as hard)
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
            </div>
          </div>
        </div>
      </section>

<<<<<<< HEAD
      {/* Long Run + Consistency */}
=======
      {/* Middle row: Long Run + Consistency */}
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
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
<<<<<<< HEAD
            <div className="card-title">Long Run</div>

            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900 }}>
=======
            <div className="card-title">Long Run Progression</div>

            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
              {longrun?.last_long_min ? `${fmt0(longrun.last_long_min)} min` : "—"}
              <span className="card-muted" style={{ fontSize: 13, fontWeight: 650, marginLeft: 10 }}>
                last: {fmtDate(longrun?.last_long_day)}
              </span>
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
<<<<<<< HEAD
              Prev: {longrun?.prev_long_min ? `${fmt0(longrun.prev_long_min)} min` : "—"} • Δ{" "}
              {fmt1(longrun?.delta_min)} min
              {longrun?.jumped_too_fast ? " • ⚠️ jump > 15" : ""}
=======
              Prev: {longrun?.prev_long_min ? `${fmt0(longrun.prev_long_min)} min` : "—"} ({fmtDate(longrun?.prev_long_day)}) •
              Δ {fmt1(longrun?.delta_min)} min
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Next target: {longrun?.next_target_min ? `${fmt0(longrun.next_target_min)} min` : "—"}
<<<<<<< HEAD
            </div>

            <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
              Strongest (30d):{" "}
              {(longrun as any)?.max_long_min_30d
                ? `${fmt0((longrun as any)?.max_long_min_30d)} min`
                : "—"}{" "}
              • {fmtDate((longrun as any)?.max_long_day_30d)}
=======
              {longrun?.jumped_too_fast ? " • ⚠️ last jump > 15 min" : ""}
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
            </div>
          </div>
        </div>

        {/* Run Consistency */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Consistency</div>

<<<<<<< HEAD
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 900 }}>
=======
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800 }}>
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
              {consistency?.days_since_last_run ?? "—"}
              <span className="card-muted" style={{ fontSize: 13, fontWeight: 650, marginLeft: 10 }}>
                days since run
              </span>
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
<<<<<<< HEAD
              ≤2-day rule:{" "}
              <strong>{consistency?.within_2_day_rule ? "holding" : "broken"}</strong>
=======
              Rule (≤2 days):{" "}
              <strong>{consistency?.within_2_day_rule ? "holding" : "broken"}</strong> • Last run:{" "}
              {fmtDate(consistency?.last_run_date)}
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
            </div>

            <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
              Worst gap (30d): {n(consistency?.max_gap_last_30d)} days
            </div>
          </div>
        </div>
      </section>

<<<<<<< HEAD
      {/* Load vs Recovery */}
=======
      {/* Bottom row: Load vs Recovery */}
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
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
<<<<<<< HEAD
                <div className="card-muted" style={{ fontSize: 12 }}>
                  Run minutes (7d)
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt0(balance?.run_minutes_7d)}</div>
              </div>
              <div>
                <div className="card-muted" style={{ fontSize: 12 }}>
                  Run minutes (30d)
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt0(balance?.run_minutes_30d)}</div>
              </div>
              <div>
                <div className="card-muted" style={{ fontSize: 12 }}>
                  Sleep Δ (7–30)
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt1(balance?.sleep_delta_7v30)}</div>
              </div>
              <div>
                <div className="card-muted" style={{ fontSize: 12 }}>
                  RHR Δ (7–30)
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt1(balance?.rhr_delta_7v30)}</div>
=======
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
>>>>>>> 1b314243332dcb70ef3cb1813a29de75a54ec27a
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