import Link from "next/link";
import { ManualFitnessForm } from "./ManualFitnessForm";

export default function ManualFitnessPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      <header style={{ marginBottom: 18 }}>
        <Link
          href="/baseline/more"
          style={{ textDecoration: "none", color: "rgba(255,255,255,0.72)" }}
        >
          ← Back to More
        </Link>

        <h1 style={{ margin: "12px 0 0 0" }}>Manual Fitness Entry</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Home Assistant is offline, so this page lets you backfill the daily fitness row directly.
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

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div className="card">
          <div className="card-inner">
            <ManualFitnessForm />
          </div>
        </div>

        <aside className="card" style={{ borderColor: "rgba(168, 85, 247, 0.22)" }}>
          <div className="card-inner">
            <div className="card-title">Autofilled</div>
            <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700 }}>
              User ID
            </div>
            <div className="card-muted" style={{ marginTop: 4, fontSize: 13 }}>
              agrey127@gmail.com
            </div>

            <div style={{ marginTop: 14, fontSize: 14, fontWeight: 700 }}>
              Source
            </div>
            <div className="card-muted" style={{ marginTop: 4, fontSize: 13 }}>
              manual_entry
            </div>

            <div style={{ marginTop: 14, fontSize: 14, fontWeight: 700 }}>
              Default date
            </div>
            <div className="card-muted" style={{ marginTop: 4, fontSize: 13 }}>
              Yesterday, editable before submit
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
