import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer } from "ws";

import {
  pageState,
  pendingActions,
  pageStateWaiters,
  setPageState,
  setLastCaptureTime,
  setExtensionWs,
  setPageStateWaiters,
} from "./tools/shared.js";

import { register as getPageState } from "./tools/get_page_state.js";
import { register as clickElement } from "./tools/click_element.js";
import { register as findElement } from "./tools/find_element.js";
import { register as clickAtCoords } from "./tools/click_at_coords.js";
import { register as typeText } from "./tools/type_text.js";
import { register as scrollPage } from "./tools/scroll_page.js";
import { register as navigate } from "./tools/navigate.js";
import { register as capturePage } from "./tools/capture_page.js";
import { register as getUrl } from "./tools/get_url.js";
import { register as refresh } from "./tools/refresh.js";
import { register as goBack } from "./tools/go_back.js";
import { register as goForward } from "./tools/go_forward.js";
import { register as hoverElement } from "./tools/hover_element.js";
import { register as getText } from "./tools/get_text.js";
import { register as executePipeline } from "./tools/execute_pipeline.js";
import { register as clipboardCopy } from "./tools/clipboard_copy.js";
import { register as clipboardPaste } from "./tools/clipboard_paste.js";
import { register as tabList } from "./tools/tab_list.js";
import { register as tabSwitch } from "./tools/tab_switch.js";
import { register as tabClose } from "./tools/tab_close.js";
import { register as dismissActiveOverlays } from "./tools/dismiss_active_overlays.js";

// ─── WebSocket Server (Extension connects here) ──────
const wss = new WebSocketServer({
  port: 3001,
  perMessageDeflate: {
    zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
    zlibInflateOptions: { chunkSize: 10 * 1024 },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    concurrencyLimit: 10,
  },
});

wss.on("connection", (ws) => {
  setExtensionWs(ws);
  console.error("[MCP] ✅ Extension connected");

  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 20000);

  ws.on("message", (raw) => {
    const textMsg = Array.isArray(raw)
      ? Buffer.concat(raw).toString()
      : raw.toString();
    const msg = JSON.parse(textMsg);

    if (msg.type === "pong") {
      return;
    }

    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }

    if (msg.type === "page_state") {
      if (msg.data.treeUnchanged && pageState) {
        setPageState({ screenshot: msg.data.screenshot, tree: pageState.tree });
        console.error("[MCP] Page state received (tree unchanged, reusing cached)");
      } else {
        setPageState(msg.data);
        console.error("[MCP] Page state received (full update)");
      }
      setLastCaptureTime(Date.now());
      const waiters = pageStateWaiters;
      setPageStateWaiters([]);
      for (const resolve of waiters) resolve();
    }

    if (msg.type === "action_result") {
      const resolve = pendingActions.get(msg.id);
      if (resolve) {
        resolve(msg.result);
        pendingActions.delete(msg.id);
      }
    }
  });

  ws.on("close", () => {
    clearInterval(pingInterval);
    setExtensionWs(null);
    console.error("[MCP] Extension disconnected ❌");
  });

  ws.on("error", (err) => {
    console.error("[MCP] WS connection error:", err);
  });
});

// ─── MCP Server ───────────────────────────────────────
const server = new McpServer({
  name: "browser-control",
  version: "1.0.0",
});

// Register all tools
getPageState(server);
clickElement(server);
findElement(server);
clickAtCoords(server);
typeText(server);
scrollPage(server);
navigate(server);
capturePage(server);
getUrl(server);
refresh(server);
goBack(server);
goForward(server);
hoverElement(server);
getText(server);
executePipeline(server);
clipboardCopy(server);
clipboardPaste(server);
tabList(server);
tabSwitch(server);
tabClose(server);
dismissActiveOverlays(server);

// ─── Start MCP over stdio ─────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
