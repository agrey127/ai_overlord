import {
  fetchTodayNutritionHome,
  fetchCashflowProjection7d,
  fetchActiveLifeSignals,
  fetchMicroTrendsHome,
} from "@/lib/data/baseline";

function safeNum(n: number | null | undefined) {
  return typeof n === "number" ? n : 0;
}

function fmt(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n as number)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}
function fmtDelta(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n as number)) return "—";
  const sign = n > 0 ? "+" : "";
  return sign + Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}
function fmtMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(n as number)) return "—";
  return Number(n).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ] as [number, number, number];
}

/**
 * Severity is 0..5
 * 0 -> purple
 * 3 -> amber
 * 5 -> red
 */
function severityRgb(sev: number | string | null | undefined) {
  const s = clamp(Number(sev ?? 0), 0, 5);

  const purple: [number, number, number] = [168, 85, 247];
  const amber: [number, number, number] = [245, 158, 11];
  const red: [number, number, number] = [239, 68, 68];

  if (s <= 3) {
    return lerpColor(purple, amber, s / 3);
  }
  return lerpColor(amber, red, (s - 3) / 2);
}

function severityAura(sev: number | string | null | undefined) {
  const s = clamp(Number(sev ?? 0), 0, 5);
  const [r, g, b] = severityRgb(s);

  // More punch in 4-5 range
  const a = lerp(0.10, 0.26, s / 5);

  return `radial-gradient(700px 260px at 10% 0%, rgba(${r}, ${g}, ${b}, ${a}), transparent 65%)`;
}

