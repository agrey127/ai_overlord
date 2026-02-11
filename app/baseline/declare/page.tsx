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
    <main>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Declare Intake</h1>
        <p style={{ marginTop: 6, color: "#555" }}>
          This is the only place you log food. Home only judges you.
        </p>
      </header>
      
      <div style={{ marginTop: 10 }}>
        <Link href="/baseline/declare/manual" style={{ textDecoration: "none" }}>
          + Manual Log
        </Link>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Saved Meals</h2>

        {meals.length === 0 ? (
          <div style={{ border: "1px dashed #bbb", borderRadius: 10, padding: 12, color: "#666" }}>
            No saved meals yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {meals.map((m) => (
              <div
                key={m.id}
                style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <strong>{m.name}</strong>
                    {m.description ? (
                      <div style={{ marginTop: 6, color: "#666" }}>{m.description}</div>
                    ) : null}
                  </div>

                  <div style={{ textAlign: "right", color: "#666", whiteSpace: "nowrap" }}>
                    <div><strong>{n(m.calories)}</strong> cal</div>
                    <div>P {n(m.protein_g)}g</div>
                    <div>C {n(m.carbs_g)}g</div>
                    <div>F {n(m.fat_g)}g</div>
                  </div>
                  <SavedMealLogForm savedMealId={m.id} />
                </div>

                <div style={{ marginTop: 10, color: "#777", fontSize: 13 }}>
                  Fiber {n(m.fiber_g)}g · Sugar {n(m.sugar_g)}g · Sodium {n(m.sodium_mg)}mg
                </div>

                <div style={{ marginTop: 10 }}>
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px dashed #bbb",
                      color: "#666",
                      fontSize: 14,
                    }}
                  >
                    Tap to log (enabled next phase)
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

