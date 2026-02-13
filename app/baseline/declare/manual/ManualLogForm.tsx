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
        borderRadius: 12,
        border: "1px solid rgba(168, 85, 247, 0.28)",
        background:
          "radial-gradient(180px 80px at 20% 0%, rgba(124, 58, 237, 0.55), rgba(124, 58, 237, 0.18))",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 800,
        cursor: pending ? "not-allowed" : "pointer",
        boxShadow: "0 14px 40px rgba(124, 58, 237, 0.18)",
        transition: "transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Saving…" : "Log meal"}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(18, 22, 32, 0.55)",
  color: "rgba(255,255,255,0.92)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "rgba(255,255,255,0.62)",
  fontSize: 13,
};

function mealTypeButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: active
      ? "1px solid rgba(168, 85, 247, 0.28)"
      : "1px solid rgba(255,255,255,0.10)",
    background: active
      ? "rgba(124, 58, 237, 0.16)"
      : "rgba(255,255,255,0.03)",
    color: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)",
    cursor: "pointer",
    fontSize: 13,
    transition: "transform 160ms ease, background 160ms ease, border-color 160ms ease",
  };
}

export function ManualLogForm() {
  const router = useRouter();

  const [mealType, setMealType] =
    useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");

  const [saveAsMeal, setSaveAsMeal] = useState(false);

  async function action(formData: FormData) {
    formData.set("meal_type", mealType);

    await submitManualLog(formData);

    router.push("/baseline/declare");
    router.refresh();
  }

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      {/* Description */}
      <div>
        <label style={labelStyle}>Description</label>
        <input
          name="description"
          placeholder="e.g., Chipotle bowl, homemade pasta..."
          style={inputStyle}
        />
      </div>

      {/* Meal Type */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.62)", fontSize: 13 }}>Meal type:</span>
        {(["breakfast", "lunch", "dinner", "snack"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMealType(t)}
            style={mealTypeButtonStyle(mealType === t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Macros */}
      <div className="card" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
        <div className="card-inner">
          <div className="card-title">Macros</div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div style={{ maxWidth: 220 }}>
              <label style={labelStyle}>Calories</label>
              <input
                name="calories"
                inputMode="decimal"
                placeholder="e.g., 650"
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
            >
              <div>
                <label style={labelStyle}>Protein (g)</label>
                <input
                  name="protein_g"
                  inputMode="decimal"
                  defaultValue="0"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Carbs (g)</label>
                <input
                  name="carbs_g"
                  inputMode="decimal"
                  defaultValue="0"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Fat (g)</label>
                <input
                  name="fat_g"
                  inputMode="decimal"
                  defaultValue="0"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="card-muted" style={{ fontSize: 13 }}>
              Numbers allow up to 2 decimals (e.g., 1.5, .25)
            </div>
          </div>
        </div>
      </div>

      {/* Save as template */}
      <div className="card" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
        <div className="card-inner">
          <div className="card-title">Template</div>

          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
            <input
              type="checkbox"
              name="save_as_meal"
              checked={saveAsMeal}
              onChange={(e) => setSaveAsMeal(e.target.checked)}
            />
            <span style={{ color: "rgba(255,255,255,0.82)" }}>
              Also save as a Saved Meal
            </span>
          </label>

          {saveAsMeal ? (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Saved Meal name (optional)</label>
              <input
                name="template_name"
                placeholder="Defaults to Description"
                style={inputStyle}
              />
            </div>
          ) : (
            <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
              Optional, but future-you will thank you.
            </div>
          )}
        </div>
      </div>

      {/* Submit */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SubmitButton />
      </div>
    </form>
  );
}
