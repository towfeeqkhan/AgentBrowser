import { BUILTIN_DISMISSALS } from "./constants.js";
import {
  attachCDP_MCP,
  captureViewportScreenshot,
  waitForDOMSettled,
  waitForPageLoadIfNavigating,
} from "./cdp-helpers.js";
import { performCapture, invalidateCapture } from "./capture.js";

export async function performClick(x: number, y: number, elementId?: string, selector?: string, proximityText?: string) {
  const tabId = await attachCDP_MCP(true);

  if (proximityText && !elementId && !selector) {
    try {
      const proximityResult = (await chrome.debugger.sendCommand(
        { tabId },
        "Runtime.evaluate",
        {
          expression: `(() => {
            const allEls = document.querySelectorAll('button, a, input, select, [role="button"], [role="link"]');
            const targetText = ${JSON.stringify(proximityText)};
            let anchor = null;
            for (const el of document.querySelectorAll('*')) {
              if (el.innerText?.trim().toLowerCase().includes(targetText.toLowerCase())) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) { anchor = el; break; }
              }
            }
            if (!anchor) return null;
            const ar = anchor.getBoundingClientRect();
            const ax = ar.left + ar.width / 2;
            const ay = ar.top + ar.height / 2;
            let best = null;
            let bestDist = Infinity;
            for (const el of allEls) {
              const r = el.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) continue;
              const ex = r.left + r.width / 2;
              const ey = r.top + r.height / 2;
              const dist = (ex - ax) ** 2 + (ey - ay) ** 2;
              if (dist < bestDist) {
                bestDist = dist;
                best = el;
              }
            }
            if (best) {
              best.scrollIntoView({ block: 'center', inline: 'center' });
              return new Promise((resolve) => {
                setTimeout(() => {
                  const r = best.getBoundingClientRect();
                  resolve({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
                }, 50);
              });
            }
            return null;
          })()`,
          returnByValue: true,
          awaitPromise: true,
        },
      )) as any;
      const coords = proximityResult?.result?.value;
      if (coords) {
        x = coords.x;
        y = coords.y;
        console.log(`[EXT] Proximity resolved near "${proximityText}" to (${x}, ${y})`);
      }
    } catch (e) {
      console.error("[EXT] Error in proximity resolution:", e);
    }
  }

  if (elementId) {
    try {
      const freshCoordsResult = (await chrome.debugger.sendCommand(
        { tabId },
        "Runtime.evaluate",
        {
          expression: `(() => {
            const el = document.querySelector('[data-mcp-id=${JSON.stringify(elementId)}]');
            if (el) {
              el.scrollIntoView({ block: 'center', inline: 'center' });
              return new Promise((resolve) => {
                setTimeout(() => {
                  const r = el.getBoundingClientRect();
                  resolve({
                    x: Math.round(r.left + r.width / 2),
                    y: Math.round(r.top + r.height / 2),
                    tagName: el.tagName.toLowerCase()
                  });
                }, 50);
              });
            }
            return null;
          })()`,
          returnByValue: true,
          awaitPromise: true,
        },
      )) as any;

      const freshCoords = freshCoordsResult?.result?.value;
      if (freshCoords) {
        x = freshCoords.x;
        y = freshCoords.y;
        console.log(`[EXT] Scrolled element into view. Fresh coords: (${x}, ${y}), Tag: ${freshCoords.tagName}`);
      }
    } catch (e) {
      console.error("[EXT] Error scrolling element before click:", e);
    }
  }

  if (!elementId && selector) {
    try {
      const selectorResult = (await chrome.debugger.sendCommand(
        { tabId },
        "Runtime.evaluate",
        {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (el) {
              el.scrollIntoView({ block: 'center', inline: 'center' });
              return new Promise((resolve) => {
                setTimeout(() => {
                  const r = el.getBoundingClientRect();
                  resolve({
                    x: Math.round(r.left + r.width / 2),
                    y: Math.round(r.top + r.height / 2)
                  });
                }, 50);
              });
            }
            return null;
          })()`,
          returnByValue: true,
          awaitPromise: true,
        },
      )) as any;

      const selectorCoords = selectorResult?.result?.value;
      if (selectorCoords) {
        x = selectorCoords.x;
        y = selectorCoords.y;
        console.log(`[EXT] Resolved selector "${selector}" to (${x}, ${y})`);
      }
    } catch (e) {
      console.error("[EXT] Error resolving selector for click:", e);
    }
  }

  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });

  await waitForPageLoadIfNavigating(tabId);
  invalidateCapture();
  await performCapture(true);
  return { success: true };
}

export async function performType(
  text: string,
  selector?: string,
  x?: number,
  y?: number,
  clearFirst: boolean = true,
  pressEnter: boolean = false,
) {
  const tabId = await attachCDP_MCP(true);

  if (selector) {
    try {
      await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) {
            el.focus();
            if (el.click) el.click();
            return true;
          }
          return false;
        })()`,
        returnByValue: true,
      });
    } catch (e) {
      console.error("[EXT] Error focusing selector before typing:", e);
    }
  } else if (x !== undefined && y !== undefined) {
    try {
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (e) {
      console.error("[EXT] Error clicking coordinates before typing:", e);
    }
  }

  if (clearFirst) {
    try {
      await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression: `(() => {
          const el = document.activeElement;
          if (!el) return false;
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          } else if (el.isContentEditable) {
            el.innerHTML = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        })()`,
        returnByValue: true,
      });
    } catch (e) {
      console.error("[EXT] Error programmatically clearing active element:", e);
    }
  }

  for (const char of text) {
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
      type: "char",
      text: char,
    });
  }

  if (pressEnter) {
    try {
      await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
        expression: `(() => {
          const el = document.activeElement;
          if (!el) return false;
          const dispatch = (type) => {
            const ev = new KeyboardEvent(type, {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            el.dispatchEvent(ev);
            return ev.defaultPrevented;
          };
          dispatch('keydown');
          dispatch('keypress');
          dispatch('keyup');
          return true;
        })()`,
        returnByValue: true,
      });
    } catch (e) {
      console.error("[EXT] Error dispatching DOM Enter event:", e);
    }

    try {
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
        type: "rawKeyDown",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
      });
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
      });
    } catch (e) {
      console.error("[EXT] Error dispatching CDP Enter key:", e);
    }
  }

  await waitForPageLoadIfNavigating(tabId);
  invalidateCapture();
  return { success: true };
}