function severityBorder(sev: number | string | null | undefined) {
  const s = clamp(Number(sev ?? 0), 0, 5);
  const [r, g, b] = severityRgb(s);

  const a = lerp(0.16, 0.34, s / 5);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function severityDot(sev: number | string | null | undefined) {
  const s = clamp(Number(sev ?? 0), 0, 5);
  const [r, g, b] = severityRgb(s);

  const a = lerp(0.55, 0.98, s / 5);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function severityHalo(sev: number | string | null | undefined) {
  const s = clamp(Number(sev ?? 0), 0, 5);
  const [r, g, b] = severityRgb(s);

  const a = lerp(0.08, 0.18, s / 5);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}



function severityDotColor(sev: number | null | undefined) {
  const s = typeof sev === "number" ? sev : 0;
  if (s >= 8) return "var(--crit)";
  if (s >= 5) return "var(--warn)";
  return "rgba(255,255,255,0.28)";
}

function severityLabel(sev: number | null | undefined) {
  const s = typeof sev === "number" ? sev : 0;
  if (s >= 8) return "Critical";
  if (s >= 5) return "Warning";
  return "Info";
}

export default async function BaselineHomePage() {
  const nutrition = await fetchTodayNutritionHome();
  const cashflow = await fetchCashflowProjection7d();
  const micro = await fetchMicroTrendsHome();

  const caloriesConsumed = safeNum(nutrition?.calories);
  const calorieGoal = safeNum(nutrition?.calorie_goal);
  const caloriesRemaining =
    nutrition?.calories_remaining ?? (calorieGoal - caloriesConsumed);

  const proteinConsumed = safeNum(nutrition?.protein_g);
  const proteinGoal = safeNum(nutrition?.protein_goal_g);
  const proteinRemaining =
    nutrition?.protein_remaining ?? (proteinGoal - proteinConsumed);

  const currentBal = safeNum(cashflow?.current_balance);
  const projectedBal = safeNum(cashflow?.projected_balance_7d);

  const signals = await fetchActiveLifeSignals();
  const topSignal = signals[0] ?? null;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 650, margin: 0 }}>Baseline</h1>
          <div
            style={{
              height: 2,
              marginTop: 10,
              borderRadius: 999,
              background: "linear-gradient(90deg, var(--p1), var(--p2), var(--p3))",
              opacity: 0.65,
            }}
          />
          <div className="card-muted" style={{ fontSize: 13, marginTop: 8 }}>
            Daily control surface. No charts. Just decisions.
          </div>
        </div>

        <div style={{ fontSize: 13, color: "var(--muted)" }}>Today</div>
      </header>

      {/* Control Knobs */}
      <section style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          {/* Calories */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">Calories</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
                <div className="stat-top-row">
                  <div className="stat-big">
                    {fmt(caloriesConsumed, 0)}g
                  </div>
              </div>
                  <div className="card-muted">
                    goal {fmt(calorieGoal, 0)}g
                  </div>
                </div>
    
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                {fmt(caloriesRemaining, 0)} remaining
              </div>
            </div>
          </div>

          {/* Protein */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">Protein</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
                <div className="stat-top-row">
                  <div className="stat-big">
                    {fmt(proteinConsumed, 0)}g
                  </div>
              </div>          
                <div className="card-muted">
                  goal {fmt(proteinGoal, 0)}g
                </div>
              </div>

              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                {fmt(proteinRemaining, 0)}g remaining
              </div>
            </div>
          </div>

          {/* Cashflow */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">Cashflow</div>

              {/* Top row */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
                <div className="stat-top-row">
                  <div className="stat-big">
                    {fmtMoney(projectedBal)}
                  </div>
              </div>
                <div className="card-muted">
                  Projected (7d)
                </div>
              </div>
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                {fmtMoney(currentBal)} current
              </div>
            </div>
          </div>
        </div>  
      </section>

      {/* Primary Recommendation */}
      <section style={{ marginBottom: 14 }}>
        <div
          className="card"
          style={{
            borderColor: "rgba(168, 85, 247, 0.22)",
            boxShadow: "0 18px 44px rgba(124, 58, 237, 0.18)",
            background:
              "radial-gradient(900px 500px at 10% 0%, rgba(124, 58, 237, 0.22), transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
          }}
        >
          <div className="card-inner">
            <div className="card-title">Today’s Focus</div>

            {topSignal?.recommendation ? (
              <>
                <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
                  From <strong style={{ color: "rgba(255,255,255,0.92)" }}>{topSignal.title}</strong>{" "}
                  (Sev {topSignal.severity})
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>
                  {topSignal.recommendation}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
                  Maintain course.
                </div>
                <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
                  No recommendation right now. Don’t invent chaos.
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Signals */}
      <section style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Signals</div>
          <div className="card-muted" style={{ fontSize: 13 }}>
            {signals.length === 0 ? "Quiet day." : `Showing ${Math.min(signals.length, 4)} of ${signals.length}`}
          </div>
        </div>

        {signals.length === 0 ? (
          <div className="card" style={{ borderStyle: "dashed", borderColor: "rgba(255,255,255,0.14)" }}>
            <div className="card-inner">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.28)" }} />
                <div style={{ fontWeight: 650 }}>No active signals</div>
              </div>
              <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
                Either you’re crushing it… or the sensors are asleep.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {signals.slice(0, 4).map((s) => (
              <div
                key={s.id}
                className="card"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderColor: severityBorder(s.severity),
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: -1,
                    background: severityAura(s.severity),
                    pointerEvents: "none",
                  }}
                />
                <div className="card-inner" style={{ position: "relative" }}>
                  ...

                  {/* existing content unchanged */}

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {(() => {
                        const [r, g, b] = severityRgb(s.severity);
                        const sev = clamp(Number(s.severity ?? 0), 0, 10);
                        const dotA = lerp(0.55, 0.95, sev / 10);

                        return (
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              background: `rgba(${r}, ${g}, ${b}, ${dotA})`,
                              boxShadow: `0 0 0 4px rgba(${r}, ${g}, ${b}, 0.10)`,
                            }}
                          />
                        );
                      })()}

                      <div style={{ fontWeight: 700 }}>{s.title}</div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 999,
                          padding: "2px 10px",
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                      >
                        {s.domain}
                      </span>
                      <span
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 999,
                          padding: "2px 10px",
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                      >
                        {severityLabel(s.severity)} · {s.severity}
                      </span>
                    </div>
                  </div>

                  <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
                    {s.message}
                  </div>

                  {s.facts ? (
                    <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
                      <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 650 }}>Facts:</span>{" "}
                      {s.facts}
                    </div>
                  ) : null}

                  {s.recommendation ? (
                    <div style={{ marginTop: 10, fontSize: 13 }}>
                      <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 650 }}>Do this:</span>{" "}
                      <span style={{ fontWeight: 750 }}>{s.recommendation}</span>
                    </div>
                  ) : null}
                </div>
              </div>

            ))}
          </div>
        )}
      </section>

      

      {/* Micro Trends */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Micro-trends</div>
          <div className="card-muted" style={{ fontSize: 13 }}>Context only.</div>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {/* Calories */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">7d Avg Calories</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
                {fmt(micro?.calories_avg_7d, 0)}
              </div>
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                {fmtDelta(micro?.calories_delta_vs_prev_7d, 0)} vs prior 7d · logged {micro?.nutrition_days_logged_7d ?? 0}/7
              </div>
            </div>
          </div>

          {/* Protein */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">7d Avg Protein</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
                {fmt(micro?.protein_avg_7d, 0)}g
              </div>
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                {fmtDelta(micro?.protein_delta_vs_prev_7d, 0)}g vs prior 7d · logged {micro?.nutrition_days_logged_7d ?? 0}/7
              </div>
            </div>
          </div>

          {/* Training minutes */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">Training Minutes (This Week)</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
                {fmt(micro?.training_minutes_this_week, 0)} min
              </div>
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                {fmtDelta(micro?.training_minutes_delta_vs_last_week, 0)} vs last week · {micro?.training_days_this_week ?? 0} sessions
              </div>
            </div>
          </div>

          {/* Sleep score */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">Sleep Score (7d Avg)</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
                {fmt(micro?.sleep_score_avg_7d, 1)}
              </div>
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                {fmtDelta(micro?.sleep_score_delta_vs_prev_7d, 1)} vs prior 7d
              </div>
            </div>
          </div>

          {/* Cashflow low (30d) */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">Cashflow Low (Next 30d)</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
                {fmtMoney(micro?.min_projected_balance_30d)}
              </div>
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                on {micro?.min_projected_balance_day_30d ?? "—"} · projected minimum
              </div>
            </div>
          </div>

          {/* Net worth delta (30d) */}
          <div className="card">
            <div className="card-inner">
              <div className="card-title">Net Worth (Δ 30d)</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
                {fmtMoney(micro?.net_worth_delta_30d)}
              </div>
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                as of {micro?.net_worth_last_snapshot_day ?? "—"} · latest snapshot
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
