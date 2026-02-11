import Link from "next/link";

export default function MorePage() {
  return (
    <main>
      <h1>Baseline — More</h1>
      <p>Choose a module.</p>

      <ul style={{ marginTop: 12 }}>
        <li>
          <Link href="/baseline/more/relationships">Relationships</Link>
        </li>
      </ul>
    </main>
  );
}
