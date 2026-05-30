import { WebSocket } from "ws";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// ─── Workspace Root ──────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

export function findWorkspaceRoot(startPath: string): string {
  let current = startPath;
  for (let i = 0; i < 4; i++) {
    try {
      const testPath = resolve(current, ".agent", "browser-instructions.md");
      readFileSync(testPath, "utf-8");
      return current;
    } catch {}
    current = resolve(current, "..");
  }
  return resolve(startPath, "..");
}

const workspaceRoot = findWorkspaceRoot(__dirname);

export function loadAgentFile(filename: string): string {
  try {
    return readFileSync(resolve(workspaceRoot, ".agent", filename), "utf-8");
  } catch {
    console.error(`[MCP] Warning: Could not load .agent/${filename}`);
    return "";
  }
}

const browserInstructions = loadAgentFile("browser-instructions.md");
const toolsDocumentation = loadAgentFile("tools-documentation.md");

export const systemPrompt = [
  "# SYSTEM CONTEXT",
  "",
  "## Browser Instructions",
  browserInstructions,
  "",
  "## Tools Documentation",
  toolsDocumentation,
].join("\n");

// ─── State ───────────────────────────────────────────
export let pageState: { screenshot: string; tree: any[] } | null = null;
export let lastCaptureTime = 0;
export let extensionWs: WebSocket | null = null;
export let pendingActions = new Map<string, (result: any) => void>();

export let lastToolCallTime = 0;
export let instructionsSentOnce = false;

export let pageStateWaiters: Array<() => void> = [];

// ─── Helpers ─────────────────────────────────────────
export function waitForPageState(timeoutMs = 8000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      pageStateWaiters = pageStateWaiters.filter((r) => r !== done);
      reject(new Error("Timed out waiting for page_state push"));
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    pageStateWaiters.push(done);
  });
}

export function sendAction(action: any) {
  return new Promise((resolve, reject) => {
    if (!extensionWs) return reject(new Error("Extension not connected"));

    const id = `${Date.now()}-${Math.random()}`;
    pendingActions.set(id, resolve);
    extensionWs.send(JSON.stringify({ id, ...action }));

    setTimeout(() => {
      if (pendingActions.has(id)) {
        pendingActions.delete(id);
        reject(new Error("Action timed out"));
      }
    }, 10000);
  });
}

// ─── Element Finders ─────────────────────────────────
export function findElement(query: string) {
  if (!pageState?.tree) return null;
  const tree = pageState.tree;

  let el = tree.find((e: any) => e.id === query);
  if (el) return el;

  el = tree.find((e: any) => e.name?.toLowerCase() === query.toLowerCase());
  if (el) return el;

  el = tree.find((e: any) =>
    e.name?.toLowerCase().includes(query.toLowerCase()),
  );
  if (el) return el;

  el = tree.find(
    (e: any) =>
      query.toLowerCase().includes(e.role) &&
      e.name
        ?.toLowerCase()
        .includes(query.toLowerCase().replace(e.role, "").trim()),
  );
  return el || null;
}

export function findElementById(id: string | number) {
  if (!pageState?.tree) return null;
  const tree = pageState.tree;
  const targetId = String(id).trim();
  return tree.find((e: any) => String(e.id).trim() === targetId) || null;
}

export function findElementByProximity(text: string, proximityText: string) {
  if (!pageState?.tree) return null;
  const tree = pageState.tree;

  const candidates = tree.filter((e: any) =>
    e.name?.toLowerCase().includes(text.toLowerCase()),
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const anchor = tree.find((e: any) =>
    e.name?.toLowerCase().includes(proximityText.toLowerCase()),
  );
  if (!anchor || !anchor.center) return candidates[0];

  let closest = candidates[0];
  let minDist = Infinity;
  for (const c of candidates) {
    if (!c.center) continue;
    const dx = c.center[0] - anchor.center[0];
    const dy = c.center[1] - anchor.center[1];
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closest = c;
    }
  }
  return closest;
}

// ─── Clipboard ────────────────────────────────────────
export function setHostClipboard(text: string): string {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      execSync(`powershell -Command "Set-Clipboard -Value $([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${Buffer.from(text).toString("base64")}')))"`, { timeout: 3000 });
      return "ok";
    } else if (platform === "darwin") {
      execSync("pbcopy", { input: text, timeout: 3000 });
      return "ok";
    } else {
      execSync("xclip -selection clipboard", { input: text, timeout: 3000 });
      return "ok";
    }
  } catch (e: any) {
    return `clipboard set failed: ${e.message}`;
  }
}

export function getHostClipboard(): string {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      return execSync('powershell -Command "Get-Clipboard"', { encoding: "utf-8", timeout: 3000 }).trim();
    } else if (platform === "darwin") {
      return execSync("pbpaste", { encoding: "utf-8", timeout: 3000 }).trim();
    } else {
      return execSync("xclip -selection clipboard -o", { encoding: "utf-8", timeout: 3000 }).trim();
    }
  } catch {
    return "";
  }
}

// ─── State Setter Helpers ────────────────────────────
export function setPageState(value: typeof pageState) { pageState = value; }
export function setLastCaptureTime(value: number) { lastCaptureTime = value; }
export function setLastToolCallTime(value: number) { lastToolCallTime = value; }
export function setInstructionsSentOnce(value: boolean) { instructionsSentOnce = value; }
export function setExtensionWs(value: WebSocket | null) { extensionWs = value; }
export function setPendingActions(value: Map<string, (result: any) => void>) { pendingActions = value; }
export function setPageStateWaiters(value: Array<() => void>) { pageStateWaiters = value; }

export function pageStateContentBlocks(compact: boolean = true) {
  if (!pageState) return [] as Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
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
  return [
    { type: "image" as const, data: pageState.screenshot, mimeType: "image/jpeg" },
    { type: "text" as const, text: treeText },
  ];
}

// ─── Pipeline Schema (shared with execute_pipeline) ──
export const PipelineActionSchema = z.object({
  type: z.enum(["click", "type", "scroll", "navigate", "hover"]).describe(
    "Action type"
  ),
  elementId: z.union([z.string(), z.number()]).optional().describe("Element ID from the tree"),
  name: z.string().optional().describe("Element label from the tree (resolved to x,y automatically)"),
  selector: z.string().optional().describe("CSS selector to target a specific DOM element"),
  x: z.number().optional().describe("X coordinate (fallback)"),
  y: z.number().optional().describe("Y coordinate (fallback)"),
  text: z.string().optional().describe("Text to type"),
  clearFirst: z.boolean().optional().describe("Clear the field before typing (default: true)"),
  pressEnter: z.boolean().optional().describe("Press Enter key after typing text"),
  deltaY: z.number().optional().describe("Pixels to scroll (positive = down)"),
  url: z.string().optional().describe("URL to navigate to"),
  proximityText: z.string().optional().describe("Nearby text to disambiguate same-name elements"),
});
