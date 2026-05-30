import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction, pageStateContentBlocks } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "go_forward",
    {
      description: "Navigate forward to the next page in history",
      inputSchema: {
        skipDomWait: z.boolean().optional().describe("Set to true to skip DOM settling wait."),
      },
    },
    async ({ skipDomWait }) => {
      await sendAction({ type: "go_forward", skipDomWait });
      return {
        content: [{ type: "text", text: "Navigated forward." }, ...pageStateContentBlocks()],
      };
    }
  );
}
