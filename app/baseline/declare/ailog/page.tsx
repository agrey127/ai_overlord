"use client";

import React, { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { AiMealProposal } from "./types";
import { proposeAiMeal, confirmAiMealLog, saveAiMealTemplate } from "./actions";

type ChatMsg =
  | { id: string; role: "user"; text: string; hasImage: boolean }
  | { id: string; role: "assistant"; text: string };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function round1(n: number) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

function pct(n: number) {
  const v = Math.max(0, Math.min(1, n));
  return `${Math.round(v * 100)}%`;
}

async function fileToDataUrl(file: File): Promise<string> {
  // No storage — just analysis. Keep it small-ish.
  // If you want: add client-side resize later.
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function formatTotals(t: AiMealProposal["totals"]) {
  const bits = [
    `Calories ${Math.round(t.calories)}`,
    `P ${round1(t.protein_g)}g`,
    `C ${round1(t.carbs_g)}g`,
    `F ${round1(t.fat_g)}g`,
  ];
  return bits.join(" • ");
}

export default function AiLogPage() {
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("snack");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: uid(),
      role: "assistant",
      text:
        "Tell me what you ate. You can paste label numbers, speak in fractions, or throw a photo at me. I’ll do the math; you just do the chewing.",
    },
  ]);

  const [proposal, setProposal] = useState<AiMealProposal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = useMemo(() => {
    return text.trim().length > 0 || !!imageFile;
  }, [text, imageFile]);

  const helperText = useMemo(() => {
    if (!imageFile) return "Optional: attach a meal photo or nutrition label.";
    return `Attached: ${imageFile.name}`;
  }, [imageFile]);

  async function onSend() {
    setError(null);
    if (!canSend || busy) return;

    const userText = text.trim();
    const hasImg = !!imageFile;

    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", text: userText || "(image only)", hasImage: hasImg },
      { id: uid(), role: "assistant", text: "Alright, crunching numbers…" },
    ]);

    setText("");

    startTransition(async () => {
      try {
        const imageDataUrl = imageFile ? await fileToDataUrl(imageFile) : undefined;

        // Clear selected image after we’ve converted it
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        const p = await proposeAiMeal({
          text: userText,
          imageDataUrl,
          meal_type: mealType,
        });

        setProposal(p);
        setModalOpen(true);

        setMessages((m) => {
          const withoutThinking = m.slice(0, -1);
          return [
            ...withoutThinking,
            {
              id: uid(),
              role: "assistant",
              text: `I’ve got a draft. Review it before it hits your database:\n${formatTotals(p.totals)}`,
            },
          ];
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        setError(msg);
        setMessages((m) => {
          const withoutThinking = m.slice(0, -1);
          return [
            ...withoutThinking,
            {
              id: uid(),
              role: "assistant",
              text: `I tripped over my own shoelaces. Error: ${msg}`,
            },
          ];
        });
      }
    });
  }

  async function onConfirmLog() {
    if (!proposal) return;
    setError(null);

    startTransition(async () => {
      try {
        await confirmAiMealLog({
          description: proposal.description,
          meal_type: mealType,
          calories: proposal.totals.calories,
          protein_g: proposal.totals.protein_g,
          carbs_g: proposal.totals.carbs_g,
          fat_g: proposal.totals.fat_g,
          saturated_fat_g: proposal.totals.saturated_fat_g,
          fiber_g: proposal.totals.fiber_g,
          soluble_fiber_g: proposal.totals.soluble_fiber_g,
          sugar_g: proposal.totals.sugar_g,
          sodium_mg: proposal.totals.sodium_mg,
        });
        // confirmAiMealLog redirects on success
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    });
  }

  async function onSaveMeal() {
    if (!proposal) return;
    setError(null);

    startTransition(async () => {
      try {
        await saveAiMealTemplate({
          name: proposal.description,
          description: proposal.description,
          calories: proposal.totals.calories,
          protein_g: proposal.totals.protein_g,
          carbs_g: proposal.totals.carbs_g,
          fat_g: proposal.totals.fat_g,
          saturated_fat_g: proposal.totals.saturated_fat_g,
          fiber_g: proposal.totals.fiber_g,
          soluble_fiber_g: proposal.totals.soluble_fiber_g,
          sugar_g: proposal.totals.sugar_g,
          sodium_mg: proposal.totals.sodium_mg,
        });

        setMessages((m) => [
          ...m,
          { id: uid(), role: "assistant", text: `Saved meal template: "${proposal.description}"` },
        ]);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    });
  }
  //just a test
  function closeModal() {
    setModalOpen(false);
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "18px 14px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.2 }}>AI Food Log</div>
          <div style={{ opacity: 0.7, marginTop: 4, fontSize: 13 }}>
            Multi-item breakdown, one confirmed total in <code>meal_logs</code>. No image storage.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/baseline/declare"
            style={{
              textDecoration: "none",
              fontWeight: 700,
              opacity: 0.8,
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div
        className="card"
        style={{
          marginTop: 14,
        }}
      >
        <div className="card-inner">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ fontWeight: 800 }}>Meal type</div>

            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value as any)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
                outline: "none",
                fontWeight: 700,
              }}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-inner">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Chat</div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 10,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.18)",
              maxHeight: 420,
              overflow: "auto",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background:
                      m.role === "user" ? "rgba(128,90,213,0.18)" : "rgba(255,255,255,0.05)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.25,
                    fontSize: 14,
                  }}
                >
                  {"hasImage" in m && m.hasImage ? (
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>📷 image attached</div>
                  ) : null}
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Example: "2 tacos, 1/2 cup rice, beans. Label says 320 cals and 18g protein for tacos."`}
              style={{
                width: "100%",
                minHeight: 92,
                resize: "vertical",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
                outline: "none",
                lineHeight: 1.25,
              }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  style={{ display: "none" }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.05)",
                    color: "inherit",
                    fontWeight: 800,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  Add photo/label
                </button>

                <div style={{ fontSize: 12, opacity: 0.75 }}>{helperText}</div>
              </div>

              <button
                type="button"
                onClick={onSend}
                disabled={!canSend || busy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(128,90,213,0.28)",
                  color: "inherit",
                  fontWeight: 900,
                  cursor: !canSend || busy ? "not-allowed" : "pointer",
                  opacity: !canSend || busy ? 0.6 : 1,
                }}
              >
                {busy ? "Working…" : "Propose log"}
              </button>
            </div>

            {error ? (
              <div style={{ marginTop: 4, color: "rgba(255,120,120,0.95)", fontWeight: 700, fontSize: 13 }}>
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalOpen && proposal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            // click outside closes
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="card"
            style={{
              width: "min(920px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
            }}
          >
            <div className="card-inner">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.2 }}>Confirm meal log</div>
                  <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                    Confidence: <b>{pct(proposal.confidence)}</b>
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  disabled={busy}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginTop: 12, fontWeight: 800 }}>Description</div>
              <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
                {proposal.description}
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div
                  style={{
                    flex: "1 1 320px",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Items</div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {proposal.items.map((it, idx) => (
                      <div
                        key={`${it.name}-${idx}`}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(0,0,0,0.18)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 900 }}>{it.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{pct(it.confidence)}</div>
                        </div>
                        <div style={{ opacity: 0.8, marginTop: 2, fontSize: 13 }}>{it.quantity_text}</div>
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                          {Math.round(it.calories)} cal • P {round1(it.protein_g)}g • C {round1(it.carbs_g)}g • F{" "}
                          {round1(it.fat_g)}g
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    flex: "1 1 260px",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Totals (this is what gets logged)</div>

                  <div style={{ fontSize: 15, fontWeight: 900 }}>
                    {Math.round(proposal.totals.calories)} calories
                  </div>

                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 13, opacity: 0.9 }}>
                    <div>Protein: <b>{round1(proposal.totals.protein_g)}g</b></div>
                    <div>Carbs: <b>{round1(proposal.totals.carbs_g)}g</b></div>
                    <div>Fat: <b>{round1(proposal.totals.fat_g)}g</b></div>

                    {proposal.totals.fiber_g != null ? <div>Fiber: <b>{round1(proposal.totals.fiber_g)}g</b></div> : null}
                    {proposal.totals.sugar_g != null ? <div>Sugar: <b>{round1(proposal.totals.sugar_g)}g</b></div> : null}
                    {proposal.totals.sodium_mg != null ? <div>Sodium: <b>{Math.round(proposal.totals.sodium_mg)}mg</b></div> : null}
                    {proposal.totals.saturated_fat_g != null ? (
                      <div>Saturated fat: <b>{round1(proposal.totals.saturated_fat_g)}g</b></div>
                    ) : null}
                  </div>

                  {proposal.assumptions?.length ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Assumptions</div>
                      <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.75, fontSize: 12, lineHeight: 1.25 }}>
                        {proposal.assumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={onConfirmLog}
                      disabled={busy}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(110,231,183,0.16)",
                        color: "inherit",
                        fontWeight: 900,
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.6 : 1,
                        flex: "1 1 160px",
                      }}
                    >
                      {busy ? "Logging…" : "Confirm log"}
                    </button>

                    <button
                      onClick={onSaveMeal}
                      disabled={busy}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.06)",
                        color: "inherit",
                        fontWeight: 900,
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.6 : 1,
                        flex: "1 1 160px",
                      }}
                    >
                      {busy ? "Saving…" : "Save meal"}
                    </button>

                    <button
                      onClick={closeModal}
                      disabled={busy}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.03)",
                        color: "inherit",
                        fontWeight: 900,
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.6 : 1,
                        flex: "1 1 120px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {error ? (
                    <div style={{ marginTop: 10, color: "rgba(255,120,120,0.95)", fontWeight: 800, fontSize: 13 }}>
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
