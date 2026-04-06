"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitManualFitness } from "./actions";

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
      {pending ? "Saving..." : "Save fitness entry"}
    </button>
  );
}

function getLocalYesterday() {
  const now = new Date();
  now.setDate(now.getDate() - 1);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function ManualFitnessForm() {
  const [day, setDay] = useState("");

  useEffect(() => {
    setDay(getLocalYesterday());
  }, []);

  return (
    <form action={submitManualFitness} style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div>
          <label htmlFor="day" style={labelStyle}>
            Date
          </label>
          <input
            id="day"
            name="day"
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="steps" style={labelStyle}>
            Steps
          </label>
          <input
            id="steps"
            name="steps"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="e.g. 10842"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="resting_heart_rate" style={labelStyle}>
            Resting heart rate
          </label>
          <input
            id="resting_heart_rate"
            name="resting_heart_rate"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="e.g. 49"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="sleep_score" style={labelStyle}>
            Sleep score
          </label>
          <input
            id="sleep_score"
            name="sleep_score"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="e.g. 83"
            required
            style={inputStyle}
          />
        </div>
      </div>

      <input type="hidden" name="user_id" value="agrey127@gmail.com" />

      <div className="card" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
        <div className="card-inner">
          <div className="card-title">Notes</div>
          <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
            Saving again for the same date will overwrite that day&apos;s manual fitness values.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SubmitButton />
      </div>
    </form>
  );
}
