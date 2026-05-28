import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "tab_list",
    {
      description:
        "List all open browser tabs with their IDs, URLs, and titles. Use this to find tabs that opened in new windows or to switch between tabs.",
    },
    async () => {
      const result: any = await sendAction({ type: "list_tabs" });
      const summary = (result?.tabs || [])
        .map(
          (t: any) =>
            `  Tab ${t.id} [${t.active ? "ACTIVE" : "inactive"}]: ${t.title || "(untitled)"} — ${t.url || ""}`
        )
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Open tabs (${result?.tabs?.length || 0}):\n${summary || "No tabs found."}`,
          },
        ],
      };
    }
  );
}
