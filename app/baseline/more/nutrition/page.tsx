import { fetchTodayFoodLog } from "@/lib/data/nutrition";

function fmt(n: number, digits = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function mealLabel(raw: string) {
  if (!raw) return "Meal";
  return raw.slice(0, 1).toUpperCase() + raw.slice(1);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NutritionPage() {
  const { date, items, totals } = await fetchTodayFoodLog();

  const proteinCalories = totals.proteinG * 4;
  const carbsCalories = totals.carbsG * 4;
  const fatCalories = totals.fatG * 9;
  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;

  const proteinPct = totalMacroCalories > 0 ? (proteinCalories / totalMacroCalories) * 100 : 0;
  const carbsPct = totalMacroCalories > 0 ? (carbsCalories / totalMacroCalories) * 100 : 0;
  const fatPct = totalMacroCalories > 0 ? (fatCalories / totalMacroCalories) * 100 : 0;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Nutrition</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Daily macro split and today&apos;s food log.
        </p>
      </header>

      <section style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Daily macros</div>
            <div className="card-muted" style={{ marginTop: 4, fontSize: 13 }}>
              Based on entries logged for {date}.
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", fontSize: 12, color: "var(--muted)" }}>
                <div>Macro</div>
                <div style={{ textAlign: "right" }}>Amount</div>
                <div style={{ textAlign: "right" }}>% of macro cals</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr" }}>
                <div>Calories</div>
                <div style={{ textAlign: "right" }}>{fmt(totals.calories, 0)} kcal</div>
                <div style={{ textAlign: "right" }}>{totalMacroCalories > 0 ? fmtPct((totals.calories / totalMacroCalories) * 100) : "—"}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr" }}>
                <div>Protein</div>
                <div style={{ textAlign: "right" }}>{fmt(totals.proteinG, 1)}g</div>
                <div style={{ textAlign: "right" }}>{fmtPct(proteinPct)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr" }}>
                <div>Carbs</div>
                <div style={{ textAlign: "right" }}>{fmt(totals.carbsG, 1)}g</div>
                <div style={{ textAlign: "right" }}>{fmtPct(carbsPct)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr" }}>
                <div>Fat</div>
                <div style={{ textAlign: "right" }}>{fmt(totals.fatG, 1)}g</div>
                <div style={{ textAlign: "right" }}>{fmtPct(fatPct)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Today&apos;s food log</div>
            <div className="card-muted" style={{ marginTop: 4, fontSize: 13 }}>
              Shows item, meal, calories, and protein.
            </div>

            {items.length === 0 ? (
              <div className="card-muted" style={{ marginTop: 14 }}>
                No items logged today.
              </div>
            ) : (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", fontSize: 12, color: "var(--muted)" }}>
                  <div>Item</div>
                  <div>Meal</div>
                  <div style={{ textAlign: "right" }}>Calories</div>
                  <div style={{ textAlign: "right" }}>Protein</div>
                </div>

                {items.map((item) => (
                  <div key={item.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
                    <div>{item.itemName}</div>
                    <div className="card-muted">{mealLabel(item.mealType)}</div>
                    <div style={{ textAlign: "right" }}>{fmt(item.calories, 0)}</div>
                    <div style={{ textAlign: "right" }}>{fmt(item.proteinG, 1)}g</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
