import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Signal = {
  id: string;
  domain: string;
  signal_key: string;
  severity: number;
  score: number;
  title: string;
  message: string;
  recommendation: string | null;
  facts: string | null;
  is_active: boolean;
  updated_at: string;
};

async function getSignals(activeOnly: boolean): Promise<Signal[]> {
  const view = activeOnly
    ? "v_life_signals_active"
    : "v_life_signals_all";

  const { data, error } = await supabase
    .from(view)
    .select("*")
    .eq("user_id", "agrey127@gmail.com")
    .order("severity", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data as Signal[];
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const activeOnly = searchParams?.view !== "all";

  const signals = await getSignals(activeOnly);

  return (
    <main>
      <h1>Baseline — Life Signals</h1>

      <div style={{ marginTop: 12 }}>
        <a href="/baseline/signals">Active</a>{" "}
        |{" "}
        <a href="/baseline/signals?view=all">All</a>
      </div>

      <div style={{ marginTop: 20 }}>
        {signals.length === 0 && <p>No signals found.</p>}

        {signals.map((s) => (
          <details
            key={s.id}
            style={{
              marginBottom: 16,
              padding: 12,
              border: "1px solid #ccc",
              borderRadius: 8,
            }}
          >
            <summary style={{ cursor: "pointer" }}>
              <strong>{s.title}</strong>{" "}
              — Severity {s.severity} | Score {s.score}
            </summary>

            <div style={{ marginTop: 8 }}>
              {s.facts && <p><strong>Facts:</strong> {s.facts}</p>}
              <p>{s.message}</p>

              {s.recommendation && (
                <p>
                  <strong>Recommendation:</strong> {s.recommendation}
                </p>
              )}

              <p style={{ fontSize: 12, opacity: 0.6 }}>
                Domain: {s.domain} | Key: {s.signal_key}
              </p>
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
