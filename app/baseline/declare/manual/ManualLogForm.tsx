"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { submitManualLog } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "12px 16px",
        borderRadius: 8,
        border: "1px solid #333",
        background: "white",
        cursor: pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Saving…" : "Log meal"}
    </button>
  );
}

export function ManualLogForm() {
  const router = useRouter();

  const [mealType, setMealType] =
    useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");

  const [saveAsMeal, setSaveAsMeal] = useState(false);

  async function action(formData: FormData) {
    formData.set("meal_type", mealType);

    await submitManualLog(formData);

    // back to Declare (so you immediately see totals + saved meals)
    router.push("/baseline/declare");
    router.refresh();
  }

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <div>
        <label style={{ display: "block", marginBottom: 6, color: "#666" }}>
          Description
        </label>
        <input
          name="description"
          placeholder="e.g., Chipotle bowl, homemade pasta..."
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #bbb",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#666" }}>Meal type:</span>
        {(["breakfast", "lunch", "dinner", "snack"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMealType(t)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #bbb",
              background: mealType === t ? "#eee" : "white",
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6, color: "#666" }}>
            Calories
          </label>
          <input
            name="calories"
            inputMode="decimal"
            placeholder="e.g., 650"
            style={{ width: 180, padding: "10px 12px", borderRadius: 8, border: "1px solid #bbb" }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#666" }}>
              Protein (g)
            </label>
            <input
              name="protein_g"
              inputMode="decimal"
              defaultValue="0"
              style={{ width: 140, padding: "10px 12px", borderRadius: 8, border: "1px solid #bbb" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#666" }}>
              Carbs (g)
            </label>
            <input
              name="carbs_g"
              inputMode="decimal"
              defaultValue="0"
              style={{ width: 140, padding: "10px 12px", borderRadius: 8, border: "1px solid #bbb" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#666" }}>
              Fat (g)
            </label>
            <input
              name="fat_g"
              inputMode="decimal"
              defaultValue="0"
              style={{ width: 140, padding: "10px 12px", borderRadius: 8, border: "1px solid #bbb" }}
            />
          </div>
        </div>

        <div style={{ color: "#777", fontSize: 13 }}>
          Numbers allow up to 2 decimals (e.g., 1.5, .25)
        </div>
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            name="save_as_meal"
            checked={saveAsMeal}
            onChange={(e) => setSaveAsMeal(e.target.checked)}
          />
          <span>Also save as a Saved Meal</span>
        </label>

        {saveAsMeal ? (
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", marginBottom: 6, color: "#666" }}>
              Saved Meal name (optional)
            </label>
            <input
              name="template_name"
              placeholder="Defaults to Description"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #bbb",
              }}
            />
          </div>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
