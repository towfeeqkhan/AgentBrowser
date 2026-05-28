import { captureCache, wsState } from "./state.js";
import { CAPTURE_DEBOUNCE_MS } from "./constants.js";
import {
  attachCDP_MCP,
  captureViewportScreenshot,
  injectMutationObserver,
  isRestrictedUrl,
} from "./cdp-helpers.js";

async function buildTreeWithCoords() {
  if (wsState.debuggerAttachedTabId === null) {
    throw new Error("Debugger not attached");
  }
  const tabId = wsState.debuggerAttachedTabId;
  const result = (await chrome.debugger.sendCommand(
    { tabId },
    "Runtime.evaluate",
    {
      expression: `
        (() => {
          const MAX_ELEMENTS = 200;
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const vcx = vw / 2;
          const vcy = vh / 2;
          const sel = 'button:not([hidden]):not([aria-hidden="true"]), '
            + 'a:not([hidden]):not([aria-hidden="true"]), '
            + 'input:not([hidden]):not([aria-hidden="true"]), '
            + 'select:not([hidden]):not([aria-hidden="true"]), '
            + 'textarea:not([hidden]):not([aria-hidden="true"]), '
            + '[role="button"]:not([hidden]):not([aria-hidden="true"]), '
            + '[role="link"]:not([hidden]):not([aria-hidden="true"]), '
            + '[role="checkbox"]:not([hidden]):not([aria-hidden="true"]), '
            + '[role="radio"]:not([hidden]):not([aria-hidden="true"]), '
            + '[role="combobox"]:not([hidden]):not([aria-hidden="true"]), '
            + '[role="menuitem"]:not([hidden]):not([aria-hidden="true"]), '
            + '[role="tab"]:not([hidden]):not([aria-hidden="true"]), '
            + '[role="switch"]:not([hidden]):not([aria-hidden="true"])';
          const elements = document.querySelectorAll(sel);
          const interactive = [];

          function getGroupLabel(el) {
            let p = el.parentElement;
            for (let depth = 0; p && depth < 6; depth++, p = p.parentElement) {
              const heading = p.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
              if (heading && heading !== el) {
                const t = heading.innerText?.trim();
                if (t && t.length > 0 && t.length < 80) return t.slice(0, 60);
              }
              const label = p.getAttribute('aria-label');
              if (label && label.trim().length > 0) return label.trim().slice(0, 60);
            }
            return null;
          }

          function getNearbyText(el, r) {
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const parent = el.parentElement;
            if (!parent) return null;
            let bestText = null;
            let bestDist = 10000;

            const candidates = parent.querySelectorAll('span, p, label, div, td, li, h1, h2, h3, h4, h5, h6');
            for (let i = 0; i < Math.min(candidates.length, 30); i++) {
              const c = candidates[i];
              if (c === el || c.contains(el) || el.contains(c)) continue;
              const ct = c.innerText?.trim();
              if (!ct || ct.length === 0 || ct.length > 80) continue;
              const cr = c.getBoundingClientRect();
              if (cr.width <= 0 || cr.height <= 0) continue;
              const dx = (cr.left + cr.width / 2) - cx;
              const dy = (cr.top + cr.height / 2) - cy;
              const dist = dx * dx + dy * dy;
              if (dist < bestDist) {
                bestDist = dist;
                bestText = ct.slice(0, 60).replace(/\\s+/g, ' ');
              }
            }
            return bestText;
          }

          for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML'
                && getComputedStyle(el).position !== 'fixed') continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
            const mcpId = el.id || el.getAttribute('data-id') || 'mcp-' + i;
            el.setAttribute('data-mcp-id', mcpId);
            const cx = Math.round(r.left + r.width / 2);
            const cy = Math.round(r.top + r.height / 2);

            const distFromCenter = Math.sqrt((cx - vcx) ** 2 + (cy - vcy) ** 2);
            const maxDist = Math.sqrt(vcx ** 2 + vcy ** 2);
            const priority = distFromCenter < maxDist * 0.33 ? 3
                           : distFromCenter < maxDist * 0.66 ? 2 : 1;

            const rawName = el.getAttribute('aria-label')
               || el.getAttribute('title')
               || el.innerText?.trim()
               || el.getAttribute('placeholder') || '';
            const name = rawName.replace(/\\s+/g, ' ').slice(0, 60);

            const entry = {
              id: mcpId,
              role: el.tagName.toLowerCase() === 'a' ? 'link'
                  : el.tagName.toLowerCase() === 'input' ? el.type || 'input'
                  : el.tagName.toLowerCase() === 'textarea' ? 'textbox'
                  : el.getAttribute('role') || el.tagName.toLowerCase(),
              name,
              box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
              center: [cx, cy],
              href: el.href || null,
              value: el.value || null,
              _priority: priority,
            };

            if (name.length < 25) {
              const nearby = getNearbyText(el, r);
              if (nearby) entry.nearbyText = nearby;
            }

            const group = getGroupLabel(el);
            if (group && group !== name) entry.group = group;

            interactive.push(entry);
          }

          interactive.sort((a, b) => b._priority - a._priority);
          const results = interactive.slice(0, MAX_ELEMENTS);
          return results.map(({ _priority, ...rest }) => rest);
        })()
      `,
      returnByValue: true,
    },
  )) as any;

  return result.result.value;
}

export async function performCapture(isExplicitAction: boolean = false) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && isRestrictedUrl(tab.url) && !isExplicitAction) {
    console.log("[EXT] Skipping passive background capture on restricted URL:", tab.url);
    return { success: false, error: "Skipped passive capture on restricted URL" };
  }

  const tabId = await attachCDP_MCP(isExplicitAction);

  await injectMutationObserver(tabId).catch(() => {});

  const [screenshot, tree] = await Promise.all([
    captureViewportScreenshot(tabId),
    buildTreeWithCoords(),
  ]);

  const treeJson = JSON.stringify(tree);
  const treeUnchanged = captureCache.lastSentTreeJson !== null && treeJson === captureCache.lastSentTreeJson;

  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  captureCache.lastCapturedUrl = currentTab?.url || "";
  captureCache.lastCapturedState = { screenshot, tree };

  if (wsState.ws && wsState.ws.readyState === WebSocket.OPEN) {
    if (treeUnchanged) {
      wsState.ws.send(
        JSON.stringify({
          type: "page_state",
          data: { screenshot, tree: null, treeUnchanged: true },
        }),
      );
    } else {
      captureCache.lastSentTreeJson = treeJson;
      wsState.ws.send(
        JSON.stringify({
          type: "page_state",
          data: captureCache.lastCapturedState,
        }),
      );
    }
  }
  return { success: true };
}

export function invalidateCapture() {
  captureCache.lastCapturedState = null;
  captureCache.lastCapturedUrl = null;
}

export function debouncedCapture(): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    if (captureCache.captureDebounceTimer) clearTimeout(captureCache.captureDebounceTimer);
    captureCache.captureDebounceTimer = setTimeout(async () => {
      invalidateCapture();
      const result = await performCapture(false);
      resolve(result);
    }, CAPTURE_DEBOUNCE_MS);
  });
}
