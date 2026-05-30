import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction, pageStateContentBlocks } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "go_back",
    {
      description: "Navigate back to the previous page in history",
      inputSchema: {
        skipDomWait: z.boolean().optional().describe("Set to true to skip DOM settling wait."),
      },
    },
    async ({ skipDomWait }) => {
      await sendAction({ type: "go_back", skipDomWait });
      return {
        content: [{ type: "text", text: "Navigated back." }, ...pageStateContentBlocks()],
      };
    }
  );
}
