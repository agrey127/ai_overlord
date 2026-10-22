"use client";

import { useState, useTransition } from "react";
import { importGarminRuns, previewGarminRuns } from "./actions";
import styles from "./GarminImport.module.css";

type Preview = Awaited<ReturnType<typeof previewGarminRuns>>;

export function GarminImport({ configured, initialStart, today }: {
  configured: boolean; initialStart: string; today: string;
}) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(today);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, transition] = useTransition();
  function clear() { setPreview(null); setSelected([]); setMessage(""); }
  return <div className={styles.import}>
    <form onSubmit={(event) => {
      event.preventDefault(); clear();
      transition(async () => {
        try {
          const result = await previewGarminRuns(start, end);
          setPreview(result);
          setSelected(result.runs.filter((row) => !row.duplicate).map((row) => row.source_fingerprint));
          setMessage(result.error ?? `${result.runs.length} runs found. ${result.skipped} unsupported or incomplete entries skipped.`);
        } catch { setMessage("Unable to load the preview. Please try again."); }
      });
    }}>
      <fieldset disabled={!configured || pending} className={styles.range}>
        <label>From<input type="date" required value={start} max={end} onChange={(e) => { setStart(e.target.value); clear(); }} /></label>
        <label>Through<input type="date" required value={end} min={start} max={today} onChange={(e) => { setEnd(e.target.value); clear(); }} /></label>
        <button type="submit">{pending ? "Working…" : "Preview runs"}</button>
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {preview && !preview.error ? <>
      <div className={styles.list}>
        {preview.runs.map((run) => <label key={run.source_fingerprint} className={styles.run}>
          <input type="checkbox" disabled={pending || Boolean(run.duplicate)}
            checked={selected.includes(run.source_fingerprint)}
            onChange={(e) => setSelected((current) => e.target.checked
              ? [...current, run.source_fingerprint] : current.filter((id) => id !== run.source_fingerprint))} />
          <span><strong>{run.activity_date}</strong><br />
            {run.distance_miles === null ? "Distance unavailable" : `${run.distance_miles.toFixed(2)} mi`} · {run.duration_minutes.toFixed(1)} min<br />
            {run.calories_burned === null ? "Calories unavailable" : `${run.calories_burned} kcal`} · {run.average_heart_rate === null ? "Heart rate unavailable" : `${run.average_heart_rate} bpm`}<br />
            {run.cadence === null ? "Cadence unavailable" : `${run.cadence} steps/min`} · {run.pace_min_per_mile === null ? "Pace unavailable" : `${run.pace_min_per_mile.toFixed(2)} min/mi`}<br />
            <span className="card-muted">Garmin · {run.source_fingerprint.replace("garmin_personal:", "Activity ")}
              {run.duplicate === "imported" ? " · Already imported" : run.duplicate === "possible_match" ? " · Possible existing entry; excluded" : ""}</span>
          </span>
        </label>)}
      </div>
      <button type="button" disabled={pending || selected.length === 0} onClick={() => transition(async () => {
        try {
          const result = await importGarminRuns(start, end, selected);
          setPreview(null); setSelected([]);
          setMessage(`${result.imported} runs imported; ${result.duplicates} existing entries skipped.${result.error ? ` ${result.error}` : " Refresh the preview to check for more runs."}`);
        } catch { setMessage("The connection was interrupted. Refresh the preview to see which runs were saved before retrying."); }
      })}>Import {selected.length} selected {selected.length === 1 ? "run" : "runs"}</button>
    </> : null}
  </div>;
}
