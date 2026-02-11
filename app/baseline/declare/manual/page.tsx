import Link from "next/link";
import { ManualLogForm } from "./ManualLogForm";

export default function ManualLogPage() {
  return (
    <main>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Manual Meal Log</h1>
        <p style={{ marginTop: 6, color: "#555" }}>
          Log anything — optionally save it as a template.
        </p>
        <Link href="/baseline/declare" style={{ textDecoration: "none" }}>
          ← Back to Declare
        </Link>
      </header>

      <ManualLogForm />
    </main>
  );
}
