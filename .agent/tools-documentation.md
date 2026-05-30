# Browser Control — Tools Documentation

Complete catalog of MCP tools available to control and interact with the browser.

---

## 1. State & Discovery Tools

* **`get_page_state`**: Retrieves the current **viewport** screenshot and accessibility tree. **IMPORTANT: The page extends BELOW what you see.** The tree only contains visible elements — content below the fold, inside collapsed sections, or in non-visible tab panels is NOT included until you scroll there or expand them. Always scroll down and re-capture to discover more of the page.
  * **`compact`** (optional): Set to `true` to prune the tree payload (saving 50-70% of tokens) — drops box dimensions, keeps only center coordinates, merges duplicate names.
  * **Cache behaviour**: The extension proactively streams fresh page state on DOM mutations, scroll, resize, focus, and via a 3-second heartbeat timer. If the cached state is less than 4 seconds old, `get_page_state` returns it instantly. Otherwise it waits for a fresh capture. **Most interaction tools now return fresh page state inline** — you rarely need a separate `get_page_state` call after an action.
* **`capture_page`**: Forces a fresh capture of the current page and waits for the updated state to arrive before returning. Call `get_page_state` after this to read the freshly captured data (this is one of the few tools that does NOT return state inline).
* **`find_element`**: Searches the element tree by name and returns coordinate matches to help target interactions.
* **`get_url`**: Returns the current active page URL.
* **`get_text`**: Extracts inner text/textContent from a targeted element. Supports targeting by CSS selector (`selector`), accessibility name (`name`), element ID (`elementId` - string or number), or pixel coordinates (`x`, `y`).

---

## 2. Interaction Tools

**All interaction tools return the fresh page state (screenshot + compact tree) in their response.** After any click, type, scroll, navigate, or hover — you ALREADY have the updated page. No separate `get_page_state` call needed.

* **`click_element`**: Clicks a target element. Resolves coordinates by name, elementId, CSS selector, or raw x/y. **If your target is not in the current tree, SCROLL FIRST — do not navigate away or construct URLs.** The element is likely below the fold.
  * **`proximityText`** (optional): Nearby element's text to disambiguate identical names (e.g. product title near "Add to cart").
  * Automatically scrolls the element into view and recalculates coordinates before clicking.
  * For `<a>` links: always click them instead of copying the href and calling `navigate`. Clicking preserves session/cookies/referrers.
  * Returns: Fresh screenshot + tree after the click completes (including any navigation).
* **`click_at_coords`**: Clicks at exact pixel coordinates `(x, y)` on the screen. Best used when an element is visible in the screenshot but missing or unresolvable in the tree. Returns fresh page state.
* **`hover_element`**: Hovers the mouse cursor over an element. Resolves coordinates via precise `elementId` match, name matching, CSS `selector` matching, or accepts raw `(x, y)` coordinates.
  * **`proximityText`** (optional): A nearby element's text used to disambiguate identical-name elements.
  * Automatically scrolls the element into the center of the viewport and recalculates coordinates.
  * Returns: Fresh screenshot + tree after the hover.
* **`type_text`**: Types specified text into the focused/active element or a targeted element. Accepts `selector`, `name`, `elementId` (string or number), or coordinates `(x, y)`. If target parameters are provided, it will automatically click or focus the targeted input before typing — no separate `click_element` call needed.
  * **`proximityText`** (optional): A nearby element's text used to disambiguate identical-name textboxes.
  * **`clearFirst`** (default: `true`): Automatically clears existing text before typing. Set `clearFirst: false` to append instead.
  * **`pressEnter`** (optional): Set to `true` to press Enter after typing — fires both DOM and CDP key events for reliable form submission. Saves an entire separate interaction step.
  * Returns: Fresh screenshot + tree after typing completes.
