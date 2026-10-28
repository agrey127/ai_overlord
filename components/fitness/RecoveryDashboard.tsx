"use client";
import Link from "next/link";
import { useState } from "react";
import { dayOffset, recoveryStory, type RecoveryDay } from "../../lib/recovery";
import styles from "./recovery.module.css";

const signals = [
  { key: "sleep_seconds", label: "Sleep", unit: "hours", color: "#c084fc" },
  { key: "hrv_overnight_ms", label: "HRV", unit: "ms", color: "#46c7c9" },
  { key: "body_battery_at_wake", label: "Body Battery", unit: "at wake", color: "#c084fc" },
  { key: "stress_average", label: "Stress", unit: "daily average", color: "#46c7c9" },
] as const;
type Signal = typeof signals[number];
function duration(seconds: number | null | undefined) {
  if (seconds == null) return "Not recorded";
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function shortDay(day: string) { return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); }
function Arrow({ next = false }: { next?: boolean }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={next ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} /></svg>; }

function Chart({ days, rows, signal, selected, onSelect, mini = false }: { days: string[]; rows: RecoveryDay[]; signal: Signal; selected: string; onSelect?: (day: string) => void; mini?: boolean }) {
  const values = days.map(day => rows.find(r => r.day === day)?.[signal.key] ?? null);
  const converted = values.map(v => v == null ? null : signal.key === "sleep_seconds" ? v / 3600 : v);
  const numbers = converted.filter((v): v is number => v != null);
  const max = Math.max(signal.key === "sleep_seconds" ? 10 : signal.key === "hrv_overnight_ms" ? 60 : 100, ...numbers) * (mini ? 1 : 1.1);
  const width = mini ? 300 : 900, height = mini ? 75 : 220, left = mini ? 0 : 44, right = mini ? 0 : 24, bottom = mini ? 0 : 32, top = 12;
  const x = (i: number) => left + i / Math.max(1, days.length - 1) * (width - left - right);
  const y = (v: number) => top + (1 - v / max) * (height - top - bottom);
  let path = "", connected = false;
  converted.forEach((v, i) => { if (v == null) { connected = false; return; } path += `${connected ? "L" : "M"}${x(i)},${y(v)} `; connected = true; });
  return <div className={mini ? styles.mini : styles.chart}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${signal.label} trend; gaps indicate missing readings`}>
      {!mini && [0, 1, 2, 3, 4].map(i => { const v = max * i / 4; return <g key={i}><line x1={left} x2={width - right} y1={y(v)} y2={y(v)} stroke="#343b49" strokeDasharray="3 5" /><text x={left - 10} y={y(v) + 4} textAnchor="end" fill="#aeb7cb" fontSize="12">{Math.round(v)}</text></g>; })}
      <path d={path} fill="none" stroke={signal.color} strokeWidth={mini ? 2.5 : 2.5} strokeLinejoin="round" />
      {converted.map((v, i) => v == null ? null : <circle key={days[i]} cx={x(i)} cy={y(v)} r={mini ? 0 : days[i] === selected ? 5.5 : 3.5} fill={signal.color} stroke={days[i] === selected ? "#fff" : "none"}><title>{`${shortDay(days[i])}: ${signal.key === "sleep_seconds" ? duration(values[i]) : v}`}</title></circle>)}
      {!mini && days.map((day, i) => (i === 0 || i === days.length - 1 || i % Math.ceil(days.length / 6) === 0) && <text key={day} x={x(i)} y={height - 7} textAnchor="middle" fill="#aeb7cb" fontSize="12">{shortDay(day)}</text>)}
    </svg>
    {!mini && !numbers.length && <p>No readings in this window yet.</p>}
    {!mini && onSelect && <div className={styles.dayPicker} aria-label="Select a chart day">{days.map((day, i) => <button key={day} aria-pressed={selected === day} aria-label={`Explore ${shortDay(day)}${values[i] == null ? ", no reading" : ""}`} onClick={() => onSelect(day)} title={shortDay(day)}>{day.slice(-2)}</button>)}</div>}
  </div>;
}

export default function RecoveryDashboard({ rows, today, timeZone, failed = false }: { rows: RecoveryDay[]; today: string; timeZone: string; failed?: boolean }) {
  const [selected, setSelected] = useState(today);
  const [signalIndex, setSignalIndex] = useState(0);
  const [window, setWindow] = useState(7);
  const days = Array.from({ length: window }, (_, i) => dayOffset(today, i - window + 1));
  const row = rows.find(r => r.day === selected);
  const story = recoveryStory(row, rows);
  const signal = signals[signalIndex];
  const stamp = row?.updated_at ? Date.parse(row.updated_at) : NaN;
  const updated = Number.isFinite(stamp) ? new Date(stamp).toLocaleString("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No saved update";
  const clock = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" }) : "Not recorded";
  const baseline = row?.hrv_baseline_low_ms != null && row.hrv_baseline_high_ms != null ? `${row.hrv_baseline_low_ms}–${row.hrv_baseline_high_ms} ms` : "Not recorded";
  const details = [
    ["Bedtime", clock(row?.sleep_start_at)], ["Wake time", clock(row?.sleep_end_at)], ["Awake time", duration(row?.sleep_awake_seconds)],
    ["HRV baseline", baseline], ["Garmin HRV status (weekly)", row?.hrv_status?.toLowerCase() ?? "Not recorded"],
    ["Body Battery charged / drained", `${row?.body_battery_charged ?? "—"} / ${row?.body_battery_drained ?? "—"}`],
  ];
  return <main className={styles.root}>
    <Link href="/baseline/fitness" className={styles.back}><Arrow /> Fitness</Link>
    <header className={styles.heading}><div><h1>Recovery</h1><p>Your recent recovery, in context.</p></div><span>Saved update: {updated}</span></header>
    {failed ? <section className={styles.panel} role="alert"><h2>Couldn’t load your recovery</h2><p>Your saved records are safe. Refresh to try again.</p><button onClick={() => location.reload()}>Try again</button></section> : <>
      <section className={styles.panel} aria-label="Daily recovery snapshot">
        <div className={styles.dateNav}><button aria-label="Previous day" disabled={selected <= dayOffset(today, -27)} onClick={() => setSelected(dayOffset(selected, -1))}><Arrow /><span>Previous day</span></button><h2>{shortDay(selected)}{selected === today && <small>Today · still updating</small>}</h2><button aria-label="Next day" disabled={selected >= today} onClick={() => setSelected(dayOffset(selected, 1))}><span>Next day</span><Arrow next /></button></div>
        <div className={styles.story} aria-live="polite"><h2>{story.title}</h2><p>{story.text}</p></div>
        <div className={styles.signals}>{signals.map((s, i) => { const value = row?.[s.key]; return <button key={s.key} className={styles.signal} onClick={() => setSignalIndex(i)} aria-pressed={signalIndex === i}>
          <span className={styles.signalName}><span style={{ color: s.color }}>●</span> {s.label}</span><strong>{s.key === "sleep_seconds" ? duration(value) : value ?? "Not recorded"}{value != null && s.key !== "sleep_seconds" && <small>{s.unit === "ms" ? " ms" : ` ${s.unit}`}</small>}</strong>
          <Chart days={Array.from({ length: 7 }, (_, j) => dayOffset(selected, j - 6))} rows={rows} signal={s} selected={selected} mini />
        </button>; })}</div>
      </section>
      <section className={styles.panel} aria-labelledby="rhythm"><div className={styles.chartHeader}><h2 id="rhythm">Find your rhythm</h2><div className={styles.tabs} aria-label="Chart metric">{signals.map((s, i) => <button key={s.key} aria-pressed={signalIndex === i} onClick={() => setSignalIndex(i)}>{s.label}</button>)}</div><div className={styles.tabs} aria-label="Chart window">{[7, 28].map(n => <button key={n} aria-pressed={window === n} onClick={() => setWindow(n)}>{n} days</button>)}</div></div>
        <p className={styles.caption}>{signal.label} · {signal.unit}{signal.key === "sleep_seconds" ? " · excluding naps" : ""}</p>
        <Chart days={days} rows={rows} signal={signal} selected={selected} onSelect={setSelected} />
        <p className={styles.caption}>Select a day to explore its readings. Gaps mean no saved reading.</p>
      </section>
      <section className={styles.panel}><h2>The details</h2><dl className={styles.details}>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.caption}>Times in {timeZone}. Source: {row?.source === "garmin_personal" ? "Garmin Personal" : row?.source === "garminconnect" ? "Garmin legacy feed" : row?.source ? "Saved entry" : "No reading"}.</p></section>
      <p className={styles.footer}>Wearable estimates. Missing readings stay unknown. Daily stress and drain can change until the day ends.</p>
    </>}
  </main>;
}
