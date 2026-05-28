import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { waitForPageState, sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "capture_page",
    {
      description: "Trigger a fresh capture of the current page (screenshot + tree)",
    },
    async () => {
      const statePromise = waitForPageState();
      sendAction({ type: "capture" }).catch((e: any) =>
        console.error("[MCP] Capture request failed", e)
      );
      try {
        await statePromise;
      } catch {
        // Timed out — state may still be stale but don't block forever
      }
      return {
        content: [{ type: "text", text: "Capture complete. Call get_page_state to read it." }],
      };
    }
  );
}
