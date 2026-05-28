import { HEARTBEAT_INTERVAL_MS } from "./constants.js";
import { wsState, observerState, captureCache } from "./state.js";
import { setupDebuggerLifecycle, injectMutationObserver } from "./cdp-helpers.js";
import { captureAxTree } from "./a11y.js";
import { performCapture, debouncedCapture } from "./capture.js";
import {
  performClick,
  performType,
  performScroll,
  performNavigate,
  performGetUrl,
  performRefresh,
  performGoBack,
  performGoForward,
  performHover,
  performGetText,
  performListTabs,
  performSwitchTab,
  performCloseTab,
  performPipeline,
} from "./actions.js";

// ─── Runtime Message Listener ────────────────────────
chrome.runtime.onMessage.addListener(
  (
    message: any,
    _sender,
    sendResponse: (response: any) => void,
  ) => {
    if (message?.type === "GET_STATUS") {
      sendResponse({ connected: wsState.ws?.readyState === WebSocket.OPEN });
      return false;
    }

    if (message?.type === "CAPTURE_AX_TREE") {
      captureAxTree()
        .then(({ context, screenshot }) => {
          sendResponse({ ok: true, context, screenshot });
          performCapture().catch((e) => console.error("MCP Capture Error:", e));
        })
        .catch((error: unknown) => {
          const messageText =
            error instanceof Error ? error.message : "Unknown error";
          sendResponse({ ok: false, error: messageText });
        });
      return true;
    }

    if (message?.type === "CAPTURE") {
      performCapture()
        .then(() => sendResponse({ ok: true }))
        .catch((error: any) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message?.type === "MUTATION_CAPTURE") {
      debouncedCapture().catch(() => {});
      sendResponse({ ok: true });
      return false;
    }

    return false;
  },
);

// ─── Tab lifecycle: re-inject observer ───────────────
chrome.tabs.onActivated.addListener(async (info) => {
  observerState.mutationObserverTabId = null;
  if (wsState.debuggerAttachedTabId === info.tabId) {
    await injectMutationObserver(info.tabId).catch(() => {});
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete" && tabId === wsState.activeTabId) {
    observerState.mutationObserverTabId = null;
    await injectMutationObserver(tabId).catch(() => {});
    debouncedCapture().catch(() => {});
  }
});

// ─── Heartbeat ───────────────────────────────────────
setInterval(() => {
  if (wsState.ws && wsState.ws.readyState === WebSocket.OPEN && wsState.debuggerAttachedTabId !== null) {
    debouncedCapture().catch(() => {});
  }
}, HEARTBEAT_INTERVAL_MS);

// ─── WebSocket Connection ────────────────────────────
function connectToMCP() {
  if (wsState.reconnectTimer) clearTimeout(wsState.reconnectTimer);
  if (wsState.ws?.readyState === WebSocket.OPEN) return;

  try {
    wsState.ws = new WebSocket("ws://localhost:3001");

    wsState.ws.onopen = () => {
      console.log("[EXT] ✅ Connected to MCP server");
      captureCache.lastSentTreeJson = null;
      chrome.runtime.sendMessage({ type: "WS_STATUS", connected: true }).catch(() => {});
    };

    wsState.ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "ping") {
        wsState.ws?.send(JSON.stringify({ type: "pong" }));
        return;
      }

      console.log("[EXT] Action received:", msg);

      let result;
      try {
        switch (msg.type) {
          case "click":
            result = await performClick(msg.x, msg.y, msg.elementId, msg.selector, msg.proximityText);
            break;
          case "type":
            result = await performType(msg.text, msg.selector, msg.x, msg.y, msg.clearFirst ?? true, msg.pressEnter ?? false);
            break;
          case "scroll":
            result = await performScroll(msg.x, msg.y, msg.deltaY);
            break;
          case "navigate":
            result = await performNavigate(msg.url);
            break;
          case "capture":
            result = await performCapture(true);
            break;
          case "get_url":
            result = await performGetUrl();
            break;
          case "refresh":
            result = await performRefresh();
            break;
          case "go_back":
            result = await performGoBack();
            break;
          case "go_forward":
            result = await performGoForward();
            break;
          case "hover":
            result = await performHover(msg.x, msg.y, msg.elementId, msg.selector);
            break;
          case "get_text":
            result = await performGetText(msg.selector, msg.x, msg.y, msg.elementId);
            break;
          case "list_tabs":
            result = await performListTabs();
            break;
          case "switch_tab":
            result = await performSwitchTab(msg.tabId);
            break;
          case "close_tab":
            result = await performCloseTab(msg.tabId);
            break;
          case "pipeline":
            result = await performPipeline(msg.actions, msg.autoDismiss);
            break;
          default:
            result = { error: `Unknown action: ${msg.type}` };
        }
      } catch (e: any) {
        result = { error: e.message };
      }

      if (wsState.ws && wsState.ws.readyState === WebSocket.OPEN) {
        wsState.ws.send(JSON.stringify({ type: "action_result", id: msg.id, result }));
      }
    };

    wsState.ws.onerror = (e) => {
      console.error("[EXT] WS error:", e);
    };

    wsState.ws.onclose = () => {
      console.log("[EXT] WS closed. Retrying in 3s...");
      chrome.runtime.sendMessage({ type: "WS_STATUS", connected: false }).catch(() => {});
      wsState.ws = null;
      wsState.reconnectTimer = setTimeout(connectToMCP, 3000);
    };
  } catch (e) {
    console.error("[EXT] Failed to create WebSocket:", e);
    wsState.reconnectTimer = setTimeout(connectToMCP, 3000);
  }
}

connectToMCP();

chrome.runtime.onStartup.addListener(connectToMCP);
chrome.runtime.onInstalled.addListener(connectToMCP);

// ─── Keep service worker alive ───────────────────────
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    if (!wsState.ws || wsState.ws.readyState !== WebSocket.OPEN) {
      console.log("[EXT] WS dead/missing, reconnecting from alarm...");
      connectToMCP();
    } else {
      wsState.ws.send(JSON.stringify({ type: "ping" }));
    }
  }
});

// ─── Debugger lifecycle ──────────────────────────────
setupDebuggerLifecycle();
