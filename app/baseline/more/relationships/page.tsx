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

function Pill({ text }: { text: string }) {
  return (
    <span
      style={{
        border: "1px solid #ddd",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

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
    <main>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Baseline — Relationships</h1>
        <p style={{ marginTop: 6, color: "#555" }}>
          Keep the promises that matter.
        </p>
        <div style={{ marginTop: 10 }}>
          <Link href="/baseline/more">← Back</Link>
        </div>
      </header>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Status</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill text={`Overdue: ${counts.overdue}`} />
          <Pill text={`Unplanned: ${counts.unplanned}`} />
          <Pill text={`Planned: ${counts.planned}`} />
          <Pill text={`Done: ${counts.completed}`} />
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: 8 }}>Commitments</h2>

        {sorted.length === 0 ? (
          <div
            style={{
              border: "1px dashed #bbb",
              borderRadius: 10,
              padding: 12,
              color: "#666",
            }}
          >
            Nothing here yet. Add commitments and you’ll see them show up.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sorted.map((r) => (
              <div
                key={r.commitment_id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>{r.name}</strong>
                    <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
                      {r.frequency} • target {r.target_count} •{" "}
                      {r.completed_count}/{r.target_count} done
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Pill text={statusLabel(r.status)} />
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {r.planned_for ? (
                    <div style={{ color: "#555" }}>
                      <strong>Planned:</strong>{" "}
                      {new Date(r.planned_for).toLocaleString()}
                    </div>
                  ) : (
                    <div style={{ color: "#777" }}>
                      <strong>Planned:</strong> — none
                    </div>
                  )}

                  <div style={{ color: "#777" }}>
                    <strong>Days remaining:</strong> {r.days_remaining}
                  </div>

                  {r.notes ? (
                    <div style={{ color: "#777" }}>
                      <strong>Notes:</strong> {r.notes}
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {/* PLAN (collapsed) */}
                    <details style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
                        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Plan</summary>

                        <form
                        action={planRelationship}
                        style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}
                        >
                        <input type="hidden" name="commitment_id" value={r.commitment_id} />
                        <input
                            name="planned_for"
                            type="datetime-local"
                            defaultValue={
                            r.planned_for ? new Date(r.planned_for).toISOString().slice(0, 16) : ""
                            }
                            style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                            required
                        />
                        <button
                            type="submit"
                            style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            }}
                        >
                            Save
                        </button>
                        </form>
                    </details>

                    {/* LOG (collapsed) */}
                    <details style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
                        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Log</summary>

                        <form
                        action={logRelationship}
                        style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}
                        >
                        <input type="hidden" name="commitment_id" value={r.commitment_id} />
                        <input
                            name="occurred_at"
                            type="datetime-local"
                            defaultValue={new Date().toISOString().slice(0, 16)}
                            style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                            required
                        />
                        <button
                            type="submit"
                            style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fff",
                            }}
                        >
                            Save
                        </button>
                        </form>
                    </details>
                    </div>
                </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
