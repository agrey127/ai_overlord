import Link from "next/link";

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: "10px 12px",
        border: "1px solid #ddd",
        borderRadius: 8,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {label}
    </Link>
  );
}

export default function BaselineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: 16 }}>{children}</div>

      <nav
        style={{
          padding: 12,
          borderTop: "1px solid #eee",
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <NavLink href="/baseline" label="Home" />
        <NavLink href="/baseline/fitness" label="Fitness" />
        <NavLink href="/baseline/declare" label="I Declare" />
        <NavLink href="/baseline/finance" label="Finance" />
        <NavLink href="/baseline/more" label="More" />
      </nav>
    </div>
  );
}
