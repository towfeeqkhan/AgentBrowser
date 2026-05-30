import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "dismiss_active_overlays",
    {
      description: "Dismiss all visible overlays, modals, popups, dialogs, cookie banners, and lightboxes on the current page. Scans for common close buttons within overlay containers and clicks them. Also runs built-in cookie/privacy dismissal selectors as a fallback. Use this when page interactions are blocked by popups or overlays.",
    },
    async () => {
      const result: any = await sendAction({ type: "dismiss_active_overlays" });
      return {
        content: [
          {
            type: "text",
            text: result?.success
              ? `Dismissed ${result.dismissed ?? 0} overlay(s).`
              : `Dismiss failed: ${result?.error ?? "unknown error"}`,
          },
        ],
      };
    }
  );
}
