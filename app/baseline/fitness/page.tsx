// app/baseline/fitness/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import {
  fetchFitnessTodayHome,
  fetchFitnessWeekHome,
  fetchFitnessTrendsHome,
} from "@/lib/data/fitness";

function n(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

function fmt1(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x)
    ? x.toFixed(1)
    : "—";
}

function bandLabel(band: string | null | undefined) {
  if (band === "good") return "Good";
  if (band === "bad") return "Bad";
  if (band === "ok") return "OK";
  return "Unknown";
}

const USER_ID = "agrey127@gmail.com";

export default async function FitnessPage() {
  const [today, week, trends] = await Promise.all([
    fetchFitnessTodayHome(USER_ID),
    fetchFitnessWeekHome(USER_ID),
    fetchFitnessTrendsHome(USER_ID),
  ]);

  // Primary recommendation logic
  const rhrFlag = !!today?.rhr_flag;
  const sleepBand = today?.sleep_band ?? "unknown";
  const runsRemaining = week?.runs_remaining_week ?? 0;
  const daysSinceRun = week?.days_since_last_run ?? null;
  const strengthRemaining = week?.strength_remaining_week ?? 0;

  let reco = "Maintenance day: walk + mobility.";

  if (rhrFlag || sleepBand === "bad") {
    reco = "Recovery looks shaky. Keep it easy or take a rest day.";
  } else if (runsRemaining > 0 && (daysSinceRun ?? 99) >= 2) {
    reco = "You’re due. 30–45 min easy run today.";
  } else if (strengthRemaining > 0) {
    reco = "Lift today. 4x/week doesn’t happen by accident.";
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      {/* Header */}
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Fitness</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Automated logging. Manual discipline.
        </p>
      </header>

      {/* Top Section */}
      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        }}
      >
        {/* Readiness */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Readiness</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>
              {bandLabel(today?.sleep_band)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Sleep: {today?.sleep_score ?? "—"} • RHR Δ:{" "}
              {fmt1(today?.rhr_delta)} {today?.rhr_flag ? "⚠️" : ""}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Steps: {today?.steps ?? "—"} / {today?.steps_goal ?? 10000} (
              left {today?.steps_remaining ?? "—"})
            </div>
          </div>
        </div>

        {/* Today Load */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Today</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>
              {fmt1(today?.training_minutes_today)} min
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Distance: {fmt1(today?.distance_today)} mi
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Strength: {n(today?.strength_sessions_today)}{" "}
              {today?.is_hard_day_today ? "• Hard day" : ""}
            </div>
          </div>
        </div>

        {/* Weekly Goals */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">This Week</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>
              {n(week?.run_sessions_week)} / {n(week?.run_goal_week)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Runs remaining: {n(week?.runs_remaining_week)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Hard days: {n(week?.hard_days_week)} /{" "}
              {n(week?.hard_days_budget_week)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Strength: {n(week?.strength_sessions_week)} /{" "}
              {n(week?.strength_goal_week)}
            </div>
          </div>
        </div>
      </section>

      {/* Recommendation */}
      <section style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Next Action</div>
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 600 }}>
              {reco}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Last run: {week?.last_run_date ?? "—"} • Days since:{" "}
              {week?.days_since_last_run ?? "—"}
            </div>
          </div>
        </div>
      </section>

      {/* Trends */}
      <section
        style={{
          marginTop: 14,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Recovery Trend</div>
            <div className="card-muted" style={{ marginTop: 10 }}>
              Sleep 7d: {fmt1(trends?.sleep_avg_7d)} • 30d:{" "}
              {fmt1(trends?.sleep_avg_30d)} • Δ{" "}
              {fmt1(trends?.sleep_delta_7v30)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              RHR 7d: {fmt1(trends?.rhr_avg_7d)} • 30d:{" "}
              {fmt1(trends?.rhr_avg_30d)} • Δ{" "}
              {fmt1(trends?.rhr_delta_7v30)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Steps 7d: {fmt1(trends?.steps_avg_7d)} • 30d:{" "}
              {fmt1(trends?.steps_avg_30d)} • Δ{" "}
              {fmt1(trends?.steps_delta_7v30)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner">
            <div className="card-title">Volume Trend</div>
            <div className="card-muted" style={{ marginTop: 10 }}>
              Minutes 7d: {fmt1(trends?.minutes_7d)} • 30d:{" "}
              {fmt1(trends?.minutes_30d)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Distance 7d: {fmt1(trends?.distance_7d)} • 30d:{" "}
              {fmt1(trends?.distance_30d)}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}