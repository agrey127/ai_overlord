"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { fetchWeightHistory } from "@/lib/data/weight";
import WeightHistory from "./WeightHistory";

export default function WeightWorkspace({ today }: { today: string }) {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchWeightHistory>> | null>(null);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabase();
    async function load() {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;
        setHistory(null);
        setError("");
        setNeedsSignIn(!data.user);
        if (authError || !data.user) {
          setError("Sign in to view your weight history.");
          return;
        }
        const result = await fetchWeightHistory(supabase, data.user.email ?? data.user.id);
        if (!cancelled) setHistory(result);
      } catch {
        if (!cancelled) setError("Weight history could not be loaded. Please refresh to try again.");
      }
    }
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        cancelled = true;
        setHistory(null);
        setNeedsSignIn(true);
        setError("Sign in to view your weight history.");
      }
    });
    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, []);
  if (history) return <WeightHistory {...history} today={today} />;
  return <div className="card"><div className="card-inner">
    <p role={error ? "alert" : "status"}>{error || "Loading weight history…"}</p>
    {needsSignIn ? <Link href="/login">Sign in →</Link> : null}
  </div></div>;
}
