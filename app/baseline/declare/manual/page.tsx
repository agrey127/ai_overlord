import Link from "next/link";
import { ManualLogForm } from "./ManualLogForm";

export default function ManualLogPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      <header style={{ marginBottom: 18 }}>
        <Link
          href="/baseline/declare"
          style={{ textDecoration: "none", color: "rgba(255,255,255,0.72)" }}
        >
          ← Back to Declare
        </Link>

        <h1 style={{ margin: "12px 0 0 0" }}>Manual Meal Log</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Log anything — optionally save it as a template.
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

      <div className="card">
        <div className="card-inner">
          <ManualLogForm />
        </div>
      </div>
    </main>
  );
}
