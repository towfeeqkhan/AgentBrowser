import type { BoundingBox, CleanNode, SerializedNode } from "../types/capture.js";
import { INTERACTIVE_ROLES, TEXT_ROLES, NEGATIVE_KEYWORDS } from "./constants.js";
import {
  sendCdpCommand,
  getViewportMetrics,
  attachDebugger,
  detachDebugger,
  captureViewportScreenshot,
  getActiveTabId,
  type ViewportMetrics,
} from "./cdp-helpers.js";

function getRoleValue(node: Protocol.Accessibility.AXNode): string | undefined {
  const roleValue = node.role?.value;
  return typeof roleValue === "string" ? roleValue.toLowerCase() : undefined;
}

function getNameValue(node: Protocol.Accessibility.AXNode): string | undefined {
  const nameValue = node.name?.value;
  if (typeof nameValue !== "string") {
    return undefined;
  }
  const trimmed = nameValue.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getBooleanProperty(
  node: Protocol.Accessibility.AXNode,
  propertyNames: string[],
): boolean | undefined {
  if (!node.properties) {
    return undefined;
  }
  for (const propertyName of propertyNames) {
    const match = node.properties.find((prop) => prop.name === propertyName);
    const value = match?.value?.value;
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function getPropertyValue(
  node: Protocol.Accessibility.AXNode,
  propertyNames: string[],
): unknown {
  if (!node.properties) {
    return undefined;
  }
  for (const propertyName of propertyNames) {
    const match = node.properties.find((prop) => prop.name === propertyName);
    if (match) {
      return match.value?.value;
    }
  }
  return undefined;
}

function getStringPropertyValue(
  node: Protocol.Accessibility.AXNode,
  propertyNames: string[],
): string | undefined {
  const value = getPropertyValue(node, propertyNames);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  return undefined;
}

function getStateValue(
  node: Protocol.Accessibility.AXNode,
): string | undefined {
  const disabled = getBooleanProperty(node, ["disabled"]);
  if (disabled === true) {
    return "disabled";
  }

  const expanded = getBooleanProperty(node, ["expanded"]);
  if (expanded === true) {
    return "expanded";
  }
  if (expanded === false) {
    return "collapsed";
  }

  const checked = getPropertyValue(node, ["checked"]);
  if (checked === true) {
    return "checked";
  }
  if (checked === false) {
    return "unchecked";
  }
  if (typeof checked === "string") {
    const normalized = checked.toLowerCase();
    if (normalized === "mixed") {
      return "mixed";
    }
    if (normalized === "checked" || normalized === "unchecked") {
      return normalized;
    }
  }

  return undefined;
}

function getNodeValue(
  node: Protocol.Accessibility.AXNode,
  role: string | undefined,
): string | undefined {
  if (!role || (role !== "textbox" && role !== "combobox")) {
    return undefined;
  }
  return getStringPropertyValue(node, ["value"]);
}

function containsKeyword(
  text: string | undefined,
  keywords: string[],
): boolean {
  if (!text) {
    return false;
  }
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function isHidden(node: Protocol.Accessibility.AXNode): boolean {
  if (node.ignored) {
    return true;
  }
  const hidden = getBooleanProperty(node, ["hidden", "invisible"]);
  if (hidden === true) {
    return true;
  }
  return false;
}

function isPresentationalRole(role: string | undefined): boolean {
  return role === "none" || role === "presentation";
}

function shouldExcludeNode(
  node: Protocol.Accessibility.AXNode,
  role: string | undefined,
  name: string | undefined,
): boolean {
  if (isHidden(node)) {
    return true;
  }
  if (isPresentationalRole(role)) {
    return true;
  }
  if (role === "contentinfo" || role === "footer") {
    return true;
  }
  if (containsKeyword(name, NEGATIVE_KEYWORDS)) {
    return true;
  }
  return false;
}

function quadToBox(quad: number[]): BoundingBox | null {
  if (quad.length !== 8) {
    return null;
  }
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x: minX, y: minY, width, height };
}

async function getBoxForNode(
  tabId: number,
  backendNodeId: number,
): Promise<BoundingBox | null> {
  try {
    const result = await sendCdpCommand<{
      model: { content: number[] };
    }>(tabId, "DOM.getBoxModel", { backendNodeId });
    return quadToBox(result.model.content);
  } catch {
    return null;
  }
}

async function mapWithLimit<T, U>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

function flattenNodes(nodes: CleanNode[]): CleanNode[] {
  const flattened: CleanNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    flattened.push(node);
    if (node.children && node.children.length > 0) {
      stack.push(...node.children);
    }
  }
  return flattened;
}

function pruneAndSerializeTree(
  rawTree: CleanNode[],
  metrics: ViewportMetrics,
): SerializedNode[] {
  const viewWidth = metrics.viewWidth;
  const viewHeight = metrics.viewHeight;
  const scrollY = metrics.scrollY;

  const lookaheadBuffer = 600;

  const cleanedTree = rawTree.filter((node) => {
    const box = node.boundingBox;
    if (!box) {
      return false;
    }

    if (box.x < 0 || box.y < 0) {
      return false;
    }

    const isBelowViewport = box.y > scrollY + viewHeight + lookaheadBuffer;
    const isAboveViewport = box.y + box.height < scrollY;

    if (isBelowViewport || isAboveViewport) {
      return false;
    }

    return true;
  });

  const contextIndices = new Array<string | undefined>(cleanedTree.length).fill(
    undefined,
  );
  let runStart = 0;
  for (let index = 1; index <= cleanedTree.length; index += 1) {
    const prev = cleanedTree[index - 1];
    const current = cleanedTree[index];
    const sameRun =
      current &&
      prev &&
      prev.name &&
      current.name === prev.name &&
      current.role === prev.role;
    if (!sameRun) {
      const runLength = index - runStart;
      if (runLength > 1) {
        for (let offset = 0; offset < runLength; offset += 1) {
          const node = cleanedTree[runStart + offset];
          if (node?.kind === "interactive") {
            contextIndices[runStart + offset] = `${offset + 1}/${runLength}`;
          }
        }
      }
      runStart = index;
    }
  }

  return cleanedTree.map((node, index) => {
    const box = node.boundingBox as BoundingBox;
    const cleanLeftX = Math.round(box.x);
    const cleanTopY = Math.round(box.y);
    const cleanWidth = Math.round(box.width);
    const cleanHeight = Math.round(box.height);
    const exactCenterX = Math.round(cleanLeftX + cleanWidth / 2);
    const exactCenterY = Math.round(cleanTopY + cleanHeight / 2);

    return {
      id: node.id,
      role: node.role,
      name: node.name,
      box: [cleanLeftX, cleanTopY, cleanWidth, cleanHeight],
      center: [exactCenterX, exactCenterY],
      state: node.state,
      value: node.value,
      context: contextIndices[index],
    };
  });
}

async function buildCleanContext(
  tabId: number,
  nodes: Protocol.Accessibility.AXNode[],
): Promise<CleanNode[]> {
  const parentIdMap = new Map<string, string>();
  for (const node of nodes) {
    for (const childId of node.childIds ?? []) {
      parentIdMap.set(childId, node.nodeId);
    }
  }

  const keptIds = new Set<string>();
  const keptNodes: CleanNode[] = [];

  for (const node of nodes) {
    const role = getRoleValue(node);
    const name = getNameValue(node);
    const state = getStateValue(node);
    const value = getNodeValue(node, role);
    if (shouldExcludeNode(node, role, name)) {
      continue;
    }

    let kind: CleanNode["kind"] | undefined;
    if (role && INTERACTIVE_ROLES.has(role)) {
      kind = "interactive";
    } else if (role && TEXT_ROLES.has(role)) {
      const hasTerminalText =
        Boolean(name) && (node.childIds?.length ?? 0) === 0;
      if (hasTerminalText) {
        kind = "text";
      }
    }

    if (!kind) {
      continue;
    }

    keptIds.add(node.nodeId);
    keptNodes.push({
      id: node.nodeId,
      role,
      name,
      kind,
      parentId: parentIdMap.get(node.nodeId),
      state,
      value,
      childIds: node.childIds,
    });
  }

  const backendIdMap = new Map<string, number>();
  for (const node of nodes) {
    if (node.backendDOMNodeId) {
      backendIdMap.set(node.nodeId, node.backendDOMNodeId);
    }
  }

  const nodesWithBoxes = keptNodes.filter((node) => node.id);
  const boxes = await mapWithLimit(nodesWithBoxes, 25, async (node) => {
    const backendId = backendIdMap.get(node.id);
    if (!backendId) {
      return { id: node.id, box: null as BoundingBox | null };
    }
    return { id: node.id, box: await getBoxForNode(tabId, backendId) };
  });
  const boxMap = new Map<string, BoundingBox | null>(
    boxes.map((entry) => [entry.id, entry.box]),
  );

  const cleanMap = new Map<string, CleanNode>();
  for (const node of keptNodes) {
    const boundingBox = boxMap.get(node.id) ?? undefined;
    cleanMap.set(node.id, {
      ...node,
      boundingBox: boundingBox ?? undefined,
      childIds: node.childIds?.filter((childId) => keptIds.has(childId)),
      children: [],
    });
  }

  const roots: CleanNode[] = [];
  for (const node of cleanMap.values()) {
    const parentId = node.parentId;
    if (parentId && cleanMap.has(parentId)) {
      cleanMap.get(parentId)?.children?.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function captureAxTree(): Promise<{
  context: SerializedNode[];
  screenshot?: string;
}> {
  const tabId = await getActiveTabId();
  const alreadyAttached = await attachDebugger(tabId);
  try {
    await sendCdpCommand(tabId, "Page.enable");
    const [screenshot, result, metrics] = await Promise.all([
      captureViewportScreenshot(tabId),
      sendCdpCommand<{ nodes: Protocol.Accessibility.AXNode[] }>(
        tabId, "Accessibility.getFullAXTree"
      ),
      getViewportMetrics(tabId),
    ]);
    const context = await buildCleanContext(tabId, result.nodes);
    const pruned = pruneAndSerializeTree(flattenNodes(context), metrics);
    return { context: pruned, screenshot };
  } finally {
    if (!alreadyAttached) {
      await detachDebugger(tabId).catch(() => {});
    }
  }
}
