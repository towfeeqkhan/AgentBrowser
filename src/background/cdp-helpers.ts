import { DEBUGGER_VERSION } from "./constants.js";
import { wsState, observerState } from "./state.js";

export async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }
  return tab.id;
}

export async function captureViewportScreenshot(
  tabId: number,
): Promise<string> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.windowId) throw new Error("No window found for active tab.");
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "jpeg",
    quality: 20,
  });
  return dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
}

function toTarget(tabId: number): chrome.debugger.Debuggee {
  return { tabId };
}

export async function attachDebugger(tabId: number): Promise<boolean> {
  try {
    await chrome.debugger.attach(toTarget(tabId), DEBUGGER_VERSION);
    return false;
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes("Another debugger is already attached")) {
      console.log(`[EXT] Debugger already attached to tab ${tabId}`);
      return true;
    }
    throw error;
  }
}

export async function detachDebugger(tabId: number): Promise<void> {
  await chrome.debugger.detach(toTarget(tabId));
}

export async function sendCdpCommand<T>(
  tabId: number,
  method: string,
  params?: object,
): Promise<T> {
  return (await chrome.debugger.sendCommand(
    toTarget(tabId),
    method,
    params,
  )) as T;
}

export type ViewportMetrics = {
  viewWidth: number;
  viewHeight: number;
  scrollY: number;
};

export async function getViewportMetrics(
  tabId: number,
): Promise<ViewportMetrics> {
  const result = await sendCdpCommand<{
    visualViewport: {
      clientWidth: number;
      clientHeight: number;
      pageY: number;
    };
  }>(tabId, "Page.getLayoutMetrics");

  return {
    viewWidth: result.visualViewport.clientWidth,
    viewHeight: result.visualViewport.clientHeight,
    scrollY: result.visualViewport.pageY,
  };
}

export function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.startsWith("chrome://") ||
    lowerUrl.startsWith("chrome-extension://") ||
    lowerUrl.startsWith("about:") ||
    lowerUrl.startsWith("edge://") ||
    lowerUrl.startsWith("view-source:")
  );
}

export async function attachCDP_MCP(
  isExplicitAction: boolean = false,
  targetNavigateUrl?: string,
): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found");
  }
  wsState.activeTabId = tab.id;

  if (isRestrictedUrl(tab.url)) {
    if (!isExplicitAction) {
      throw new Error("Skipping background attachment to restricted URL");
    }

    const redirectUrl = targetNavigateUrl || "https://www.google.com";
    console.log(
      `[EXT] Active tab ${tab.id} is on a restricted URL: "${tab.url}". Redirecting directly to ${redirectUrl} to allow debugging.`,
    );

    await chrome.tabs.update(tab.id, { url: redirectUrl });

    let loaded = false;
    const startTime = Date.now();
    while (Date.now() - startTime < 8000) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const currentTab = await chrome.tabs.get(tab.id).catch(() => null);
      if (
        currentTab &&
        currentTab.status === "complete" &&
        !isRestrictedUrl(currentTab.url)
      ) {
        loaded = true;
        break;
      }
    }

    if (!loaded) {
      console.warn("[EXT] Timeout waiting for redirection to complete.");
    }
  }

  if (wsState.debuggerAttachedTabId !== wsState.activeTabId) {
    if (wsState.debuggerAttachedTabId !== null) {
      await detachDebugger(wsState.debuggerAttachedTabId).catch(() => {});
      wsState.debuggerAttachedTabId = null;
    }
    await attachDebugger(wsState.activeTabId).catch(() => {});
    wsState.debuggerAttachedTabId = wsState.activeTabId;
  }
  return wsState.activeTabId;
}

export async function waitForDOMSettled(
  tabId: number,
  settleMs = 150,
  timeoutMs = 5000,
): Promise<number> {
  try {
    const result = (await chrome.debugger.sendCommand(
      { tabId },
      "Runtime.evaluate",
      {
        expression: `
          new Promise((resolve) => {
            let timer;
            const startTime = Date.now();
            const settle = ${settleMs};
            const hardTimeout = ${timeoutMs};
            const observer = new MutationObserver(() => {
              clearTimeout(timer);
              timer = setTimeout(() => {
                observer.disconnect();
                resolve(Date.now() - startTime);
              }, settle);
            });
            if (document.body) {
              observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
              });
            }
            timer = setTimeout(() => {
              observer.disconnect();
              resolve(Date.now() - startTime);
            }, settle);
            setTimeout(() => {
              observer.disconnect();
              resolve(Date.now() - startTime);
            }, hardTimeout);
          })
        `,
        returnByValue: true,
        awaitPromise: true,
      },
    )) as any;
    const settledAfterMs = result?.result?.value ?? 0;
    console.log(`[EXT] DOM settled after ${settledAfterMs}ms`);
    return settledAfterMs;
  } catch (e) {
    console.warn("[EXT] waitForDOMSettled failed, falling back:", e);
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    return settleMs;
  }
}

export async function waitForPageLoadIfNavigating(
  tabId: number,
  checkDelayMs = 300,
  timeoutMs = 8000,
) {
  await new Promise((resolve) => setTimeout(resolve, checkDelayMs));
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "loading") {
      console.log(
        "[EXT] Detected page navigation/loading, waiting for load to complete...",
      );
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const currentTab = await chrome.tabs.get(tabId);
        if (currentTab.status === "complete") {
          await waitForDOMSettled(tabId, 150, 3000);
          console.log("[EXT] Page load complete (DOM settled).");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      console.log("[EXT] Page load wait timed out.");
    } else {
      console.log("[EXT] Not navigating. Waiting for DOM to settle...");
      await waitForDOMSettled(tabId, 150, 2000);
    }
  } catch (e) {
    console.error("[EXT] Error checking tab status:", e);
    await waitForDOMSettled(tabId, 150, 2000);
  }
}

// ─── MutationObserver injection ──────────────────────

export async function injectMutationObserver(tabId: number): Promise<void> {
  if (observerState.mutationObserverTabId === tabId) return;
  try {
    await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
      expression: `
        (() => {
          if (window.__mcpPageObserversActive) return;
          window.__mcpPageObserversActive = true;

          let _captureDebounce = null;
          function signalCapture() {
            if (_captureDebounce) clearTimeout(_captureDebounce);
            _captureDebounce = setTimeout(() => {
              try {
                chrome.runtime.sendMessage({ type: 'MUTATION_CAPTURE' });
              } catch (_) {}
            }, 300);
          }

          const observer = new MutationObserver(signalCapture);
          if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
          } else {
            document.addEventListener('DOMContentLoaded', () => {
              if (document.body) observer.observe(document.body, { childList: true, subtree: true });
            }, { once: true });
          }

          window.addEventListener('scroll', signalCapture, { passive: true, capture: true });
          window.addEventListener('resize', signalCapture);
          window.addEventListener('focus', () => setTimeout(signalCapture, 200));
        })()
      `,
      returnByValue: false,
    });
    observerState.mutationObserverTabId = tabId;
    console.log(`[EXT] Page observers injected into tab ${tabId}`);
  } catch (e) {
    console.warn("[EXT] Failed to inject MutationObserver:", e);
  }
}

// Debugger lifecycle listeners (attached once in serviceWorker)
export function setupDebuggerLifecycle() {
  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId === wsState.debuggerAttachedTabId) {
      console.log("[EXT] Debugger detached from tab", source.tabId);
      wsState.debuggerAttachedTabId = null;
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === wsState.debuggerAttachedTabId) {
      wsState.debuggerAttachedTabId = null;
    }
  });
}
