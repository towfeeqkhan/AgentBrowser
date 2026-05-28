import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  sendAction,
  findElement,
  findElementById,
  setHostClipboard,
} from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "clipboard_copy",
    {
      description:
        "Extract text from the page AND copy it directly to your system clipboard. Use this instead of clicking 'Copy' buttons on web pages — those often fail due to browser sandbox restrictions.",
      inputSchema: {
        text: z.string().optional().describe("Exact text to copy directly (skip page extraction)"),
        selector: z.string().optional().describe("CSS selector to extract text from before copying"),
        name: z.string().optional().describe("Element name/label from the tree to extract text from before copying"),
        elementId: z.union([z.string(), z.number()]).optional().describe("Element ID from the tree to extract text from"),
        x: z.number().optional().describe("X coordinate of element to extract from"),
        y: z.number().optional().describe("Y coordinate of element to extract from"),
      },
    },
    async ({ text, selector, name, elementId, x, y }) => {
      let copyText = text || "";

      if (!copyText) {
        let el: any = null;
        if (elementId !== undefined) el = findElementById(elementId);
        if (!el && name) el = findElement(name);
        if (el) {
          x = el.center[0];
          y = el.center[1];
        }

        if (!selector && (x === undefined || y === undefined)) {
          return {
            content: [
              {
                type: "text",
                text: "Provide either 'text' to paste directly, or 'selector'/'name'/'elementId' to extract from page.",
              },
            ],
          };
        }

        try {
          const result: any = await sendAction({ type: "get_text", selector, x, y, elementId: el?.id });
          copyText = result?.text || "";
        } catch (e: any) {
          return {
            content: [{ type: "text", text: `Failed to extract text from page: ${e.message}` }],
          };
        }
      }

      if (!copyText || copyText.trim().length === 0) {
        return {
          content: [{ type: "text", text: "No text to copy — element was empty or not found." }],
        };
      }

      setHostClipboard(copyText);
      return {
        content: [
          {
            type: "text",
            text: `✅ System clipboard updated.\nCopied text (${copyText.length} chars):\n---\n${copyText}\n---`,
          },
        ],
      };
    }
  );
}
