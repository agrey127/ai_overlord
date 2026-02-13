import Link from "next/link";

type Module = {
  title: string;
  description: string;
  href: string;
  accent?: boolean;
};

const modules: Module[] = [
  {
    title: "Relationships",
    description: "Anchors, cadence, presence gaps.",
    href: "/baseline/more/relationships",
  },
  {
    title: "Life Signals",
    description: "Inspect signals + history.",
    href: "/baseline/signals",
    accent: true,
  },
];

export default function MorePage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 90px" }}>
      {/* Header */}
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>More</h1>
        <p className="card-muted" style={{ marginTop: 6 }}>
          Modules that extend the system.
        </p>
      </header>

      {/* Modules grid (mobile 2-up, desktop 3-up via .more-grid in globals.css) */}
      <section>
        <div className="more-grid">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={
                  m.accent
                    ? {
                        borderColor: "rgba(168, 85, 247, 0.22)",
                        boxShadow: "0 14px 40px rgba(124, 58, 237, 0.14)",
                        background:
                          "radial-gradient(600px 220px at 10% 0%, rgba(124, 58, 237, 0.22), transparent 65%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                      }
                    : undefined
                }
              >
                <div className="card-inner">
                  <div style={{ fontSize: 16, fontWeight: 750 }}>{m.title}</div>

                  <div className="card-muted" style={{ marginTop: 8, fontSize: 13 }}>
                    {m.description}
                  </div>

                  <div style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
                    Open →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

