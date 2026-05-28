import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  sendAction,
  findElement,
  findElementById,
  findElementByProximity,
  PipelineActionSchema,
} from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "execute_pipeline",
    {
      description:
        "Execute multiple browser actions in a single round-trip. Far faster than separate tool calls for multi-step flows (e.g. click input, type query, click search).",
      inputSchema: {
        actions: z
          .array(PipelineActionSchema)
          .min(1)
          .describe("Ordered list of actions to execute sequentially in the browser"),
        autoDismiss: z
          .array(
            z.object({
              selector: z.string().describe("CSS selector for the dismissable element"),
              action: z.enum(["click", "remove"]).describe("How to dismiss"),
            })
          )
          .optional()
          .describe(
            "Auto-dismiss popups/overlays during pipeline. These selectors are checked before each action and on failure."
          ),
      },
    },
    async ({ actions, autoDismiss }) => {
      const resolvedActions = actions.map((action) => {
        const resolved = { ...action } as any;
        if (["click", "hover", "type"].includes(action.type) && action.x === undefined) {
          let el: any = null;
          if (action.name && action.proximityText) {
            el = findElementByProximity(action.name, action.proximityText);
          }
          if (!el && action.elementId !== undefined) {
            el = findElementById(action.elementId);
          }
          if (!el && action.name) {
            el = findElement(action.name);
          }
          if (el) {
            resolved.x = el.center[0];
            resolved.y = el.center[1];
            console.error(`[MCP] Pipeline: resolved "${el.name}" → (${resolved.x}, ${resolved.y})`);
          }
        }
        return resolved;
      });

      const result: any = await sendAction({ type: "pipeline", actions: resolvedActions, autoDismiss });

      const summary = (result?.results ?? []).map((r: any, i: number) => {
        const step = resolvedActions[i];
        return r.success
          ? `  ✅ Step ${i + 1} [${step.type}]: ok`
          : `  ❌ Step ${i + 1} [${step.type}]: ${r.error}`;
      }).join("\n");

      const recoveryScreenshot = result?.recoveryScreenshot;

      const contentBlocks: any[] = [
        {
          type: "text",
          text: `Pipeline completed (${resolvedActions.length} actions):\n${summary}`,
        },
      ];

      if (recoveryScreenshot) {
        contentBlocks.push({
          type: "image",
          data: recoveryScreenshot,
          mimeType: "image/jpeg",
        });
        contentBlocks.push({
          type: "text",
          text: "⬆️ Recovery screenshot captured at the point of failure.",
        });
      }

      return { content: contentBlocks };
    }
  );
}
