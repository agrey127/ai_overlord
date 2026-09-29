"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(searchParams.get("error") === "link" ? "That sign-in link expired. Please request a new one." : "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void getBrowserSupabase().auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/baseline");
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const desktop = Boolean(window.baselineDesktop);
    const { error } = await getBrowserSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: desktop ? "baseline-desktop://auth/callback" : `${window.location.origin}/baseline/assistant`, shouldCreateUser: false },
    });
    setMessage(error ? error.message : desktop
      ? "Check your email and open the sign-in link. If Windows asks, allow it to open Baseline."
      : "Check your email for your sign-in link. It will sign you in across Baseline.");
    setSending(false);
  }

  return (
    <main style={{ maxWidth: 440, margin: "12vh auto", padding: "24px" }}>
      <div className="card" style={{ padding: 28 }}>
        <h1>Sign in to Baseline</h1>
        <p>Use your existing Supabase email sign-in for the whole app.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button disabled={sending}>{sending ? "Sending…" : "Send sign-in link"}</button>
        </form>
        {message && <p role="status">{message}</p>}
      </div>
    </main>
  );
}
