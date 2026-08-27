"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { AssistantBootstrap, AssistantChatResponse, AssistantConversation, AssistantConversationCreateResponse, AssistantMessage, AssistantThreadDomain, StrengthWorkout } from "@/lib/assistant/types";
import styles from "./AssistantWorkspace.module.css";

const demoWorkout: StrengthWorkout = {
  id: "preview", name: "Lower strength", scheduled_for: "2026-08-02", estimated_minutes: 52,
  status: "scheduled", started_at: null, completed_at: null,
  warmups: ["5 minutes of easy movement", "Dynamic mobility for the primary lift", "2–4 gradual ramp-up sets"],
  exercises: [["Back squat",4,5,"heavy"],["Romanian deadlift",3,8,"technique"],["Walking lunge",3,10,"accessory"],["Standing calf raise",3,12,"accessory"]].map(([name,sets,reps,role], i) => ({
    id: `preview-${i}`, exercise_name: String(name), position: i + 1, target_sets: Number(sets), target_reps: Number(reps), target_weight_lbs: null, training_role: String(role) as StrengthWorkout["exercises"][number]["training_role"], rest_seconds: 120, notes: null, sets: [],
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

const threadChoices: Array<{ domain: AssistantThreadDomain; label: string; description: string }> = [
  { domain: "strength", label: "Strength", description: "Workouts, sets, weights, and progress" },
  { domain: "running", label: "Running", description: "Runs, activity imports, and endurance" },
  { domain: "nutrition", label: "Nutrition", description: "Meals, habits, and fueling" },
];

function Icon({ name }: { name: "plus" | "send" | "spark" | "chevron" | "paperclip" }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    send: <path d="m4 4 16 8-16 8 3-8-3-8Zm3 8h13" />,
    spark: <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Zm6 12 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    paperclip: <path d="m9.5 12.5 5.7-5.7a3 3 0 0 1 4.2 4.2l-7.8 7.8a5 5 0 0 1-7.1-7.1l7.4-7.4a2 2 0 1 1 2.8 2.8l-7.4 7.4a1 1 0 0 1-1.4-1.4l6.7-6.7" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

type PendingImage = { id: string; file: File; previewUrl: string };

const MAX_COMBINED_IMAGE_BYTES = 640 * 1024;

function createAttachmentId(file: File) {
  const randomId = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${file.name}-${file.lastModified}-${randomId}`;
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read an attached screenshot."));
    reader.readAsDataURL(file);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to optimize an attached screenshot.")), "image/jpeg", quality);
  });
}

async function optimizeImage(file: File, targetBytes: number) {
  if (file.size <= targetBytes) return fileToDataUrl(file);

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Unable to open ${file.name}.`));
      element.src = sourceUrl;
    });
    const originalMaxDimension = Math.max(image.naturalWidth, image.naturalHeight);
    let maxDimension = Math.min(1800, originalMaxDimension);
    let quality = 0.84;
    let optimized: Blob | null = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const scale = Math.min(1, maxDimension / originalMaxDimension);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot optimize screenshots.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      optimized = await canvasToJpeg(canvas, quality);
      if (optimized.size <= targetBytes || maxDimension <= 900) break;
      maxDimension = Math.max(900, Math.round(maxDimension * 0.82));
      quality = Math.max(0.58, quality - 0.05);
    }

    return fileToDataUrl(optimized ?? file);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function readAssistantResponse(response: Response) {
  if (response.headers.get("content-type")?.includes("application/json")) {
    return response.json() as Promise<AssistantChatResponse & { error?: string }>;
  }
  if (response.status === 413) {
    throw new Error("The server rejected the screenshot upload as too large. The images were kept attached so you can retry.");
  }
  throw new Error(`The assistant server could not process the upload (HTTP ${response.status}).`);
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
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
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
  useEffect(() => { pendingImagesRef.current = pendingImages; }, [pendingImages]);
  useEffect(() => () => {
    pendingImagesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);

  async function sendMessage(text: string, attachedImages: PendingImage[] = []) {
    const clean = text.trim(); if ((!clean && !attachedImages.length) || loading) return;
    if (!signedIn) { setAuthOpen(true); return; }
    const displayText = clean || "Import this Garmin activity from the attached screenshot.";
    const optimisticContent = attachedImages.length
      ? `${displayText}\n${attachedImages.length} Garmin screenshot${attachedImages.length === 1 ? "" : "s"} attached`
      : displayText;
    const optimistic: AssistantMessage = { id: `pending-${Date.now()}`, role: "user", content: optimisticContent, created_at: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]); setDraft(""); setLoading(true); setError("");
    try {
      const targetBytes = Math.floor(MAX_COMBINED_IMAGE_BYTES / Math.max(1, attachedImages.length));
      const images: Array<{ data_url: string }> = [];
      for (const { file } of attachedImages) {
        images.push({ data_url: await optimizeImage(file, targetBytes) });
      }
      if (images.reduce((total, image) => total + image.data_url.length, 0) > 900_000) {
        throw new Error("The screenshots could not be reduced enough for a reliable upload. Try sending one or two at a time.");
      }
      const response = await fetch("/api/assistant", { method: "POST", headers: { ...(await authHeaders()), "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, conversationId: selectedId, images }) });
      const data = await readAssistantResponse(response);
      if (!response.ok) throw new Error(data.error ?? "The assistant could not complete that request.");
      setMessages((current) => [...current, data.message]); setWorkout(data.workout); setSelectedId(data.conversationId);
      if (attachedImages.length) {
        attachedImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
        setPendingImages([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      await loadContext(data.conversationId);
    } catch (e) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id)); setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  function addImages(files: FileList | null) {
    const incoming = Array.from(files ?? []);
    if (!incoming.length) return;
    const supported = incoming.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (supported.length !== incoming.length) { setError("Garmin screenshots must be JPEG, PNG, or WebP images."); return; }
    if (supported.some((file) => file.size > 8 * 1024 * 1024)) { setError("Each screenshot must be 8 MB or smaller."); return; }
    if (pendingImages.length + supported.length > 3) { setError("Attach at most 3 screenshots at a time."); return; }
    setError("");
    setPendingImages((current) => [...current, ...supported.map((file) => ({
      id: createAttachmentId(file),
      file,
      previewUrl: URL.createObjectURL(file),
    }))]);
  }

  function removeImage(id: string) {
    setPendingImages((current) => current.filter((image) => {
      if (image.id === id) URL.revokeObjectURL(image.previewUrl);
      return image.id !== id;
    }));
  }

  async function submitMagicLink(event: FormEvent) {
    event.preventDefault(); setAuthNotice("");
    const { error: signInError } = await getBrowserSupabase().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/baseline/assistant` } });
    setAuthNotice(signInError ? signInError.message : "Check your email for a secure sign-in link.");
  }
  function newConversation() {
    setNewThreadOpen(true);
  }

  async function createThread(domain: AssistantThreadDomain) {
    if (!signedIn) { setNewThreadOpen(false); setAuthOpen(true); return; }
    if (creatingThread) return;
    setCreatingThread(true); setError("");
    try {
      const response = await fetch("/api/assistant/conversations", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = (await response.json()) as AssistantConversationCreateResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to create the conversation.");
      setConversations((current) => [data.conversation, ...current.filter((item) => item.id !== data.conversation.id)]);
      setSelectedId(data.conversation.id); setMessages(data.messages); setNewThreadOpen(false); setContextOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create the conversation.");
    } finally { setCreatingThread(false); }
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
        <div className={styles.quickActions}>{workout.status !== "completed" ? <button onClick={() => void sendMessage(workout.status === "in_progress" ? "Finish today's workout." : "Start today's workout.")}>{workout.status === "in_progress" ? "Finish workout" : "Start workout"}</button> : null}<button onClick={() => void sendMessage("Help me log my next set.")}>Log a set</button><button onClick={() => void sendMessage("Review my recent strength progress.")}>Review progress</button></div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.composerArea}>
          {pendingImages.length ? <div className={styles.attachmentTray} aria-label="Attached Garmin screenshots">{pendingImages.map((image) => <figure key={image.id} className={styles.attachment}><Image src={image.previewUrl} alt="Garmin screenshot preview" width={58} height={58} unoptimized /><button type="button" onClick={() => removeImage(image.id)} aria-label={`Remove ${image.file.name}`}>×</button></figure>)}</div> : null}
          <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void sendMessage(draft, pendingImages); }}>
            <input ref={fileInputRef} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addImages(event.target.files); event.target.value = ""; }} />
            <button className={styles.attachButton} type="button" disabled={loading} onClick={() => fileInputRef.current?.click()} aria-label="Attach Garmin screenshots"><Icon name="paperclip" /></button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask Baseline anything…" aria-label="Message Baseline" />
            <button disabled={(!draft.trim() && !pendingImages.length) || loading} aria-label="Send message"><Icon name="send" /></button>
          </form>
        </div>
        <p className={styles.disclaimer}>Baseline can make mistakes. Check important details.</p>
      </section>
      <aside className={styles.contextRail}><WorkoutCard workout={workout} /></aside>
    </section>
    {newThreadOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingThread) setNewThreadOpen(false); }}><section className={styles.threadModal} role="dialog" aria-modal="true" aria-labelledby="thread-title"><button className={styles.closeButton} disabled={creatingThread} onClick={() => setNewThreadOpen(false)} aria-label="Close">×</button><span className={styles.authMark}><Icon name="plus" /></span><h2 id="thread-title">Start a new thread</h2><p>Choose a focus so each conversation stays organized.</p><div className={styles.threadChoices}>{threadChoices.map((choice) => <button key={choice.domain} type="button" disabled={creatingThread} onClick={() => void createThread(choice.domain)}><strong>{choice.label}</strong><span>{choice.description}</span></button>)}</div></section></div>}
    {authOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}><section className={styles.authModal} role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className={styles.closeButton} onClick={() => setAuthOpen(false)} aria-label="Close">×</button><span className={styles.authMark}><Icon name="spark" /></span><h2 id="auth-title">Keep your Baseline</h2><p>Sign in with a private email link to save conversations, workouts, sets, and progress.</p><form onSubmit={submitMagicLink}><label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><button>Send secure link</button></form>{authNotice && <p className={styles.authNotice}>{authNotice}</p>}</section></div>}
  </main>;
}

function formatWeight(weight: number) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1);
}

function WorkoutCard({ workout, mobile = false }: { workout: StrengthWorkout; mobile?: boolean }) {
  const completed = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const target = workout.exercises.reduce((sum, exercise) => sum + exercise.target_sets, 0);
  return <section className={mobile ? styles.workoutMobile : styles.workoutCard}>
    <div className={styles.workoutEyebrow}><span>Today’s training</span><span>{workout.estimated_minutes} min</span></div>
    <h2>{workout.name}</h2>
    <div className={styles.statusRow}><span className={styles.statusDot} />{workout.status.replace("_", " ")}<span>{completed}/{target} sets</span></div>
    {workout.warmups.length > 0 ? <section className={styles.warmupBlock} aria-label="Warm-up checklist">
      <span className={styles.warmupLabel}>Warm-up · not tracked</span>
      <ul>{workout.warmups.map((warmup) => <li key={warmup}>{warmup}</li>)}</ul>
    </section> : null}
    <ol className={styles.exerciseList}>{workout.exercises.map((exercise) => {
      const latestSet = exercise.sets.at(-1);
      const weight = exercise.target_weight_lbs == null
        ? latestSet == null ? "Weight —" : `Last ${formatWeight(latestSet.weight_lbs)} lb`
        : `${formatWeight(exercise.target_weight_lbs)} lb target`;
      return <li key={exercise.id}>
        <span>{exercise.exercise_name}</span>
        <span className={styles.exercisePrescription}><strong>{exercise.target_sets}×{exercise.target_reps}</strong><small><span className={styles.exerciseRole}>{exercise.training_role}</span> · {weight}</small></span>
      </li>;
    })}</ol>
    <div className={styles.progressTrack}><span style={{ width: `${target ? completed / target * 100 : 0}%` }} /></div>
  </section>;
}
