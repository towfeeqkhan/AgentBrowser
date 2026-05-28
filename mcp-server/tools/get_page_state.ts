import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  systemPrompt,
  pageState,
  lastCaptureTime,
  lastToolCallTime,
  instructionsSentOnce,
  setLastToolCallTime,
  setInstructionsSentOnce,
  waitForPageState,
  sendAction,
} from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "get_page_state",
    {
      description: "Get the current screenshot and accessibility tree of the browser page",
      inputSchema: {
        includeInstructions: z
          .boolean()
          .optional()
          .describe(
            "Set this to true if you are starting a new chat thread or task to retrieve/refresh the system instructions and browser rules."
          ),
        compact: z
          .boolean()
          .optional()
          .describe(
            "Set to true to prune elements without names, drop box dimensions, and merge duplicate names for a much smaller tree payload."
          ),
      },
    },
    async ({ includeInstructions, compact }) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastToolCallTime;
      const shouldSendInstructions =
        includeInstructions === true ||
        !instructionsSentOnce ||
        timeSinceLastCall > 5 * 60 * 1000;

      setLastToolCallTime(now);
      setInstructionsSentOnce(true);

      const FRESHNESS_MS = 4000;
      const isFresh = pageState && (now - lastCaptureTime < FRESHNESS_MS);
      if (!isFresh) {
        try {
          const statePromise = waitForPageState();
          sendAction({ type: "capture" }).catch((e: any) =>
            console.error("[MCP] Capture request failed", e)
          );
          await statePromise;
          console.error("[MCP] Fresh page state received (waited for push)");
        } catch (e) {
          console.error("[MCP] Auto-capture failed or timed out", e);
        }
      } else {
        console.error("[MCP] Using cached page state (age: " + (now - lastCaptureTime) + "ms)");
      }

      if (!pageState) {
        const errorMsg = "No state yet. Ensure the extension is connected.";
        return {
          content: [
            {
              type: "text",
              text: shouldSendInstructions
                ? `### SYSTEM CONTEXT & BROWSER RULES\n\n${systemPrompt}\n\n### STATUS\n\n${errorMsg}`
                : errorMsg,
            },
          ],
        };
      }

      let tree = pageState.tree;
      if (compact && tree) {
        let filtered = tree.filter((e: any) => e.name && e.name.trim() !== "");
        filtered = filtered.map((e: any) => {
          const { box, ...rest } = e;
          return rest;
        });
        const nameCounts = new Map<string, number>();
        filtered.forEach((e: any) => {
          const key = `${e.role}:${e.name}`;
          nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
        });

        const seen = new Set<string>();
        const merged: any[] = [];
        filtered.forEach((e: any) => {
          const key = `${e.role}:${e.name}`;
          const count = nameCounts.get(key) || 1;
          if (count > 1) {
            if (!seen.has(key)) {
              seen.add(key);
              merged.push({ ...e, name: `${e.name} (${count}x)` });
            }
          } else {
            merged.push(e);
          }
        });
        tree = merged;
      }

      const treeText = JSON.stringify(tree);
      return {
        content: [
          { type: "image", data: pageState.screenshot, mimeType: "image/jpeg" },
          {
            type: "text",
            text: shouldSendInstructions
              ? `### SYSTEM CONTEXT & BROWSER RULES\n\n${systemPrompt}\n\n### ACCESSIBILITY TREE\n\n${treeText}`
              : treeText,
          },
        ],
      };
    }
  );
}
