import Link from "next/link";
import { fetchStepsLast14Days } from "@/lib/data/fitness";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const USER_ID = "agrey127@gmail.com";

function indianapolisDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Could not determine local day.");
  }

  return `${year}-${month}-${day}`;
}

function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function lastDays(endDay: string, count: number) {
  return Array.from({ length: count }, (_, idx) => shiftDay(endDay, -idx));
}

function fmtSteps(steps: number | null | undefined) {
  if (typeof steps !== "number" || !Number.isFinite(steps)) return "No data";
  return steps.toLocaleString();
}

function fmtShortDate(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export default async function StepsPage() {
  const endDay = indianapolisDay();
  const days = lastDays(endDay, 14);
  const startDay = days[days.length - 1];
  const rows = await fetchStepsLast14Days(USER_ID, endDay, startDay);
  const rowsByDay = new Map(rows.map((row) => [row.day, row]));
  const daily = days.map((day) => ({ day, row: rowsByDay.get(day) ?? null }));

  const logged = daily.filter((item) => typeof item.row?.steps === "number");
  const total = logged.reduce((sum, item) => sum + (item.row?.steps ?? 0), 0);
  const avg = logged.length ? Math.round(total / logged.length) : null;
  const maxSteps = Math.max(...logged.map((item) => item.row?.steps ?? 0), 1);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 90px" }}>
      <header style={{ marginBottom: 18 }}>
        <Link href="/baseline/fitness" className="card-muted" style={{ textDecoration: "none", fontSize: 13 }}>
          Back to Fitness
        </Link>
        <h1 style={{ margin: "8px 0 0" }}>Steps</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Last 14 days
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          marginBottom: 14,
        }}
      >
        <div className="card">
          <div className="card-inner">
            <div className="card-title">14d Average</div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 950 }}>
              {avg == null ? "No data" : avg.toLocaleString()}
            </div>
            <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
              Based on {logged.length}/14 logged days
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner">
            <div className="card-title">14d Total</div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 950 }}>
              {logged.length ? total.toLocaleString() : "No data"}
            </div>
            <div className="card-muted" style={{ marginTop: 6, fontSize: 13 }}>
              {startDay} to {endDay}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-inner" style={{ display: "grid", gap: 10 }}>
          {daily.map(({ day, row }) => {
            const steps = row?.steps ?? null;
            const width = typeof steps === "number" && maxSteps > 0 ? Math.max(5, Math.round((steps / maxSteps) * 100)) : 0;

            return (
              <div key={day} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 750 }}>{fmtShortDate(day)}</div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{fmtSteps(steps)}</div>
                </div>

                <div
                  aria-hidden="true"
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${width}%`,
                      height: "100%",
                      borderRadius: 999,
                      background:
                        steps == null
                          ? "transparent"
                          : "linear-gradient(90deg, rgba(34,197,94,0.86), rgba(168,85,247,0.92))",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
