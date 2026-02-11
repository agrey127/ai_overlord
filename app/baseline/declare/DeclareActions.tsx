"use client";

export function DeclareActions() {
  return (
    <section style={{ marginTop: 24 }}>
      <h2>Log Something New</h2>

      <button
        type="button"
        onClick={() => alert("AI Food Logger coming next. This is a placeholder.")}
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          border: "1px solid #333",
          background: "white",
          cursor: "pointer",
        }}
      >
        Open AI Food Logger
      </button>

      <p style={{ marginTop: 8, color: "#666" }}>
        (Phase 4 skeleton — no logging yet)
      </p>
    </section>
  );
}