* **`scroll_page`**: Scrolls the page by a pixel delta (positive = down, negative = up). **Always scroll down to discover content below the fold before concluding an element is missing.** Typical viewport is ~800-1000px tall — use `deltaY: 800` to reveal the next screenful. The response already includes the fresh page state from the new scroll position.
* **`skipDomWait` parameter** (available on `click_element`, `type_text`, `navigate`, `refresh`, `go_back`, `go_forward`, and `execute_pipeline`): Set `skipDomWait: true` to skip the automatic DOM/network settling wait after the action. Use when: (a) you're seeing false-positive "execution timeout" errors from slow background scripts/analytics, (b) you're on a fast page where DOM is stable immediately after interaction, or (c) you're chaining rapid actions and don't need DOM confirmation between them. The action still captures and returns fresh page state — only the MutationObserver-based settling wait is skipped.
* **`execute_pipeline`** ⚡: Executes a **sequence of actions in a single round-trip** to the browser extension. Use whenever you need to perform 2+ actions without needing to inspect state between them. Up to **70% faster** than individual tool calls. Returns fresh page state inline after all actions complete.
  * `actions`: an ordered array of action objects. Each object has a `type` field and the relevant parameters:
    * `{ type: "click", name?: string, elementId?: string|number, selector?: string, x?: number, y?: number, proximityText?: string }` — clicks an element
    * `{ type: "type", text: string, clearFirst?: boolean, pressEnter?: boolean, name?: string, elementId?: string|number, selector?: string, x?: number, y?: number, proximityText?: string }` — types text (clears first by default, supports auto-submission)
    * `{ type: "scroll", deltaY: number, x?: number, y?: number }` — scrolls the page
    * `{ type: "navigate", url: string }` — navigates to a URL
    * `{ type: "hover", name?: string, elementId?: string|number, selector?: string, x?: number, y?: number, proximityText?: string }` — hovers over an element
  * **`autoDismiss`** (optional): A list of overlay dismiss actions `{ selector: string, action: "click" | "remove" }` checked proactively before each action and on failure.
  * **Example** — search workflow in one call:
    ```json
    {
      "actions": [
        { "type": "click",  "name": "Search" },
        { "type": "type",   "text": "Atif Aslam best song" },
        { "type": "click",  "name": "Search Submit" }
      ]
    }
    ```
  * Stops on the first failed action and returns a per-step result summary.
  * **Auto-recovery on failure**: If any step fails, the pipeline captures a recovery screenshot and returns it alongside the error details.
  * Returns: Fresh screenshot + tree after all actions complete (or recovery screenshot on failure).

---

## 3. Navigation Tools

* **`navigate`**: Goes to a specific URL. **ONLY use for: (a) a URL the user explicitly asked for, (b) starting on a new domain the user specified, (c) returning to the homepage. Do NOT construct, guess, or invent URLs.** If you need to reach another page, find and CLICK the actual link/button on the current page. Returns fresh page state after navigation + page load.
* **`refresh`**: Reloads the current page and waits for page load to complete. Returns fresh page state.
* **`go_back`**: Navigates back to the previous page in history and waits for page load to complete. Returns fresh page state.
* **`go_forward`**: Navigates forward to the next page in history and waits for page load to complete. Returns fresh page state.

---

## 4. Clipboard Tools (Host OS Sync)

* **`clipboard_copy`**: Extracts text from a page element AND copies it directly to your **host operating system clipboard**. Bypasses browser sandbox restrictions. Supports three targeting modes:
  * **Direct text**: Pass `text: "your string"` to copy a known value.
  * **From page element**: Pass `selector`, `name`, `elementId`, or `x`/`y` to extract text from the page first.
  * Always echoes back the full copied text for verification.
* **`clipboard_paste`**: Reads the current **host OS clipboard** and types its content into the focused page element. Supports `selector`, `x`, `y` to target a specific input.

---

## 5. Tab & Window Management

* **`tab_list`**: Lists all open browser tabs with their IDs, URLs, and titles.
* **`tab_switch`**: Switches focus to a specific tab by its numeric `tabId` (from `tab_list`).
* **`tab_close`**: Closes a specific tab by its numeric `tabId` (from `tab_list`).

---

## 6. Overlay & Popup Dismissal

* **`dismiss_active_overlays`**: ⚠️ **THIS IS YOUR FIRST TOOL when any popup, modal, overlay, dialog, lightbox, or cookie banner appears on screen.** Do NOT try to click close buttons with `click_element` — use this tool instead.
  * Sends an Escape key (closes focus-trap dialogs natively) then removes ALL visible overlay containers from the DOM. Since it removes elements directly rather than clicking close buttons, it cannot toggle or accidentally open new overlays.
  * **Returns fresh page state inline** — the response already includes the unobstructed screenshot + tree. No separate `get_page_state` call needed.
  * **Speed tip**: Call `dismiss_active_overlays` before starting any page interaction — it clears the viewport upfront so every subsequent tool call hits real page elements.
  * **If overlays re-appear**: Some sites re-spawn overlays on scroll or interaction. Call `dismiss_active_overlays` again — it's cheap and idempotent.
  * **Pipeline integration**: The `execute_pipeline` tool also supports `autoDismiss` for per-action overlay removal during multi-step flows.
