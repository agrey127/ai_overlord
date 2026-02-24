import { fetchFitnessTodayHome, fetchFitnessWeekHome, fetchFitnessTrendsHome } from "@/lib/data/fitness";

function n(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}
function fmt1(x: number | null | undefined) {
  return typeof x === "number" && Number.isFinite(x) ? x.toFixed(1) : "—";
}
function bandLabel(band: string) {
  if (band === "good") return "Good";
  if (band === "bad") return "Bad";
  if (band === "ok") return "OK";
  return "Unknown";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FitnessPage() {
  const [today, week, trends] = await Promise.all([
    fetchFitnessTodayHome(),
    fetchFitnessWeekHome(),
    fetchFitnessTrendsHome(),
  ]);

  // Primary recommendation (simple & bossy)
  const rhrFlag = !!today?.rhr_flag;
  const sleepBand = today?.sleep_band ?? "unknown";
  const runsRemaining = week?.runs_remaining_week ?? 0;
  const daysSinceRun = week?.days_since_last_run ?? null;
  const strengthRemaining = week?.strength_remaining_week ?? 0;

  let reco = "Maintenance day: walk + mobility.";
  if (rhrFlag || sleepBand === "bad") reco = "Keep it easy today. Zone 2 or take the win and rest.";
  else if (runsRemaining > 0 && (daysSinceRun ?? 99) >= 2) reco = "You’re due. 30–45 min easy run today.";
  else if (strengthRemaining > 0) reco = "Lift today. You said 4x/week—this is where that becomes real.";

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Fitness</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Automated logging. Manual excuses.
        </p>
      </header>

      {/* Top: Today */}
      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {/* Readiness */}
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Readiness</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>
              {bandLabel(today?.sleep_band ?? "unknown")}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Sleep: {today?.sleep_score ?? "—"} • RHR Δ: {fmt1(today?.rhr_delta)} {today?.rhr_flag ? "⚠️" : ""}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Steps: {today?.steps ?? "—"} / {today?.steps_goal ?? 10000} (left {today?.steps_remaining ?? "—"})
            </div>
          </div>
        </div>

        {/* Today load */}
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
              Strength: {n(today?.strength_sessions_today)} {today?.is_hard_day_today ? "• Hard day" : ""}
            </div>
          </div>
        </div>

        {/* Weekly budget */}
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
              Hard days: {n(week?.hard_days_week)} / {n(week?.hard_days_budget_week)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Strength: {n(week?.strength_sessions_week)} / {n(week?.strength_goal_week)}
            </div>
          </div>
        </div>
      </section>

      {/* Recommendation */}
      <section style={{ marginTop: 12 }}>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Next action</div>
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 600 }}>{reco}</div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Last run: {week?.last_run_date ?? "—"} • Days since: {week?.days_since_last_run ?? "—"}
            </div>
          </div>
        </div>
      </section>

      {/* Trends */}
      <section style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Recovery trend</div>
            <div className="card-muted" style={{ marginTop: 10 }}>
              Sleep 7d: {fmt1(trends?.sleep_avg_7d)} • 30d: {fmt1(trends?.sleep_avg_30d)} • Δ {fmt1(trends?.sleep_delta_7v30)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              RHR 7d: {fmt1(trends?.rhr_avg_7d)} • 30d: {fmt1(trends?.rhr_avg_30d)} • Δ {fmt1(trends?.rhr_delta_7v30)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Steps 7d: {fmt1(trends?.steps_avg_7d)} • 30d: {fmt1(trends?.steps_avg_30d)} • Δ {fmt1(trends?.steps_delta_7v30)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner">
            <div className="card-title">Volume trend</div>
            <div className="card-muted" style={{ marginTop: 10 }}>
              Minutes 7d: {fmt1(trends?.minutes_7d)} • 30d: {fmt1(trends?.minutes_30d)}
            </div>
            <div className="card-muted" style={{ marginTop: 6 }}>
              Distance 7d: {fmt1(trends?.distance_7d)} • 30d: {fmt1(trends?.distance_30d)}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}