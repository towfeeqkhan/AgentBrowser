import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction, findElement, findElementById } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "get_text",
    {
      description: "Extract text from an element using a CSS selector, element name, element ID, or coordinates.",
      inputSchema: {
        selector: z.string().optional().describe("CSS selector of the element"),
        name: z.string().optional().describe("Element name/label from the tree"),
        elementId: z.union([z.string(), z.number()]).optional().describe("Element ID from the tree"),
        x: z.number().optional().describe("X coordinate of the element"),
        y: z.number().optional().describe("Y coordinate of the element"),
      },
    },
    async ({ selector, name, elementId, x, y }) => {
      let el: any = null;
      if (!selector && (name || elementId)) {
        if (elementId !== undefined) {
          el = findElementById(elementId);
        }
        if (!el && name) {
          el = findElement(name);
        }
        if (el) {
          x = el.center[0];
          y = el.center[1];
          console.error(`[MCP] Found "${el.name}" at (${x}, ${y}) for get_text`);
        }
      }

      if (!selector && (x === undefined || y === undefined)) {
        return {
          content: [
            {
              type: "text",
              text: "Error: You must provide either a 'selector', or a valid 'name'/'elementId' from the tree, or 'x' and 'y' coordinates.",
            },
          ],
        };
      }

      const result: any = await sendAction({ type: "get_text", selector, x, y, elementId: el?.id });
      return {
        content: [{ type: "text", text: result.text || "No text content found." }],
      };
    }
  );
}
