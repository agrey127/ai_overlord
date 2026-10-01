"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { AssistantBootstrap, AssistantChatResponse, AssistantConversation, AssistantConversationCreateResponse, AssistantMessage, AssistantThreadDomain, SavedMeal, StrengthWorkout } from "@/lib/assistant/types";
import { assistantRequestsConfirmation, CONFIRMATION_REPLY } from "@/lib/assistant/confirmation";
import RunningCoachCard, { type RunningCoachCardData } from "./RunningCoachCard";
import DelegationBoard from "./DelegationBoard";
import type { AssistantDelegation } from "@/lib/assistant/delegations";
import styles from "./AssistantWorkspace.module.css";

const demoWorkout: StrengthWorkout = {
  id: "preview", name: "Day 1 · Lower strength", scheduled_for: null, estimated_minutes: 52, notes: null,
  status: "next", started_at: null, completed_at: null, is_template: true, template_id: "preview", rotation_position: 1,
  warmups: ["5 minutes of easy movement", "Dynamic mobility for the primary lift", "2–4 gradual ramp-up sets"],
  exercises: [["Back squat",4,5,"heavy"],["Romanian deadlift",3,8,"technique"],["Walking lunge",3,10,"accessory"],["Standing calf raise",3,12,"accessory"]].map(([name,sets,reps,role], i) => ({
    id: `preview-${i}`, exercise_name: String(name), position: i + 1, target_sets: Number(sets), target_reps: Number(reps), target_weight_lbs: null, training_role: String(role) as StrengthWorkout["exercises"][number]["training_role"], rest_seconds: 120, notes: null, sets: [],
  })),
};
const demoConversations: AssistantConversation[] = [
  { id: "demo-chief", title: "Chief of Staff", domain: "chief_of_staff", updated_at: new Date().toISOString() },
  { id: "demo-general", title: "General", domain: "general", updated_at: new Date().toISOString() },
  { id: "demo-training", title: "Next workout", domain: "strength", updated_at: new Date().toISOString() },
  { id: "demo-running", title: "Running coach", domain: "running", updated_at: new Date().toISOString() },
  { id: "demo-review", title: "Weekly review", domain: "planning", updated_at: new Date().toISOString() },
  { id: "demo-meals", title: "Meal planning", domain: "nutrition", updated_at: new Date().toISOString() },
];
const demoMessages: AssistantMessage[] = [
  { id: "hello", role: "assistant", content: "Good afternoon. Ready when you are.", created_at: new Date().toISOString() },
  { id: "question", role: "user", content: "What’s today’s workout?", created_at: new Date().toISOString() },
  { id: "answer", role: "assistant", content: "Lower strength. Four movements, about 52 minutes. We’ll start with back squat.", created_at: new Date().toISOString() },
];
const demoMessagesByConversation: Record<string, AssistantMessage[]> = {
  "demo-chief": [
    { id: "chief-hello", role: "assistant", content: "I can prioritize across strength, running, and nutrition, and delegate focused reviews to each coach. Ask for a current brief or tell me what needs attention.", created_at: new Date().toISOString() },
  ],
  "demo-general": [
    { id: "general-hello", role: "assistant", content: "Ask me about your running, meals, or workouts. For example: How many miles did I run this week?", created_at: new Date().toISOString() },
  ],
  "demo-training": demoMessages,
  "demo-running": [
    { id: "running-hello", role: "assistant", content: "I can help set a running goal, plan a week, and review your logged runs. Start by telling me what you want to work toward.", created_at: new Date().toISOString() },
  ],
  "demo-review": [
    { id: "review-hello", role: "assistant", content: "Let’s review the week and decide what matters next.", created_at: new Date().toISOString() },
  ],
  "demo-meals": [
    { id: "meal-confirm", role: "assistant", content: "I have the nutrition entry ready. Please confirm before I save it.", created_at: new Date().toISOString() },
  ],
};

