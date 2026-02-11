
import {
  fetchTodayNutritionHome,
  fetchCashflowProjection7d,
  fetchActiveLifeSignals,
} from "@/lib/data/baseline";

function safeNum(n: number | null | undefined) {
  return typeof n === "number" ? n : 0;
}

export default async function BaselineHomePage() {
  const nutrition = await fetchTodayNutritionHome();
  const cashflow = await fetchCashflowProjection7d();

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
    <main>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Life OS — Baseline</h1>
        <p style={{ marginTop: 6, color: "#555" }}>Tagline placeholder</p>
      </header>

      <section style={{ marginBottom: 16 }}>
        <h2>Control Knobs</h2>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <strong>Calories</strong>
            <div style={{ color: "#666", marginTop: 6 }}>
              {caloriesConsumed} / {calorieGoal} consumed
            </div>
            <div style={{ color: "#666" }}>{caloriesRemaining} remaining</div>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <strong>Protein</strong>
            <div style={{ color: "#666", marginTop: 6 }}>
              {proteinConsumed} / {proteinGoal} g
            </div>
            <div style={{ color: "#666" }}>{proteinRemaining} g remaining</div>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <strong>Cashflow</strong>
            <div style={{ color: "#666", marginTop: 6 }}>
              Current: {currentBal}
            </div>
            <div style={{ color: "#666" }}>
              Projected (7d): {projectedBal}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2>Signals</h2>

        {signals.length === 0 ? (
          <div style={{ border: "1px dashed #bbb", borderRadius: 10, padding: 12, color: "#666" }}>
            No active signals. Either you’re crushing it… or the sensors are asleep.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {signals.map((s) => (
              <div key={s.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{s.title}</strong>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>
                      {s.domain}
                    </span>
                    <span style={{ border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>
                      Sev {s.severity}
                    </span>
                  </div>
                </div>

                <div style={{ color: "#555", marginTop: 6 }}>{s.message}</div>

                {s.facts ? (
                  <div style={{ color: "#666", marginTop: 8 }}>
                    <strong>Facts:</strong> {s.facts}
                  </div>
                ) : null}

                {s.recommendation ? (
                  <div style={{ marginTop: 8 }}>
                    <strong>Do this:</strong> {s.recommendation}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>


      <section style={{ marginBottom: 16 }}>
        <h2>Primary Recommendation</h2>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          {topSignal?.recommendation ? (
            <>
              <div style={{ color: "#666", marginBottom: 6 }}>
                From: <strong>{topSignal.title}</strong> (Sev {topSignal.severity})
              </div>
              <div><strong>{topSignal.recommendation}</strong></div>
            </>
          ) : (
            <div style={{ color: "#666" }}>
              No recommendation right now. Maintain course. Don’t invent chaos.
            </div>
          )}
        </div>
      </section>


      <section>
        <h2>Micro-Trends</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ border: "1px dashed #bbb", borderRadius: 10, padding: 12, color: "#666" }}>
            7-day avg calories
          </div>
          <div style={{ border: "1px dashed #bbb", borderRadius: 10, padding: 12, color: "#666" }}>
            7-day avg protein
          </div>
        </div>
      </section>
    </main>
  );
}
