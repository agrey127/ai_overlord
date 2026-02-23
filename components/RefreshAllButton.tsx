"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshAllButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-busy={isPending}
      title="Refetch everything on this page"
      className="btn"
      style={{
        height: 34,
        padding: "0 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        color: "var(--text)",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        opacity: isPending ? 0.7 : 1,
        cursor: isPending ? "not-allowed" : "pointer",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: isPending ? "rgba(255,255,255,0.25)" : "rgba(34,197,94,0.9)",
          boxShadow: isPending ? "none" : "0 0 0 4px rgba(34,197,94,0.10)",
        }}
      />
      {isPending ? "Refreshing…" : "Refresh"}
    </button>
  );
}