const demoSavedMeals: SavedMeal[] = [
  { id: "meal-1", name: "Eggs and toast", description: "Three eggs, sourdough toast, and coffee", calories: 520, protein_g: 31, carbs_g: 43, fat_g: 25 },
  { id: "meal-2", name: "Chicken rice bowl", description: "Chicken breast, jasmine rice, and vegetables", calories: 690, protein_g: 58, carbs_g: 78, fat_g: 14 },
  { id: "meal-3", name: "Protein oats", description: "Oats, whey, berries, and peanut butter", calories: 610, protein_g: 44, carbs_g: 71, fat_g: 18 },
];

const threadChoices: Array<{ domain: AssistantThreadDomain; label: string; description: string }> = [
  { domain: "chief_of_staff", label: "Chief of Staff", description: "Priorities, decisions, and specialist assignments" },
  { domain: "general", label: "General", description: "Questions across your Baseline data" },
  { domain: "strength", label: "Strength", description: "Workouts, sets, weights, and progress" },
  { domain: "running", label: "Running", description: "Goal setting, weekly plans, run reviews, and imports" },
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
type SpokenReplyPlayback = { cancel: () => void };
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

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
  const router = useRouter();
  const [workout, setWorkout] = useState(demoWorkout);
  const [savedMeals, setSavedMeals] = useState(demoSavedMeals);
  const [runningCoach, setRunningCoach] = useState<RunningCoachCardData | null>(null);
  const [delegations, setDelegations] = useState<AssistantDelegation[]>([]);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [conversations, setConversations] = useState(demoConversations);
  const [messages, setMessages] = useState(demoMessages);
  const [selectedId, setSelectedId] = useState<string | null>("demo-training");
  const [draft, setDraft] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingMealMessageId, setSavingMealMessageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<AssistantThreadDomain>("chief_of_staff");
  const [contextReady, setContextReady] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const waitingForWisprPasteRef = useRef(false);
  const voiceDraftStartRef = useRef("");
  const draftRef = useRef("");
  const dictationSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dictationSendRef = useRef<() => void>(() => {});
  const voiceTurnRef = useRef(false);
  const voiceConversationIdRef = useRef<string | null>(null);
  const voiceFocusInProgressRef = useRef(false);
  const spokenReplyRef = useRef<SpokenReplyPlayback | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()), []);
  const conversationsByDomain = useMemo(() => {
    const indexed = new Map<AssistantThreadDomain, AssistantConversation>();
    for (const conversation of conversations) {
      if (
        (conversation.domain === "general" || conversation.domain === "strength" || conversation.domain === "nutrition" || conversation.domain === "running" || conversation.domain === "chief_of_staff")
        && !indexed.has(conversation.domain)
      ) {
        indexed.set(conversation.domain, conversation);
      }
    }
    return indexed;
  }, [conversations]);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);
  const activeChatLabel = threadChoices.find((choice) => choice.domain === selectedConversation?.domain)?.label ?? "Assistant";
  const isGeneralChat = selectedConversation?.domain === "general";
  const isChiefOfStaffChat = selectedConversation?.domain === "chief_of_staff";
  const isStrengthChat = selectedConversation?.domain === "strength";
  const isRunningChat = selectedConversation?.domain === "running";
  const isNutritionChat = selectedConversation?.domain === "nutrition";
  const latestMessage = messages.at(-1);
  const confirmationRequired = latestMessage?.role === "assistant" && assistantRequestsConfirmation(
    latestMessage.content,
    latestMessage.metadata?.confirmation_required === true,
  );
  const saveableMealMessage = latestMessage?.role === "assistant"
    && Number.isSafeInteger(Number(latestMessage.metadata?.save_to_meals_log_id))
    ? latestMessage
    : null;
  const mealSavedToList = saveableMealMessage?.metadata?.saved_to_meals === true;

  async function loadContext(conversationId?: string | null) {
    const headers = await authHeaders();
    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
    const response = await fetch(`/api/assistant/context${query}`, { headers });
    const data = (await response.json()) as AssistantBootstrap & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load your assistant.");
    setWorkout(data.workout); setSavedMeals(data.savedMeals); setConversations(data.conversations);
    setDelegations(data.delegations ?? []);
    setMessages(data.messages.filter((message) => message.role !== "tool")); setSelectedId(data.selectedConversationId);
    const selected = data.conversations.find((conversation) => conversation.id === data.selectedConversationId);
    setContextReady(true);
    if (selected?.domain === "running") {
      const coachResponse = await fetch("/api/assistant/running", { headers });
      const coachData = (await coachResponse.json()) as RunningCoachCardData & { error?: string };
      if (coachResponse.ok) setRunningCoach(coachData);
      else { setRunningCoach(null); setError(coachData.error ?? "Unable to load the Running coach."); }
    } else setRunningCoach(null);
  }

  useEffect(() => {
    const supabase = getBrowserSupabase(); let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return; setSignedIn(true);
      try { await loadContext(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load."); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedIn(Boolean(session));
      if (session) void loadContext();
      else { setContextReady(false); voiceConversationIdRef.current = null; }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const desktop = window.baselineDesktop;
    if (!desktop || typeof desktop.getVoiceTarget !== "function") return;
    setDesktopAvailable(true);
    void desktop.getVoiceTarget().then(setVoiceTarget);
    return desktop.onVoiceTargetChanged(setVoiceTarget);
  }, []);
  useLayoutEffect(() => {
    const pane = messagesRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [messages, loading]);
  useEffect(() => { pendingImagesRef.current = pendingImages; }, [pendingImages]);
  useEffect(() => {
    if (isRunningChat) return;
    setPendingImages((current) => {
      current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      return current.length ? [] : current;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [isRunningChat]);
  useEffect(() => () => {
    pendingImagesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);

  async function sendMessage(text: string, attachedImages: PendingImage[] = [], voiceConversationId?: string) {
    const clean = text.trim(); if ((!clean && !attachedImages.length) || loading) return;
    const fromVoice = voiceTurnRef.current;
    voiceTurnRef.current = false;
    if (!signedIn) { router.push("/login"); return; }
    const conversationId = voiceConversationId ?? selectedId;
    if (!conversationId) { setError("Choose a chat before sending a message."); return; }
    if (attachedImages.length && !isRunningChat) { setError("Garmin run screenshots belong in the Running chat."); return; }
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
      const response = await fetch("/api/assistant", { method: "POST", headers: { ...(await authHeaders()), "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, conversationId, images, voiceMode: fromVoice }) });
      const data = await readAssistantResponse(response);
      if (!response.ok) throw new Error(data.error ?? "The assistant could not complete that request.");
      setMessages((current) => [...current, data.message]); setWorkout(data.workout); setSelectedId(data.conversationId);
      if (fromVoice && window.baselineDesktop) void speakAssistantReply(data.message, data.conversationId);
      if (attachedImages.length) {
        attachedImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
        setPendingImages([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      await loadContext(data.conversationId);
    } catch (e) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id)); setError(e instanceof Error ? e.message : "Something went wrong.");
      if (fromVoice) window.baselineDesktop?.turnFailed();
    } finally { setLoading(false); if (fromVoice) voiceConversationIdRef.current = null; }
  }

  async function retryDelegation(taskId: string) {
    if (!selectedId || retryingTaskId) return;
    setRetryingTaskId(taskId); setError("");
    try {
      const response = await fetch("/api/assistant/delegations", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, taskId }),
      });
      const data = (await response.json()) as { task?: AssistantDelegation; error?: string };
      if (!response.ok || !data.task) throw new Error(data.error ?? "Unable to retry the specialist task.");
      setDelegations((current) => current.map((task) => task.id === data.task!.id ? data.task! : task));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to retry the specialist task.");
    } finally { setRetryingTaskId(null); }
  }

  async function speakAssistantReply(message: AssistantMessage, conversationId: string) {
    const desktop = window.baselineDesktop;
    if (!desktop) return;
    const controller = new AbortController();
    let audio: HTMLAudioElement | null = null;
    let finishAudio: (() => void) | null = null;
    let interrupted = false;
    const playback: SpokenReplyPlayback = { cancel: () => {
      if (interrupted) return;
      interrupted = true;
      controller.abort();
      if (audio) { audio.pause(); try { audio.currentTime = 0; } catch { /* audio may not have loaded */ } }
      finishAudio?.();
    } };
    spokenReplyRef.current = playback;
    setSpeaking(true);
    desktop.replyStarted();
    let audioUrl: string | null = null;
    try {
      const response = await fetch("/api/assistant/speech", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, messageId: message.id }),
        signal: controller.signal,
      });
      if (interrupted) return;
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Baseline could not speak this reply.");
      }
      audioUrl = URL.createObjectURL(await response.blob());
      if (interrupted) return;
      const replyAudio = new Audio(audioUrl);
      audio = replyAudio;
      await new Promise<void>((resolve, reject) => {
        finishAudio = resolve;
        replyAudio.onended = () => resolve();
        replyAudio.onerror = () => reject(new Error("Baseline could not play this reply."));
        void replyAudio.play().catch(reject);
      });
    } catch (error) {
      if (!interrupted) setError(error instanceof Error ? error.message : "Baseline could not speak this reply.");
    } finally {
      if (audio) { audio.onended = null; audio.onerror = null; }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (spokenReplyRef.current === playback) spokenReplyRef.current = null;
      setSpeaking(false);
      desktop.replyFinished();
    }
  }

  useEffect(() => {
    const desktop = window.baselineDesktop;
    if (!desktop) return;
    const stopFocus = desktop.onFocusComposer((domain) => {
      if (!signedIn || !contextReady || loading || voiceFocusInProgressRef.current) return;
      const targetDomain = threadChoices.some((choice) => choice.domain === domain) ? domain : "chief_of_staff";
      voiceFocusInProgressRef.current = true;
      void (async () => {
        try {
          if (draft.trim() && selectedConversation?.domain !== targetDomain) {
            throw new Error("Finish or clear the draft in the open chat before starting voice in another chat.");
          }
          let conversationId = selectedConversation?.domain === targetDomain && selectedId && !selectedId.startsWith("demo-") ? selectedId : null;
          if (!conversationId) {
            const response = await fetch("/api/assistant/conversations", {
              method: "POST",
              headers: { ...(await authHeaders()), "Content-Type": "application/json" },
              body: JSON.stringify({ domain: targetDomain }),
            });
            const data = (await response.json()) as AssistantConversationCreateResponse & { error?: string };
            if (!response.ok || !data.conversation) throw new Error(data.error ?? "Could not open the selected voice chat.");
            conversationId = data.conversation.id;
            await loadContext(conversationId);
          }
          voiceConversationIdRef.current = conversationId;
          voiceDraftStartRef.current = draftRef.current;
          composerRef.current?.focus();
          composerRef.current?.select();
          if (document.activeElement !== composerRef.current) throw new Error("Could not focus the selected voice chat.");
          desktop.composerReady();
        } catch (error) {
          voiceConversationIdRef.current = null;
          const message = error instanceof Error ? error.message : "Could not open the selected voice chat.";
          setError(message);
          if (typeof desktop.focusFailed === "function") desktop.focusFailed(message);
          else desktop.turnFailed();
        } finally { voiceFocusInProgressRef.current = false; }
      })();
    });
    const stopDictation = desktop.onDictationStop(() => {
      waitingForWisprPasteRef.current = true;
      if (draftRef.current !== voiceDraftStartRef.current) dictationSendRef.current();
    });
    const stopSpeaking = typeof desktop.onStopSpeaking === "function"
      ? desktop.onStopSpeaking(() => spokenReplyRef.current?.cancel()) : () => {};
    const stopError = desktop.onVoiceError((message) => {
      waitingForWisprPasteRef.current = false;
      if (dictationSettleTimerRef.current) clearTimeout(dictationSettleTimerRef.current);
      voiceConversationIdRef.current = null; setError(message);
    });
    desktop.assistantReady();
    return () => { stopFocus(); stopDictation(); stopSpeaking(); stopError(); };
  }, [signedIn, contextReady, selectedId, selectedConversation?.domain, draft, loading]);

  function queueDictationSend() {
    if (dictationSettleTimerRef.current) clearTimeout(dictationSettleTimerRef.current);
    dictationSettleTimerRef.current = setTimeout(() => {
      dictationSettleTimerRef.current = null;
      if (!waitingForWisprPasteRef.current) return;
      const dictated = draftRef.current.replace(/[\s,.;!?]*(?:send it|hello[,]? baseline)[.!?\s]*$/i, "").trim();
      if (!dictated) return;
      waitingForWisprPasteRef.current = false;
      if (!voiceConversationIdRef.current) {
        setError("The voice chat was not ready. Try again.");
        window.baselineDesktop?.turnFailed();
        return;
      }
      window.baselineDesktop?.dictationPasted();
      voiceTurnRef.current = true;
      void sendMessage(dictated, [], voiceConversationIdRef.current);
    }, 900);
  }
  dictationSendRef.current = queueDictationSend;

  function onComposerChange(value: string) {
    setDraft(value);
    draftRef.current = value;
    if (waitingForWisprPasteRef.current) queueDictationSend();
  }

  async function finishWorkout() {
    if (loading) return;
    if (!signedIn) { router.push("/login"); return; }
    if (!selectedId) { setError("Open the strength chat before finishing a workout."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/assistant/workouts/complete", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId }),
      });
      const data = await readAssistantResponse(response);
      if (!response.ok) throw new Error(data.error ?? "The workout could not be completed.");
      setMessages((current) => [...current, {
        id: `finish-user-${Date.now()}`,
        role: "user",
        content: "Finish my current workout.",
        created_at: new Date().toISOString(),
      }, data.message]);
      setWorkout(data.workout);
      await loadContext(data.conversationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The workout could not be completed.");
      await loadContext(selectedId).catch(() => undefined);
    } finally { setLoading(false); }
  }

  async function saveLoggedMeal(message: AssistantMessage) {
    if (savingMealMessageId) return;
    if (!signedIn) { router.push("/login"); return; }
    setSavingMealMessageId(message.id); setError("");
    try {
      const response = await fetch("/api/assistant/meals/save", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      });
      const data = (await response.json()) as { meal?: SavedMeal; error?: string };
      if (!response.ok || !data.meal) throw new Error(data.error ?? "Unable to save the meal.");
      setSavedMeals((current) => [...current.filter((meal) => meal.id !== data.meal!.id), data.meal!]
        .sort((a, b) => a.name.localeCompare(b.name)));
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, metadata: { ...item.metadata, saved_meal_id: data.meal!.id, saved_to_meals: true } }
        : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save the meal.");
    } finally { setSavingMealMessageId(null); }
  }

  function addImages(files: FileList | null) {
    if (!isRunningChat) { setError("Garmin run screenshots belong in the Running chat."); return; }
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

  function newConversation() {
    composerRef.current?.blur();
    setNewThreadOpen(true);
  }

  function selectDomain(domain: AssistantThreadDomain) {
    composerRef.current?.blur();
    const conversation = conversationsByDomain.get(domain);
    if (conversation) {
      setNewThreadOpen(false);
      setContextOpen(false);
      selectConversation(conversation);
      return;
    }
    void createThread(domain);
  }

  function selectConversation(conversation: AssistantConversation) {
    if (signedIn) { void loadContext(conversation.id); return; }
    setSelectedId(conversation.id);
    setMessages(demoMessagesByConversation[conversation.id] ?? demoMessages);
  }

  async function changeVoiceTarget(domain: AssistantThreadDomain) {
    const desktop = window.baselineDesktop;
    if (!desktop) return;
    const result = await desktop.setVoiceTarget(domain);
    if (result.ok) { setVoiceTarget(domain); setError(""); }
    else setError(result.error ?? "Could not change the voice chat.");
  }

  async function createThread(domain: AssistantThreadDomain) {
    if (!signedIn) { setNewThreadOpen(false); router.push("/login"); return; }
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
      if (domain === "running") await loadContext(data.conversation.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create the conversation.");
    } finally { setCreatingThread(false); }
  }

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div><p className={styles.brand}>Baseline</p><p className={styles.date}>{dateLabel}</p></div>
      <div className={styles.headerTitle}><span className={styles.mark}><Icon name="spark" /></span><span className={styles.headerChatName}>{activeChatLabel}</span></div>
      <button className={styles.newButton} onClick={newConversation}><Icon name="spark" /><span>Chats</span></button>
    </header>
    <section className={styles.workspace}>
      <aside className={styles.conversationRail} aria-label="Conversations">
        <div className={styles.railHeading}><span>Chats</span></div>
        <div className={styles.conversationList}>{threadChoices.map((choice) => {
          const conversation = conversationsByDomain.get(choice.domain);
          return <button key={choice.domain} className={conversation?.id === selectedId ? styles.conversationActive : styles.conversation} onClick={() => selectDomain(choice.domain)}><span>{choice.label}</span></button>;
        })}</div>
        <p className={styles.privacy}>{signedIn ? "Synced privately to your account" : "Preview mode · sign in to save"}</p>
      </aside>
      <section className={styles.chatPanel} aria-label="Assistant conversation">
        {desktopAvailable && <div className={styles.voiceRoute}><label htmlFor="voice-chat">Voice chat</label><select id="voice-chat" value={voiceTarget} onChange={(event) => void changeVoiceTarget(event.target.value as AssistantThreadDomain)}>{threadChoices.map((choice) => <option key={choice.domain} value={choice.domain}>{choice.label}</option>)}</select>{speaking ? <button type="button" onClick={() => spokenReplyRef.current?.cancel()}>Stop speaking</button> : <span>Say “Hello Baseline” to start, then again to send</span>}</div>}
        {(isChiefOfStaffChat || isStrengthChat || isNutritionChat) && <button className={styles.mobileContext} onClick={() => setContextOpen((value) => !value)} aria-expanded={contextOpen}><span><small>{isChiefOfStaffChat ? "Specialist tasks" : isNutritionChat ? "Saved meals" : "Next workout"}</small>{isChiefOfStaffChat ? `${delegations.length} recent task${delegations.length === 1 ? "" : "s"}` : isNutritionChat ? `${savedMeals.length} meal${savedMeals.length === 1 ? "" : "s"}` : workout.name}</span><Icon name="chevron" /></button>}
        {contextOpen && (isChiefOfStaffChat || isStrengthChat || isNutritionChat) && (isChiefOfStaffChat ? <DelegationBoard tasks={delegations} onRetry={(id) => void retryDelegation(id)} retryingTaskId={retryingTaskId} mobile /> : isNutritionChat ? <NutritionMealsCard meals={savedMeals} conversationId={selectedId} signedIn={signedIn} onRequireAuth={() => router.push("/login")} mobile /> : <WorkoutCard workout={workout} mobile />)}
        <div ref={messagesRef} className={styles.messages} aria-live="polite">
          {messages.map((message) => message.role !== "tool" && <article key={message.id} className={message.role === "user" ? styles.userMessage : styles.assistantMessage}>{message.role === "assistant" && <span className={styles.avatar}><Icon name="spark" /></span>}<div><span className={styles.speaker}>{message.role === "user" ? "You" : "Baseline"}</span><p>{message.content}</p></div></article>)}
          {loading && <article className={styles.assistantMessage}><span className={styles.avatar}><Icon name="spark" /></span><div><span className={styles.speaker}>Baseline</span><p className={styles.thinking}>Working through that…</p></div></article>}
        </div>
        {isStrengthChat || isRunningChat || confirmationRequired || saveableMealMessage ? <div className={styles.quickActions}>
          {confirmationRequired ? <button disabled={loading} onClick={() => void sendMessage(CONFIRMATION_REPLY)}>Confirm</button> : null}
          {saveableMealMessage ? <button disabled={loading || Boolean(savingMealMessageId) || mealSavedToList} onClick={() => void saveLoggedMeal(saveableMealMessage)}>{mealSavedToList ? "Saved to Meals" : savingMealMessageId ? "Saving…" : "Save to Meals"}</button> : null}
          {isStrengthChat && workout.status !== "completed" ? <button disabled={loading} onClick={() => void (workout.status === "in_progress" ? finishWorkout() : sendMessage("Start my next workout."))}>{workout.status === "in_progress" ? "Finish workout" : "Start workout"}</button> : null}
          {isStrengthChat ? <button disabled={loading} onClick={() => void sendMessage("Help me log my next set.")}>Log a set</button> : null}
          {isStrengthChat ? <button className={styles.reviewAction} disabled={loading} onClick={() => void sendMessage("Review my recent strength progress.")}>Review progress</button> : null}
          {isRunningChat ? <button disabled={loading} onClick={() => void sendMessage("Review my most recent run against my recent training and current plan.")}>Review run</button> : null}
          {isRunningChat ? <button disabled={loading} onClick={() => void sendMessage("Help me plan this week of running using my saved goal and recent training.")}>Plan week</button> : null}
          {isRunningChat ? <button className={styles.mobileSummaryAction} onClick={() => setContextOpen(true)}>Running summary</button> : null}
        </div> : null}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.composerArea}>
          {pendingImages.length ? <div className={styles.attachmentTray} aria-label="Attached Garmin screenshots">{pendingImages.map((image) => <figure key={image.id} className={styles.attachment}><Image src={image.previewUrl} alt="Garmin screenshot preview" width={58} height={58} unoptimized /><button type="button" onClick={() => removeImage(image.id)} aria-label={`Remove ${image.file.name}`}>×</button></figure>)}</div> : null}
          <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void sendMessage(draft, pendingImages); }}>
            {isRunningChat ? <><input ref={fileInputRef} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addImages(event.target.files); event.target.value = ""; }} />
            <button className={styles.attachButton} type="button" disabled={loading} onClick={() => fileInputRef.current?.click()} aria-label="Attach Garmin screenshots"><Icon name="paperclip" /></button></> : null}
            <input ref={composerRef} value={draft} onChange={(event) => onComposerChange(event.target.value)} placeholder="Ask Baseline anything…" aria-label="Message Baseline" />
            <button disabled={(!draft.trim() && !pendingImages.length) || loading} aria-label="Send message"><Icon name="send" /></button>
          </form>
        </div>
        <p className={styles.disclaimer}>Baseline can make mistakes. Check important details.</p>
      </section>
      <aside className={styles.contextRail}>{isChiefOfStaffChat ? <DelegationBoard tasks={delegations} onRetry={(id) => void retryDelegation(id)} retryingTaskId={retryingTaskId} /> : isGeneralChat ? <section className={styles.generalCard}><span className={styles.workoutEyebrow}>General chat</span><h2>Ask across Baseline</h2><p>Try a question about your logged runs, meals, or current workout.</p><ul><li>How many miles did I run this week?</li><li>How many calories did I log yesterday?</li><li>What was my average logged protein over the last 7 days?</li></ul></section> : isRunningChat ? <details className={styles.runningSummaryDisclosure}><summary>Running summary</summary><RunningCoachCard data={runningCoach} onAsk={(message) => void sendMessage(message)} /></details> : isNutritionChat ? <NutritionMealsCard meals={savedMeals} conversationId={selectedId} signedIn={signedIn} onRequireAuth={() => router.push("/login")} /> : <WorkoutCard workout={workout} />}</aside>
    </section>
    {newThreadOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingThread) setNewThreadOpen(false); }}><section className={styles.threadModal} role="dialog" aria-modal="true" aria-labelledby="thread-title"><button className={styles.closeButton} disabled={creatingThread} onClick={() => setNewThreadOpen(false)} aria-label="Close">×</button><span className={styles.authMark}><Icon name="spark" /></span><h2 id="thread-title">Choose a chat</h2><p>Each subject keeps one continuous conversation.</p><div className={styles.threadChoices}>{threadChoices.map((choice) => <button key={choice.domain} type="button" disabled={creatingThread} onClick={() => selectDomain(choice.domain)}><strong>{choice.label}</strong><span>{choice.description}</span></button>)}</div></section></div>}
    {isRunningChat && contextOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setContextOpen(false); }}><section className={styles.runningSummaryDialog} role="dialog" aria-modal="true" aria-label="Running summary"><button className={styles.closeButton} type="button" onClick={() => setContextOpen(false)} aria-label="Close running summary">×</button><RunningCoachCard data={runningCoach} onAsk={(message) => { setContextOpen(false); void sendMessage(message); }} /></section></div>}
  </main>;
}

