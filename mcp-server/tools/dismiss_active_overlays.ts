import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "dismiss_active_overlays",
    {
      description: "Dismiss ALL visible overlays, modals, popups, dialogs, lightboxes, and cookie banners on the current page. This is your FIRST tool whenever a popup or overlay blocks interactions. Do NOT try to click close buttons manually with click_element — use this tool instead. It sends an Escape key then removes overlay elements from the DOM, which cannot toggle or open new overlays. Always follow with get_page_state to see the unobstructed page.",
    },
    async () => {
      const result: any = await sendAction({ type: "dismiss_active_overlays" });
      return {
        content: [
          {
            type: "text",
            text: result?.success
              ? `Dismissed ${result.dismissed ?? 0} overlay(s). Call get_page_state to see the page.`
              : `Dismiss failed: ${result?.error ?? "unknown error"}`,
          },
        ],
      };
    }
  );
}