export async function performScroll(x: number, y: number, deltaY: number) {
  const tabId = await attachCDP_MCP(true);
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x,
    y,
    deltaX: 0,
    deltaY,
  });
  invalidateCapture();
  return { success: true };
}

export async function performNavigate(url: string) {
  const tabId = await attachCDP_MCP(true, url);
  const tab = await chrome.tabs.get(tabId);
  if (tab.url !== url) {
    await chrome.tabs.update(tabId, { url });
  }
  await waitForPageLoadIfNavigating(tabId, 500, 10000);
  invalidateCapture();
  await performCapture(true);
  return { success: true };
}

export async function performGetUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return { url: tab?.url || "" };
}

export async function performRefresh() {
  const tabId = await attachCDP_MCP(true);
  await chrome.tabs.reload(tabId);
  await waitForPageLoadIfNavigating(tabId, 500, 10000);
  invalidateCapture();
  await performCapture(true);
  return { success: true };
}

export async function performGoBack() {
  const tabId = await attachCDP_MCP(true);
  await chrome.tabs.goBack(tabId);
  await waitForPageLoadIfNavigating(tabId, 500, 10000);
  invalidateCapture();
  await performCapture(true);
  return { success: true };
}

export async function performGoForward() {
  const tabId = await attachCDP_MCP(true);
  await chrome.tabs.goForward(tabId);
  await waitForPageLoadIfNavigating(tabId, 500, 10000);
  invalidateCapture();
  await performCapture(true);
  return { success: true };
}

