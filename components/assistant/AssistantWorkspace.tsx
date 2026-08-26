"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { AssistantBootstrap, AssistantChatResponse, AssistantConversation, AssistantMessage, StrengthWorkout } from "@/lib/assistant/types";
import styles from "./AssistantWorkspace.module.css";

const demoWorkout: StrengthWorkout = {
  id: "preview", name: "Lower strength", scheduled_for: "2026-08-02", estimated_minutes: 52,
  status: "scheduled", started_at: null, completed_at: null,
  exercises: [["Back squat",4,5],["Romanian deadlift",3,8],["Walking lunge",3,10],["Standing calf raise",3,12]].map(([name,sets,reps], i) => ({
    id: `preview-${i}`, exercise_name: String(name), position: i + 1, target_sets: Number(sets), target_reps: Number(reps), rest_seconds: 120, notes: null, sets: [],
  })),
};
const demoConversations: AssistantConversation[] = [
  { id: "demo-training", title: "Today’s training", domain: "strength", updated_at: new Date().toISOString() },
  { id: "demo-review", title: "Weekly review", domain: "planning", updated_at: new Date().toISOString() },
  { id: "demo-meals", title: "Meal planning", domain: "nutrition", updated_at: new Date().toISOString() },
];
const demoMessages: AssistantMessage[] = [
  { id: "hello", role: "assistant", content: "Good afternoon. Ready when you are.", created_at: new Date().toISOString() },
  { id: "question", role: "user", content: "What’s today’s workout?", created_at: new Date().toISOString() },
  { id: "answer", role: "assistant", content: "Lower strength. Four movements, about 52 minutes. We’ll start with back squat.", created_at: new Date().toISOString() },
];

