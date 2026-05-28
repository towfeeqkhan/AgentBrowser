/**
 * Mutable state singleton shared across all background modules.
 * Using a plain object lets all modules mutate properties freely without
 * ESM "cannot assign to import" issues.
 */

export const wsState = {
  ws: null as WebSocket | null,
  reconnectTimer: null as any,
  activeTabId: null as number | null,
  debuggerAttachedTabId: null as number | null,
};

export const captureCache = {
  lastCapturedUrl: null as string | null,
  lastCapturedState: null as { screenshot: string; tree: any[] } | null,
  captureDebounceTimer: null as ReturnType<typeof setTimeout> | null,
  lastSentTreeJson: null as string | null,
};

export const observerState = {
  mutationObserverTabId: null as number | null,
};