function formatWeight(weight: number) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1);
}

function formatMacro(value: number | null) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function NutritionMealsCard({
  meals,
  conversationId,
  signedIn,
  onRequireAuth,
  mobile = false,
}: {
  meals: SavedMeal[];
  conversationId: string | null;
  signedIn: boolean;
  onRequireAuth: () => void;
  mobile?: boolean;
}) {
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [servings, setServings] = useState("1");
  const [logging, setLogging] = useState(false);
  const [notice, setNotice] = useState("");
  const [logError, setLogError] = useState("");

  function openLogger(mealId: string) {
    setSelectedMealId((current) => current === mealId ? null : mealId);
    setMealType("lunch");
    setServings("1");
    setNotice("");
    setLogError("");
  }

  async function confirmLog(meal: SavedMeal) {
    if (!signedIn) {
      onRequireAuth();
      return;
    }
    if (!conversationId) { setLogError("Open the Nutrition chat before logging a meal."); return; }
    setLogging(true);
    setNotice("");
    setLogError("");
    try {
      const response = await fetch("/api/assistant/meals", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, savedMealId: meal.id, mealType, servings: Number(servings) }),
      });
      const data = (await response.json()) as { logged?: { meal_name: string; meal_type: MealType; servings: number }; error?: string };
      if (!response.ok || !data.logged) throw new Error(data.error ?? "Unable to log this meal.");
      setSelectedMealId(null);
      setNotice(`Logged ${data.logged.meal_name} as ${data.logged.meal_type} · ${data.logged.servings} serving${data.logged.servings === 1 ? "" : "s"}.`);
    } catch (error) {
      setLogError(error instanceof Error ? error.message : "Unable to log this meal.");
    } finally {
      setLogging(false);
    }
  }

  return <section className={mobile ? styles.nutritionMobile : styles.nutritionCard}>
    <div className={styles.workoutEyebrow}><span>Saved meals</span><span>{meals.length}</span></div>
    <h2>Meal library</h2>
    <p className={styles.nutritionIntro}>Choose a meal to review and log it.</p>
    {notice ? <p className={styles.mealLogNotice} role="status">{notice}</p> : null}
    {logError ? <p className={styles.mealLogError} role="alert">{logError}</p> : null}
    {meals.length ? <ol className={styles.savedMealList}>{meals.map((meal) => <li key={meal.id}>
      <div className={styles.savedMealHeading}><strong>{meal.name}</strong><div className={styles.savedMealActions}><span>{formatMacro(meal.calories)} cal</span><button type="button" aria-expanded={selectedMealId === meal.id} onClick={() => openLogger(meal.id)}>Log</button></div></div>
      {meal.description ? <p>{meal.description}</p> : null}
      <div className={styles.macroRow}><span>P {formatMacro(meal.protein_g)}g</span><span>C {formatMacro(meal.carbs_g)}g</span><span>F {formatMacro(meal.fat_g)}g</span></div>
      {selectedMealId === meal.id ? <div className={styles.mealLogger}>
        <div className={styles.mealLogFields}>
          <label>Meal<select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label>
          <label>Servings<input type="number" min="0.01" max="20" step="0.25" inputMode="decimal" value={servings} onChange={(event) => setServings(event.target.value)} /></label>
        </div>
        <div className={styles.mealLogPreview}>{formatMacro(meal.calories == null ? null : meal.calories * Number(servings || 0))} cal · P {formatMacro(meal.protein_g == null ? null : meal.protein_g * Number(servings || 0))}g</div>
        <div className={styles.mealLogButtons}><button type="button" disabled={logging} onClick={() => void confirmLog(meal)}>{logging ? "Logging…" : "Confirm log"}</button><button type="button" disabled={logging} onClick={() => setSelectedMealId(null)}>Cancel</button></div>
      </div> : null}
    </li>)}</ol> : <div className={styles.noSavedMeals}>No saved meals yet.</div>}
  </section>;
}

function WorkoutCard({ workout, mobile = false }: { workout: StrengthWorkout; mobile?: boolean }) {
  const completed = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const target = workout.exercises.reduce((sum, exercise) => sum + exercise.target_sets, 0);
  return <section className={mobile ? styles.workoutMobile : styles.workoutCard}>
    <div className={styles.workoutEyebrow}><span>{workout.status === "in_progress" ? "Current workout" : "Next workout"}</span><span>{workout.estimated_minutes} min</span></div>
    <h2>{workout.name}</h2>
    <div className={styles.statusRow}><span className={styles.statusDot} />{workout.status === "next" ? "next in rotation" : workout.status.replace("_", " ")}<span>{completed}/{target} sets</span></div>
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
