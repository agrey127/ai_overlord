"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { logSavedMeal } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #333",
        background: "white",
        cursor: pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Logging…" : label}
    </button>
  );
}

function normalizeServings(input: string): { ok: boolean; value?: number; error?: string } {
  const raw = input.trim();

  if (!raw) return { ok: false, error: "Servings is required" };

  // allow ".25" -> "0.25"
  const normalized = raw.startsWith(".") ? `0${raw}` : raw;

  // allow integers or decimals with up to 2 places
  // examples ok: "3", "1.5", "0.25"
  const re = /^\d+(\.\d{1,2})?$/;
  if (!re.test(normalized)) {
    return { ok: false, error: "Use a number with up to 2 decimals (e.g., 1, 1.5, 0.25)" };
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Servings must be > 0" };

  // round to 2 decimals to be safe
  const rounded = Math.round(n * 100) / 100;

  return { ok: true, value: rounded };
}

export function SavedMealLogForm({ savedMealId }: { savedMealId: string }) {
  const router = useRouter();

  // collapsed by default to save space
  const [open, setOpen] = useState(false);

  // only choose these after tapping log
  const [mealType, setMealType] =
    useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");

  // servings as a text box; default "1"
  const [servingsText, setServingsText] = useState("1");
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);

    const parsed = normalizeServings(servingsText);
    if (!parsed.ok) {
      setError(parsed.error ?? "Invalid servings");
      return;
    }

    // push current UI state into form payload
    formData.set("meal_type", mealType);

    // backend still expects "multiplier" (p_multiplier)
    formData.set("multiplier", String(parsed.value));

    await logSavedMeal(formData);

    // collapse + refresh so you see updates immediately
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <form action={() => {}} style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #333",
            background: "white",
            cursor: "pointer",
          }}
        >
          Log meal
        </button>
      </form>
    );
  }

  return (
    <form action={action} style={{ marginTop: 10, display: "grid", gap: 10 }}>
      <input type="hidden" name="saved_meal_id" value={savedMealId} />

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

      <div>
        <label style={{ display: "block", color: "#666", marginBottom: 6 }}>
          Servings
        </label>

        <input
          value={servingsText}
          onChange={(e) => setServingsText(e.target.value)}
          inputMode="decimal"
          placeholder="1"
          style={{
            width: 140,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #bbb",
          }}
        />

        <div style={{ marginTop: 6, color: "#777", fontSize: 13 }}>
          Examples: 1, 1.5, 0.25
        </div>

        {error ? (
          <div style={{ marginTop: 8, color: "#b00020", fontSize: 13 }}>
            {error}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <SubmitButton label="Confirm log" />

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setServingsText("1");
            setMealType("lunch");
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #bbb",
            background: "white",
            cursor: "pointer",
            color: "#666",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