export async function performHover(x: number, y: number, elementId?: string, selector?: string) {
  const tabId = await attachCDP_MCP(true);

  if (elementId) {
    try {
      const freshCoordsResult = (await chrome.debugger.sendCommand(
        { tabId },
        "Runtime.evaluate",
        {
          expression: `(() => {
            const el = document.querySelector('[data-mcp-id=${JSON.stringify(elementId)}]');
            if (el) {
              el.scrollIntoView({ block: 'center', inline: 'center' });
              return new Promise((resolve) => {
                setTimeout(() => {
                  const r = el.getBoundingClientRect();
                  resolve({
                    x: Math.round(r.left + r.width / 2),
                    y: Math.round(r.top + r.height / 2)
                  });
                }, 50);
              });
            }
            return null;
          })()`,
          returnByValue: true,
          awaitPromise: true,
        },
      )) as any;

      const freshCoords = freshCoordsResult?.result?.value;
      if (freshCoords) {
        x = freshCoords.x;
        y = freshCoords.y;
      }
    } catch (e) {
      console.error("[EXT] Error scrolling before hover:", e);
    }
  }

  if (!elementId && selector) {
    try {
      const selectorResult = (await chrome.debugger.sendCommand(
        { tabId },
        "Runtime.evaluate",
        {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (el) {
              el.scrollIntoView({ block: 'center', inline: 'center' });
              return new Promise((resolve) => {
                setTimeout(() => {
                  const r = el.getBoundingClientRect();
                  resolve({
                    x: Math.round(r.left + r.width / 2),
                    y: Math.round(r.top + r.height / 2)
                  });
                }, 50);
              });
            }
            return null;
          })()`,
          returnByValue: true,
          awaitPromise: true,
        },
      )) as any;

      const selectorCoords = selectorResult?.result?.value;
      if (selectorCoords) {
        x = selectorCoords.x;
        y = selectorCoords.y;
        console.log(`[EXT] Resolved selector "${selector}" to (${x}, ${y}) for hover`);
      }
    } catch (e) {
      console.error("[EXT] Error resolving selector for hover:", e);
    }
  }

  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
  });
  return { success: true };
}

export async function performGetText(selector?: string, x?: number, y?: number, elementId?: string) {
  const tabId = await attachCDP_MCP(true);
  let expression = "";
  if (elementId) {
    expression = `(() => {
      const el = document.querySelector('[data-mcp-id=${JSON.stringify(elementId)}]');
      return el ? el.innerText || el.textContent || "" : null;
    })()`;
  } else if (selector) {
    expression = `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      return el ? el.innerText || el.textContent || "" : null;
    })()`;
  } else if (x !== undefined && y !== undefined) {
    expression = `(() => {
      const el = document.elementFromPoint(${x}, ${y});
      return el ? el.innerText || el.textContent || "" : null;
    })()`;
  } else {
    throw new Error("Either selector or x/y coordinates must be provided");
  }

  const result = (await chrome.debugger.sendCommand(
    { tabId },
    "Runtime.evaluate",
    {
      expression,
      returnByValue: true,
    },
  )) as any;

  const text = result.result?.value;
  if (text === null) {
    throw new Error("Element not found");
  }
  return { text };
}

async function autoDismissOverlays(
  tabId: number,
  dismissals: Array<{ selector: string; action: string }>,
): Promise<number> {
  try {
    const result = (await chrome.debugger.sendCommand(
      { tabId },
      "Runtime.evaluate",
      {
        expression: `(() => {
          const dismissals = ${JSON.stringify(dismissals)};
          let count = 0;
          for (const d of dismissals) {
            try {
              const el = document.querySelector(d.selector);
              if (!el) continue;
              const r = el.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) continue;
              if (d.action === 'remove') {
                el.remove();
              } else {
                el.click();
              }
              count++;
            } catch (_) {}
          }
          return count;
        })()`,
        returnByValue: true,
      },
    )) as any;
    const dismissed = result?.result?.value ?? 0;
    if (dismissed > 0) {
      console.log(`[EXT] Auto-dismissed ${dismissed} overlay(s)`);
    }
    return dismissed;
  } catch (e) {
    console.warn("[EXT] autoDismissOverlays failed:", e);
    return 0;
  }
}

export async function performListTabs() {
  const tabs = await chrome.tabs.query({});
  return { tabs: tabs.map(t => ({ id: t.id, url: t.url, title: t.title, active: t.active })) };
}

export async function performSwitchTab(tabId: number) {
  await chrome.tabs.update(tabId, { active: true });
  return { success: true };
}

export async function performCloseTab(tabId: number) {
  await chrome.tabs.remove(tabId);
  return { success: true };
}

export async function performPipeline(
  actions: Array<{
    type: string;
    x?: number;
    y?: number;
    elementId?: string;
    selector?: string;
    proximityText?: string;
    text?: string;
    clearFirst?: boolean;
    pressEnter?: boolean;
    deltaY?: number;
    url?: string;
  }>,
  autoDismiss?: Array<{ selector: string; action: string }>,
): Promise<{ success: boolean; results: any[]; recoveryScreenshot?: string | null }> {
  const subResults: any[] = [];
  const tabId = await attachCDP_MCP(true);

  const allDismissals = [
    ...(autoDismiss || []),
    ...BUILTIN_DISMISSALS,
  ];

  for (const action of actions) {
    await autoDismissOverlays(tabId, allDismissals);

    let succeeded = false;
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let res: any;
        switch (action.type) {
          case "click":
            res = await performClick(
              action.x ?? 0,
              action.y ?? 0,
              action.elementId,
              action.selector,
              action.proximityText,
            );
            break;
          case "type":
            res = await performType(action.text ?? "", action.selector, action.x, action.y, action.clearFirst ?? true, action.pressEnter ?? false);
            break;
          case "scroll":
            res = await performScroll(action.x ?? 760, action.y ?? 400, action.deltaY ?? 0);
            break;
          case "navigate":
            res = await performNavigate(action.url ?? "");
            break;
          case "hover":
            res = await performHover(action.x ?? 0, action.y ?? 0, action.elementId, action.selector);
            break;
          default:
            res = { error: `Unknown pipeline action type: ${action.type}` };
        }
        subResults.push({ type: action.type, success: true, result: res });
        succeeded = true;
        break;
      } catch (e: any) {
        lastError = e.message;
        if (attempt === 0) {
          const dismissed = await autoDismissOverlays(tabId, allDismissals);
          if (dismissed === 0) {
            break;
          }
          console.log(`[EXT] Pipeline step failed, dismissed ${dismissed} overlays, retrying...`);
          await waitForDOMSettled(tabId, 100, 1000);
        }
      }
    }

    if (!succeeded) {
      subResults.push({ type: action.type, success: false, error: lastError });
      break;
    }

    await waitForDOMSettled(tabId, 100, 2000);
  }

  let recoveryScreenshot: string | null = null;
  const hadFailure = subResults.some((r) => !r.success);
  if (hadFailure) {
    try {
      const screenshotUrl = await captureViewportScreenshot(tabId);
      recoveryScreenshot = screenshotUrl;
    } catch (e) {
      console.error("[EXT] Failed to capture recovery screenshot:", e);
    }
  }

  invalidateCapture();
  await performCapture(true);

  return { success: !hadFailure, results: subResults, recoveryScreenshot };
}
