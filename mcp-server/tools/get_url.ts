import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "get_url",
    {
      description: "Get the current active page URL",
    },
    async () => {
      const result: any = await sendAction({ type: "get_url" });
      return {
        content: [{ type: "text", text: result.url || "Unknown URL" }],
      };
    }
  );
}
