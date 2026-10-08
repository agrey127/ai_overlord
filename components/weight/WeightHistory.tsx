"use client";

import { useState } from "react";
import type { WeightAverage, WeightLog } from "@/lib/data/weight";
import { rangeStart, weightRanges } from "@/lib/weight-chart";
import styles from "./WeightHistory.module.css";

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function Chart({ points, start, end }: { points: WeightAverage[]; start: string; end: string }) {
  if (!points.length) return <p className={styles.empty}>No weigh-ins in this time range. Choose a longer range to see earlier history.</p>;
  const values = points.map((p) => p.weight_7d_avg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, 1);
  const low = min - padding;
  const high = max + padding;
  const from = Date.parse(start);
  const to = Date.parse(end);
  const x = (day: string) => to === from ? 425 : 65 + (Date.parse(day) - from) / (to - from) * 720;
  const y = (value: number) => 240 - (value - low) / (high - low) * 210;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(2)},${y(p.weight_7d_avg).toFixed(2)}`).join(" ");
  return <div className={styles.chart}>
    <svg viewBox="0 0 820 290" role="img" aria-label={`Seven-day average weight in pounds from ${formatDay(start)} to ${formatDay(end)}`}>
      <title>Seven-day average weight (lb)</title>
      <desc>Each point averages recorded daily weights over that date and the previous six calendar days. Missing days are excluded.</desc>
      {[0, 1, 2, 3, 4].map((i) => {
        const value = low + (high - low) * i / 4;
        return <g key={i}><line x1="65" x2="785" y1={y(value)} y2={y(value)} stroke="currentColor" opacity="0.12" /><text x="53" y={y(value) + 4} textAnchor="end" fill="currentColor" fontSize="12">{value.toFixed(1)}</text></g>;
      })}
      <path d={path} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinejoin="round" />
      {points.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.weight_7d_avg)} r={points.length === 1 ? 5 : 3} fill="#a78bfa"><title>{formatDay(p.day)}: {p.weight_7d_avg.toFixed(1)} lb average</title></circle>)}
      <text x="65" y="277" fill="currentColor" fontSize="12">{formatDay(start)}</text>
      <text x="785" y="277" fill="currentColor" fontSize="12" textAnchor="end">{formatDay(end)}</text>
    </svg>
  </div>;
}

export default function WeightHistory({ logs, averages, today }: { logs: WeightLog[]; averages: WeightAverage[]; today: string }) {
  const [months, setMonths] = useState<number>(0);
  const [visibleLogs, setVisibleLogs] = useState(50);
  const cutoff = rangeStart(today, months);
  const points = averages.filter((p) => (!cutoff || p.day >= cutoff) && p.day <= today);
  const latest = logs[0];
  const latestAverage = averages[averages.length - 1];
  return <div className={styles.workspace}>
    <div className={styles.stats}>
      <div className="card"><div className="card-inner"><div className="card-title">Latest weigh-in</div><strong>{latest ? `${latest.weight_lbs.toFixed(1)} lb` : "—"}</strong><div className="card-muted">{latest ? new Date(latest.measured_at).toLocaleDateString("en-US", { timeZone: "America/Indianapolis", month: "short", day: "numeric", year: "numeric" }) : "No weight logged yet"}</div></div></div>
      <div className="card"><div className="card-inner"><div className="card-title">Latest average (7d)</div><strong>{latestAverage ? `${latestAverage.weight_7d_avg.toFixed(1)} lb` : "—"}</strong><div className="card-muted">{latestAverage ? `As of ${formatDay(latestAverage.day)}` : "No average available"}</div></div></div>
    </div>
    <section className="card" aria-labelledby="weight-chart-heading"><div className="card-inner">
      <h2 id="weight-chart-heading">Average weight</h2>
      <div className={styles.ranges} role="group" aria-label="Chart time range">
        {weightRanges.map((range) => <button type="button" key={range.months} aria-pressed={months === range.months} onClick={() => setMonths(range.months)}>{range.label}</button>)}
      </div>
      <Chart points={points} start={cutoff ?? points[0]?.day ?? today} end={today} />
      <p className="card-muted">7-day rolling average · lb. Each date averages daily weights from the past seven calendar days; days without measurements are excluded.</p>
    </div></section>
    <section className="card" aria-labelledby="weight-logs-heading"><div className="card-inner">
      <h2 id="weight-logs-heading">All weigh-ins <span className="card-muted">({logs.length})</span></h2>
      {logs.length ? <>
        <div className={styles.tableWrap}><table><thead><tr><th>Date & time</th><th>Weight</th><th>Source</th></tr></thead><tbody>
          {logs.slice(0, visibleLogs).map((log) => <tr key={`${log.measured_at}-${log.source}`}><td>{new Date(log.measured_at).toLocaleString("en-US", { timeZone: "America/Indianapolis", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td><td>{log.weight_lbs.toFixed(1)} lb</td><td>{log.source.replaceAll("_", " ")}</td></tr>)}
        </tbody></table></div>
        <p className="card-muted">Newest first · times in Indianapolis</p>
        {visibleLogs < logs.length ? <button className={styles.loadMore} type="button" onClick={() => setVisibleLogs((count) => count + 50)}>Show more weigh-ins</button> : null}
      </> : <p className={styles.empty}>No weight logged yet. Your imported weigh-ins will appear here.</p>}
    </div></section>
  </div>;
}
