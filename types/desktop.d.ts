interface BaselineDesktopBridge {
  isDesktop: true;
  onFocusComposer(callback: (domain: "chief_of_staff" | "general" | "strength" | "running" | "nutrition") => void): () => void;
  onVoiceTargetChanged(callback: (domain: "chief_of_staff" | "general" | "strength" | "running" | "nutrition") => void): () => void;
  onDictationStop(callback: () => void): () => void;
  onVoiceError(callback: (message: string) => void): () => void;
  composerReady(): void;
  focusFailed(message: string): void;
  assistantReady(): void;
  dictationPasted(): void;
  replyStarted(): void;
  replyFinished(): void;
  turnFailed(): void;
  getServerUrl(): Promise<string>;
  getVoiceTarget(): Promise<"chief_of_staff" | "general" | "strength" | "running" | "nutrition">;
  setVoiceTarget(domain: "chief_of_staff" | "general" | "strength" | "running" | "nutrition"): Promise<{ ok: boolean; error?: string }>;
  setServerUrl(url: string): Promise<{ ok: boolean; error?: string }>;
}

interface Window {
  baselineDesktop?: BaselineDesktopBridge;
}
