import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  pageState,
  sendAction,
  findElement,
  findElementById,
  findElementByProximity,
  pageStateContentBlocks,
} from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "hover_element",
    {
      description:
        "Hover the mouse over an element. Prefer using 'name' (the button/link label from the tree). Use 'selector' for precise CSS targeting. Falls back to x,y coordinates if name not found.",
      inputSchema: {
        name: z.string().optional().describe("Element name/label from the tree (preferred)"),
        selector: z.string().optional().describe("CSS selector to target a specific DOM element"),
        elementId: z.union([z.string(), z.number()]).optional().describe("Element ID from the tree"),
        x: z.number().optional().describe("X coordinate fallback"),
        y: z.number().optional().describe("Y coordinate fallback"),
        proximityText: z
          .string()
          .optional()
          .describe(
            "Text of a nearby element to disambiguate when multiple elements share the same name (e.g., product title near an 'Add to cart' button)"
          ),
      },
    },
    async ({ name, selector, elementId, x, y, proximityText }) => {
      const query = name || (elementId !== undefined ? String(elementId) : undefined);
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
        console.error(`[MCP] Found "${el.name}" at (${x}, ${y}) to hover`);
      }

      if (x === undefined || y === undefined) {
        if (selector) {
          await sendAction({ type: "hover", x: 0, y: 0, selector });
          return {
            content: [{ type: "text", text: `✅ Hovered over element via selector "${selector}"` }],
          };
        }
        const names = pageState?.tree
          ?.slice(0, 20)
          .map((e: any) => `"${e.name}" (id:${e.id})`)
          .join(", ");
        return {
          content: [{ type: "text", text: `Element not found for query "${query}". Available elements: ${names}` }],
        };
      }

      await sendAction({ type: "hover", x, y, elementId: el?.id, selector });
      return {
        content: [
          { type: "text", text: `✅ Hovered over "${name || (elementId !== undefined ? String(elementId) : "coords")}" at (${x}, ${y})` },
          ...pageStateContentBlocks(),
        ],
      };
    }
  );
}
