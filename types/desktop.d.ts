interface BaselineDesktopBridge {
  isDesktop: true;
  onFocusComposer(callback: () => void): () => void;
  onDictationStop(callback: () => void): () => void;
  onVoiceError(callback: (message: string) => void): () => void;
  composerReady(): void;
  assistantReady(): void;
  dictationPasted(): void;
  replyStarted(): void;
  replyFinished(): void;
  turnFailed(): void;
  getServerUrl(): Promise<string>;
  setServerUrl(url: string): Promise<{ ok: boolean; error?: string }>;
}

interface Window {
  baselineDesktop?: BaselineDesktopBridge;
}
