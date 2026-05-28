import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pageState } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "find_element",
    {
      description: "Search the tree for an element by name. Returns its coordinates.",
      inputSchema: {
        name: z.string().describe("Text to search for in element names"),
      },
    },
    async ({ name }) => {
      const matches =
        pageState?.tree?.filter((e: any) =>
          e.name?.toLowerCase().includes(name.toLowerCase()),
        ) || [];

      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No elements found matching "${name}"` }],
        };
      }

      const summary = matches
        .map(
          (e: any) =>
            `• [${e.role}] "${e.name}" → center:(${e.center[0]},${e.center[1]}) id:${e.id}`,
        )
        .join("\n");

      return {
        content: [{ type: "text", text: `Found ${matches.length} matches:\n${summary}` }],
      };
    }
  );
}
