import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "click_at_coords",
    {
      description: "Click at exact pixel coordinates. Use when you can SEE the element in the screenshot but tree lookup fails.",
      inputSchema: {
        x: z.number().describe("X pixel coordinate from the screenshot"),
        y: z.number().describe("Y pixel coordinate from the screenshot"),
        description: z.string().optional().describe("What you're clicking (for logging)"),
      },
    },
    async ({ x, y, description }) => {
      await sendAction({ type: "click", x, y });
      return {
        content: [
          { type: "text", text: `✅ Clicked at (${x}, ${y})${description ? ` — ${description}` : ""}` },
        ],
      };
    }
  );
}
