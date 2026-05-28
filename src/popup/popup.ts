// ─── WebSocket Status Indicator ───────────────────────
function updateStatus(connected: boolean): void {
  const pill = document.getElementById("status-indicator");
  const card = document.getElementById("status-card");
  const help = document.getElementById("status-help");
  if (!pill) return;

  const text = pill.querySelector(".status-text");

  if (connected) {
    pill.className = "status-pill connected";
    if (text) text.textContent = "MCP Connected";
    card?.classList.remove("disconnected");
    card?.classList.add("connected");
    help?.classList.remove("visible");
  } else {
    pill.className = "status-pill disconnected";
    if (text) text.textContent = "Disconnected";
    card?.classList.remove("connected");
    card?.classList.add("disconnected");
    help?.classList.add("visible");
  }
}

// Request current status on open
chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
  updateStatus(Boolean(res?.connected));
});

// Listen for connection status updates from background service worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "WS_STATUS") {
    updateStatus(msg.connected);
  }
});