function Icon({ name }: { name: "plus" | "send" | "spark" | "chevron" }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    send: <path d="m4 4 16 8-16 8 3-8-3-8Zm3 8h13" />,
    spark: <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Zm6 12 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />,
    chevron: <path d="m8 10 4 4 4-4" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

async function authHeaders() {
  const { data } = await getBrowserSupabase().auth.getSession();
  if (!data.session) throw new Error("Sign in to use your private assistant.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export default function AssistantWorkspace() {
  const [workout, setWorkout] = useState(demoWorkout);
  const [conversations, setConversations] = useState(demoConversations);
  const [messages, setMessages] = useState(demoMessages);
  const [selectedId, setSelectedId] = useState<string | null>("demo-training");
  const [draft, setDraft] = useState("");
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()), []);

  async function loadContext(conversationId?: string | null) {
    const headers = await authHeaders();
    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
    const response = await fetch(`/api/assistant/context${query}`, { headers });
    const data = (await response.json()) as AssistantBootstrap & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load your assistant.");
    setWorkout(data.workout); setConversations(data.conversations);
    setMessages(data.messages.filter((message) => message.role !== "tool")); setSelectedId(data.selectedConversationId);
  }

  useEffect(() => {
    const supabase = getBrowserSupabase(); let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return; setSignedIn(true);
      try { await loadContext(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load."); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return; setSignedIn(Boolean(session)); if (session) void loadContext();
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function sendMessage(text: string) {
    const clean = text.trim(); if (!clean || loading) return;
    if (!signedIn) { setAuthOpen(true); return; }
    const optimistic: AssistantMessage = { id: `pending-${Date.now()}`, role: "user", content: clean, created_at: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]); setDraft(""); setLoading(true); setError("");
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { ...(await authHeaders()), "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, conversationId: selectedId }) });
      const data = (await response.json()) as AssistantChatResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The assistant could not complete that request.");
      setMessages((current) => [...current, data.message]); setWorkout(data.workout); setSelectedId(data.conversationId);
      await loadContext(data.conversationId);
    } catch (e) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id)); setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  async function submitMagicLink(event: FormEvent) {
    event.preventDefault(); setAuthNotice("");
    const { error: signInError } = await getBrowserSupabase().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/baseline/assistant` } });
    setAuthNotice(signInError ? signInError.message : "Check your email for a secure sign-in link.");
  }
  function newConversation() {
    if (!signedIn) { setAuthOpen(true); return; }
    setSelectedId(null); setMessages([{ id: "new", role: "assistant", content: "New conversation. What are we working on?", created_at: new Date().toISOString() }]);
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><p className={styles.brand}>Baseline</p><p className={styles.date}>{dateLabel}</p></div>
      <div className={styles.headerTitle}><span className={styles.mark}><Icon name="spark" /></span>Assistant</div>
      <button className={styles.newButton} onClick={newConversation}><Icon name="plus" /><span>New</span></button>
    </header>
    <section className={styles.workspace}>
      <aside className={styles.conversationRail} aria-label="Conversations">
        <div className={styles.railHeading}><span>Conversations</span><button onClick={newConversation} aria-label="New conversation"><Icon name="plus" /></button></div>
        <div className={styles.conversationList}>{conversations.map((conversation) => <button key={conversation.id} className={conversation.id === selectedId ? styles.conversationActive : styles.conversation} onClick={() => signedIn ? void loadContext(conversation.id) : setSelectedId(conversation.id)}><span>{conversation.title}</span><small>{conversation.domain}</small></button>)}</div>
        <button className={styles.addConversation} onClick={newConversation}><Icon name="plus" />New conversation</button>
        <p className={styles.privacy}>{signedIn ? "Synced privately to your account" : "Preview mode · sign in to save"}</p>
      </aside>
      <section className={styles.chatPanel} aria-label="Assistant conversation">
        <button className={styles.mobileContext} onClick={() => setContextOpen((value) => !value)} aria-expanded={contextOpen}><span><small>Today’s training</small>{workout.name}</span><Icon name="chevron" /></button>
        {contextOpen && <WorkoutCard workout={workout} mobile />}
        <div className={styles.messages} aria-live="polite">
          {messages.map((message) => message.role !== "tool" && <article key={message.id} className={message.role === "user" ? styles.userMessage : styles.assistantMessage}>{message.role === "assistant" && <span className={styles.avatar}><Icon name="spark" /></span>}<div><span className={styles.speaker}>{message.role === "user" ? "You" : "Baseline"}</span><p>{message.content}</p></div></article>)}
          {loading && <article className={styles.assistantMessage}><span className={styles.avatar}><Icon name="spark" /></span><div><span className={styles.speaker}>Baseline</span><p className={styles.thinking}>Working through that…</p></div></article>}<div ref={endRef} />
        </div>
        <div className={styles.quickActions}><button onClick={() => void sendMessage("Start today’s workout.")}>Start workout</button><button onClick={() => void sendMessage("Help me log my next set.")}>Log a set</button><button onClick={() => void sendMessage("Review my recent strength progress.")}>Review progress</button></div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask Baseline anything…" aria-label="Message Baseline" /><button disabled={!draft.trim() || loading} aria-label="Send message"><Icon name="send" /></button></form>
        <p className={styles.disclaimer}>Baseline can make mistakes. Check important details.</p>
      </section>
      <aside className={styles.contextRail}><WorkoutCard workout={workout} /></aside>
    </section>
    {authOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}><section className={styles.authModal} role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className={styles.closeButton} onClick={() => setAuthOpen(false)} aria-label="Close">×</button><span className={styles.authMark}><Icon name="spark" /></span><h2 id="auth-title">Keep your Baseline</h2><p>Sign in with a private email link to save conversations, workouts, sets, and progress.</p><form onSubmit={submitMagicLink}><label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><button>Send secure link</button></form>{authNotice && <p className={styles.authNotice}>{authNotice}</p>}</section></div>}
  </main>;
}

function WorkoutCard({ workout, mobile = false }: { workout: StrengthWorkout; mobile?: boolean }) {
  const completed = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const target = workout.exercises.reduce((sum, exercise) => sum + exercise.target_sets, 0);
  return <section className={mobile ? styles.workoutMobile : styles.workoutCard}><div className={styles.workoutEyebrow}><span>Today’s training</span><span>{workout.estimated_minutes} min</span></div><h2>{workout.name}</h2><div className={styles.statusRow}><span className={styles.statusDot} />{workout.status.replace("_", " ")}<span>{completed}/{target} sets</span></div><ol className={styles.exerciseList}>{workout.exercises.map((exercise) => <li key={exercise.id}><span>{exercise.exercise_name}</span><strong>{exercise.target_sets}×{exercise.target_reps}</strong></li>)}</ol><div className={styles.progressTrack}><span style={{ width: `${target ? completed / target * 100 : 0}%` }} /></div></section>;
}
