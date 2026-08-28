import Link from "next/link";
import SettingsWorkspace from "@/components/settings/SettingsWorkspace";

export default function SettingsPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 110px" }}>
      <header style={{ marginBottom: 18 }}>
        <Link href="/baseline/more" style={{ textDecoration: "none", color: "rgba(255,255,255,0.72)" }}>
          ← Back to More
        </Link>
        <h1 style={{ margin: "12px 0 0" }}>Profile & Goals</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Keep the personal targets Baseline uses to plan and track your progress.
        </p>
        <div style={{ height: 2, marginTop: 12, borderRadius: 999, background: "linear-gradient(90deg, var(--p1), var(--p2), var(--p3))", opacity: 0.5 }} />
      </header>
      <SettingsWorkspace />
    </main>
  );
}
