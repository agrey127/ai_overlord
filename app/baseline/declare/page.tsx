import { fetchSavedMealsHome } from "@/lib/data/saved-meals";
import { DeclareActions } from "./DeclareActions";
import { SavedMealLogForm } from "./SavedMealLogForm";
import Link from "next/link";

function n(nv: number | null | undefined) {
  return typeof nv === "number" ? nv : 0;
}

export default async function DeclarePage() {
  const meals = await fetchSavedMealsHome();

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      {/* Header */}
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0 }}>Declare Intake</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          This is the only place you log food. Home only judges you.
        </p>
      </header>

      {/* Top Action Buttons */}
      <section style={{ marginBottom: 22 }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          {/* Manual Log */}
          <Link
            href="/baseline/declare/manual"
            style={{ textDecoration: "none" }}
          >
            <div className="card" style={{ cursor: "pointer" }}>
              <div className="card-inner">
                <div className="card-title">Manual Log</div>
                <div style={{ fontSize: 18, fontWeight: 750, marginTop: 10 }}>
                  Enter meal manually
                </div>
                <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                  Direct macro entry
                </div>
              </div>
            </div>
          </Link>

          {/* AI Log (placeholder for now) */}
          <div
            className="card"
            style={{
              cursor: "not-allowed",
              borderColor: "rgba(168, 85, 247, 0.22)",
              boxShadow: "0 14px 40px rgba(124, 58, 237, 0.16)",
              background:
                "radial-gradient(700px 300px at 10% 0%, rgba(124, 58, 237, 0.22), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
            }}
          >
            <div className="card-inner">
              <div className="card-title">AI Log</div>
              <div style={{ fontSize: 18, fontWeight: 750, marginTop: 10 }}>
                Describe your meal
              </div>
              <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
                “3 eggs, toast, coffee…” (coming next phase)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Saved Meals */}
      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Saved Meals</div>
          <div className="card-muted" style={{ fontSize: 13 }}>
            Quick re-log
          </div>
        </div>

        {meals.length === 0 ? (
          <div
            className="card"
            style={{ borderStyle: "dashed", borderColor: "rgba(255,255,255,0.14)" }}
          >
            <div className="card-inner">
              <div style={{ fontWeight: 650 }}>No saved meals yet</div>
              <div className="card-muted" style={{ marginTop: 6 }}>
                Log something manually. Save it. Become efficient.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {meals.map((m) => (
              <div key={m.id} className="card">
                <div className="card-inner">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 750 }}>{m.name}</div>

                      {m.description ? (
                        <div
                          className="card-muted"
                          style={{ marginTop: 6, fontSize: 13 }}
                        >
                          {m.description}
                        </div>
                      ) : null}

                      <div
                        className="card-muted"
                        style={{ marginTop: 10, fontSize: 13 }}
                      >
                        Fiber {n(m.fiber_g)}g · Sugar {n(m.sugar_g)}g · Sodium{" "}
                        {n(m.sodium_mg)}mg
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        fontSize: 14,
                      }}
                    >
                      <div>
                        <strong>{n(m.calories)}</strong> cal
                      </div>
                      <div>P {n(m.protein_g)}g</div>
                      <div>C {n(m.carbs_g)}g</div>
                      <div>F {n(m.fat_g)}g</div>
                    </div>

                    <SavedMealLogForm savedMealId={m.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DeclareActions />
    </main>
  );
}
