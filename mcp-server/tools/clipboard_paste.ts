import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction, getHostClipboard } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "clipboard_paste",
    {
      description:
        "Paste the current system clipboard content into the focused page element. Use this after clipboard_copy or when you have host clipboard content to input.",
      inputSchema: {
        selector: z.string().optional().describe("CSS selector of the input to paste into"),
        x: z.number().optional().describe("X coordinate of the input to paste into"),
        y: z.number().optional().describe("Y coordinate of the input to paste into"),
      },
    },
    async ({ selector, x, y }) => {
      const clipboardText = getHostClipboard();
      if (!clipboardText) {
        return { content: [{ type: "text", text: "System clipboard is empty." }] };
      }

      await sendAction({ type: "type", text: clipboardText, selector, x, y, clearFirst: true });
      return {
        content: [{ type: "text", text: `✅ Pasted ${clipboardText.length} chars from clipboard into page.` }],
      };
    }
  );
}
