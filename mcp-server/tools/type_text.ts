import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  sendAction,
  findElement,
  findElementById,
  findElementByProximity,
} from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "type_text",
    {
      description:
        "Type text into the focused/active element, or target a specific element to click/focus before typing. By default, clears existing text first (clearFirst=true). Set clearFirst=false to append instead.",
      inputSchema: {
        text: z.string().describe("Text to type"),
        clearFirst: z.boolean().default(true).describe("Clear the field before typing (default: true). Set to false to append."),
        selector: z.string().optional().describe("CSS selector of the element to target"),
        name: z.string().optional().describe("Element name/label from the tree to target"),
        elementId: z.union([z.string(), z.number()]).optional().describe("Element ID from the tree to target"),
        x: z.number().optional().describe("X coordinate of the element to target"),
        y: z.number().optional().describe("Y coordinate of the element to target"),
        proximityText: z
          .string()
          .optional()
          .describe(
            "Text of a nearby element to disambiguate when multiple elements share the same name (e.g., product title near an 'Add to cart' button)"
          ),
        pressEnter: z.boolean().optional().describe("Press Enter key after typing text"),
        skipDomWait: z
          .boolean()
          .optional()
          .describe("Set to true to skip waiting for DOM/network settling after typing."),
      },
    },
    async ({ text, clearFirst, selector, name, elementId, x, y, proximityText, pressEnter, skipDomWait }) => {
      if (!selector && (name || elementId)) {
        let el = null;
        if (name && proximityText) {
          el = findElementByProximity(name, proximityText);
          if (el) {
            x = el.center[0];
            y = el.center[1];
            console.error(`[MCP] Proximity match: "${el.name}" near "${proximityText}" at (${x}, ${y})`);
          }
        }
        if (!el && elementId !== undefined) {
          el = findElementById(elementId);
        }
        if (!el && name) {
          el = findElement(name);
        }
        if (el && !proximityText) {
          x = el.center[0];
          y = el.center[1];
        }
      }

      const result = await sendAction({ type: "type", text, selector, x, y, clearFirst, pressEnter, skipDomWait });
      return {
        content: [
          { type: "text", text: `Typed "${text}"${clearFirst ? " (cleared first)" : " (appended)"}${pressEnter ? " and pressed Enter" : ""}. Result: ${JSON.stringify(result)}` },
        ],
      };
    }
  );
}
