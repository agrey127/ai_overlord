import Link from "next/link";
import { fetchRelationshipStatus } from "@/lib/data/relationships";
import { planRelationship, logRelationship } from "./actions";

function statusLabel(status: string) {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "unplanned":
      return "Unplanned";
    case "planned":
      return "Planned";
    case "completed":
      return "Done";
    default:
      return status;
  }
}

function statusOrder(status: string) {
  // priority: overdue -> unplanned -> planned -> completed -> everything else
  switch (status) {
    case "overdue":
      return 0;
    case "unplanned":
      return 1;
    case "planned":
      return 2;
    case "completed":
      return 3;
    default:
      return 9;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "overdue":
      return "var(--crit)";
    case "unplanned":
      return "var(--warn)";
    case "planned":
      return "rgba(168, 85, 247, 0.85)";
    case "completed":
      return "rgba(255,255,255,0.35)";
    default:
      return "rgba(255,255,255,0.28)";
  }
}

function Pill({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "warn" | "crit" | "brand" }) {
  const border =
    tone === "crit"
      ? "rgba(239, 68, 68, 0.35)"
      : tone === "warn"
      ? "rgba(245, 158, 11, 0.35)"
      : tone === "brand"
      ? "rgba(168, 85, 247, 0.30)"
      : "rgba(255,255,255,0.10)";

  const bg =
    tone === "crit"
      ? "rgba(239, 68, 68, 0.10)"
      : tone === "warn"
      ? "rgba(245, 158, 11, 0.10)"
      : tone === "brand"
      ? "rgba(124, 58, 237, 0.14)"
      : "rgba(255,255,255,0.03)";

  return (
    <span
      style={{
        border: `1px solid ${border}`,
        background: bg,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 12,
        whiteSpace: "nowrap",
        color: "rgba(255,255,255,0.82)",
      }}
    >
      {text}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(18, 22, 32, 0.55)",
  color: "rgba(255,255,255,0.92)",
  outline: "none",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.90)",
  cursor: "pointer",
};

export default async function RelationshipsPage() {
  const rows = await fetchRelationshipStatus();

  const sorted = [...rows].sort((a, b) => {
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });

  const counts = sorted.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.status === "overdue") acc.overdue += 1;
      else if (r.status === "unplanned") acc.unplanned += 1;
      else if (r.status === "planned") acc.planned += 1;
      else if (r.status === "completed") acc.completed += 1;
      else acc.other += 1;
      return acc;
    },
    { total: 0, overdue: 0, unplanned: 0, planned: 0, completed: 0, other: 0 }
  );

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      {/* Header */}
      <header style={{ marginBottom: 18 }}>
        <Link
          href="/baseline/more"
          style={{ textDecoration: "none", color: "rgba(255,255,255,0.72)" }}
        >
          ← Back
        </Link>

        <h1 style={{ margin: "12px 0 0 0" }}>Relationships</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Keep the promises that matter.
        </p>

        <div
          style={{
            height: 2,
            marginTop: 12,
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--p1), var(--p2), var(--p3))",
            opacity: 0.5,
          }}
        />
      </header>

      {/* Status summary */}
      <section style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="card-inner">
            <div className="card-title">Status</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <Pill text={`Overdue: ${counts.overdue}`} tone="crit" />
              <Pill text={`Unplanned: ${counts.unplanned}`} tone="warn" />
              <Pill text={`Planned: ${counts.planned}`} tone="brand" />
              <Pill text={`Done: ${counts.completed}`} />
            </div>

            <div className="card-muted" style={{ marginTop: 10, fontSize: 13 }}>
              Total commitments: {counts.total}
            </div>
          </div>
        </div>
      </section>

      {/* Commitments */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Commitments</div>
          <div className="card-muted" style={{ fontSize: 13 }}>
            Sorted by urgency.
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="card" style={{ borderStyle: "dashed", borderColor: "rgba(255,255,255,0.14)" }}>
            <div className="card-inner">
              <div style={{ fontWeight: 700 }}>Nothing here yet</div>
              <div className="card-muted" style={{ marginTop: 6 }}>
                Add commitments and you’ll see them show up.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {sorted.map((r) => (
              <div key={r.commitment_id} className="card">
                <div className="card-inner">
                  {/* Top row */}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: statusColor(r.status),
                          boxShadow: "0 0 0 4px rgba(255,255,255,0.02)",
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 800 }}>{r.name}</div>
                        <div className="card-muted" style={{ marginTop: 4, fontSize: 13 }}>
                          {r.frequency} • target {r.target_count} • {r.completed_count}/{r.target_count} done
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Pill
                        text={statusLabel(r.status)}
                        tone={r.status === "overdue" ? "crit" : r.status === "unplanned" ? "warn" : r.status === "planned" ? "brand" : "neutral"}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    <div className="card-muted" style={{ fontSize: 13 }}>
                      <span style={{ color: "rgba(255,255,255,0.86)", fontWeight: 650 }}>Planned:</span>{" "}
                      {r.planned_for ? new Date(r.planned_for).toLocaleString() : "— none"}
                    </div>

                    <div className="card-muted" style={{ fontSize: 13 }}>
                      <span style={{ color: "rgba(255,255,255,0.86)", fontWeight: 650 }}>Days remaining:</span>{" "}
                      {r.days_remaining}
                    </div>

                    {r.notes ? (
                      <div className="card-muted" style={{ fontSize: 13 }}>
                        <span style={{ color: "rgba(255,255,255,0.86)", fontWeight: 650 }}>Notes:</span>{" "}
                        {r.notes}
                      </div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                    {/* PLAN */}
                    <details
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 16,
                        padding: 12,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <summary style={{ cursor: "pointer", fontWeight: 750, color: "rgba(255,255,255,0.90)" }}>
                        Plan
                      </summary>

                      <form
                        action={planRelationship}
                        style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
                      >
                        <input type="hidden" name="commitment_id" value={r.commitment_id} />

                        <input
                          name="planned_for"
                          type="datetime-local"
                          defaultValue={r.planned_for ? new Date(r.planned_for).toISOString().slice(0, 16) : ""}
                          style={{ ...inputStyle, minWidth: 220 }}
                          required
                        />

                        <button
                          type="submit"
                          style={{
                            ...smallBtnStyle,
                            borderColor: "rgba(168, 85, 247, 0.26)",
                            background: "rgba(124, 58, 237, 0.14)",
                          }}
                        >
                          Save
                        </button>
                      </form>
                    </details>

                    {/* LOG */}
                    <details
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 16,
                        padding: 12,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <summary style={{ cursor: "pointer", fontWeight: 750, color: "rgba(255,255,255,0.90)" }}>
                        Log
                      </summary>

                      <form
                        action={logRelationship}
                        style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
                      >
                        <input type="hidden" name="commitment_id" value={r.commitment_id} />

                        <input
                          name="occurred_at"
                          type="datetime-local"
                          defaultValue={new Date().toISOString().slice(0, 16)}
                          style={{ ...inputStyle, minWidth: 220 }}
                          required
                        />

                        <button
                          type="submit"
                          style={{
                            ...smallBtnStyle,
                            borderColor: "rgba(255,255,255,0.14)",
                          }}
                        >
                          Save
                        </button>
                      </form>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
