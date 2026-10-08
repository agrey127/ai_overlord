import Link from "next/link";
import WeightWorkspace from "@/components/weight/WeightWorkspace";

export const dynamic = "force-dynamic";

export default function WeightPage() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Indianapolis", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 100px" }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/baseline/more" className="card-muted">← Back to More</Link>
        <h1 style={{ marginBottom: 6 }}>Weight Logs</h1>
        <p className="card-muted">Your weigh-ins and average weight over time.</p>
      </header>
      <WeightWorkspace today={today} />
    </main>
  );
}
