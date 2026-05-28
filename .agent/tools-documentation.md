# Browser Control — Tools Documentation

Complete catalog of MCP tools available to control and interact with the browser.

---

## 1. State & Discovery Tools

* **`get_page_state`**: Retrieves the current **viewport** screenshot and accessibility tree. **IMPORTANT: The page extends BELOW what you see.** The tree only contains visible elements — content below the fold, inside collapsed sections, or in non-visible tab panels is NOT included until you scroll there or expand them. Always scroll down and re-capture to discover more of the page.
  * **`compact`** (optional): Set to `true` to prune the tree payload (saving 50-70% of tokens) — drops box dimensions, keeps only center coordinates, merges duplicate names.
  * **Cache behaviour**: The extension **proactively streams** fresh page state on **DOM mutations, scroll, resize, focus**, and via a **3-second heartbeat timer**. This means the MCP server nearly always has a hot cache. If the cached state is less than 4 seconds old, `get_page_state` returns it **instantly in 0ms**. If the cache is stale, it **waits for a fresh capture** before responding — you are guaranteed up-to-date data. The extension also uses **tree diffing**: if the element tree hasn't changed, only the screenshot is re-sent, saving bandwidth.
* **`capture_page`**: Forces a fresh capture of the current page and **waits for the updated state** to arrive before returning. Call `get_page_state` after this to read the freshly captured data.
* **`find_element`**: Searches the element tree by name and returns coordinate matches to help target interactions.
* **`get_url`**: Returns the current active page URL.
* **`get_text`**: Extracts inner text/textContent from a targeted element. Supports targeting by CSS selector (`selector`), accessibility name (`name`), element ID (`elementId` - string or number), or pixel coordinates (`x`, `y`). If `elementId` is specified, it will perform a precise, strict direct match.

---

## 2. Interaction Tools

* **`click_element`**: Clicks a target element. Resolves coordinates by name, elementId, CSS selector, or raw x/y. **If your target is not in the current tree, SCROLL FIRST — do not navigate away or construct URLs.** The element is likely below the fold.
  * **`proximityText`** (optional): Nearby element's text to disambiguate identical names (e.g. product title near "Add to cart").
  * Automatically scrolls the element into view and recalculates coordinates before clicking.
  * For `<a>` links: always click them instead of copying the href and calling `navigate`. Clicking preserves session/cookies/referrers.
* **`click_at_coords`**: Clicks at exact pixel coordinates `(x, y)` on the screen. Best used when an element is visible in the screenshot but missing or unresolvable in the tree.
* **`hover_element`**: Hovers the mouse cursor over an element. Resolves coordinates via precise `elementId` match, name matching, CSS `selector` matching, or accepts raw `(x, y)` coordinates.
  * **`proximityText`** (optional): A nearby element's text used to disambiguate identical-name elements (e.g. product title near a specific hover target).
  * **Note**: The tool **automatically scrolls the element into the center of the viewport** and recalculates coordinates before hovering.
* **`type_text`**: Types specified text into the focused/active element or a targeted element. Accepts `selector`, `name`, `elementId` (string or number), or coordinates `(x, y)`. **Note**: If target parameters are provided, it will automatically click or focus the targeted input before typing, so you do *not* need to call `click_element` first.
  * **`proximityText`** (optional): A nearby element's text used to disambiguate identical-name textboxes (e.g. field labels).
  * **`clearFirst`** (default: `true`): Automatically clears existing text in the field before typing new text (via safe, programmatic DOM clearing and input/change events to prevent browser window-level focus hijacking). Set `clearFirst: false` to append instead of replacing.
  * **`pressEnter`** (optional): Set to `true` to programmatically press the Enter key immediately after typing the text. Fires both a DOM-level `KeyboardEvent` (enter keydown/keypress/keyup) and a native CDP raw keyboard dispatch for bulletproof form auto-submission. Saves an entire separate interaction step.
* **`scroll_page`**: Scrolls the page by a pixel delta (positive = down, negative = up). **Always scroll down to discover content below the fold before concluding an element is missing.** Typical viewport is ~800-1000px tall — use `deltaY: 800` to reveal the next screenful, then `get_page_state` to see the new area.
* **`skipDomWait` parameter** (available on `click_element`, `type_text`, `navigate`, `refresh`, `go_back`, `go_forward`, and `execute_pipeline`): Set `skipDomWait: true` to skip the automatic DOM/network settling wait after the action. Use this when: (a) you're seeing false-positive "execution timeout" errors from slow background scripts/analytics, (b) you're on a fast page where DOM is stable immediately after interaction, or (c) you're chaining rapid actions and don't need DOM confirmation between them. **The action still captures fresh page state at the end** — only the MutationObserver-based settling wait is skipped.
* **`execute_pipeline`** ⚡: Executes a **sequence of actions in a single round-trip** to the browser extension. Use this whenever you need to perform 2+ actions on the same page without needing to inspect state between them. Up to **70% faster** than calling each tool individually.
  * `actions`: an ordered array of action objects. Each object has a `type` field and the relevant parameters for that action type:
    * `{ type: "click", name?: string, elementId?: string|number, selector?: string, x?: number, y?: number, proximityText?: string }` — clicks an element (resolves `name`/`elementId`/`selector` → coordinates automatically, supports proximity)
    * `{ type: "type", text: string, clearFirst?: boolean, pressEnter?: boolean, name?: string, elementId?: string|number, selector?: string, x?: number, y?: number, proximityText?: string }` — types text into an element (clears first by default, supports proximity and auto-submission)
    * `{ type: "scroll", deltaY: number, x?: number, y?: number }` — scrolls the page
    * `{ type: "navigate", url: string }` — navigates to a URL
    * `{ type: "hover", name?: string, elementId?: string|number, selector?: string, x?: number, y?: number, proximityText?: string }` — hovers over an element (supports proximity)
  * **`autoDismiss`** (optional): A list of overlay dismiss actions `{ selector: string, action: "click" | "remove" }` checked proactively before each action and on failure. If matched, it dismisses cookie prompts, overlays, or popups and automatically retries the action. The extension also includes aggressive built-in heuristics that handle standard cookie banners and popup closes automatically.
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
  * The pipeline stops on the first failed action and returns a per-step result summary.
  * **Auto-recovery on failure**: If any step fails, the pipeline automatically captures a **recovery screenshot** and returns it alongside the error details — so you can instantly see what went wrong (e.g. an overlay popup, validation error) without needing to call `get_page_state` separately.
  * A single fresh page capture is done automatically at the end — call `get_page_state` afterwards to see the result.

---

## 3. Navigation Tools

* **`navigate`**: Goes to a specific URL. **ONLY use this for: (a) a URL the user explicitly asked for, (b) starting on a new domain the user specified, (c) returning to the homepage. Do NOT construct, guess, or invent URLs.** If you need to reach another page, find and CLICK the actual link/button on the current page instead. The page likely continues below what you see — scroll first.
* **`refresh`**: Reloads the current page and automatically waits for the page load to complete.
* **`go_back`**: Navigates back to the previous page in history and automatically waits for the page load to complete.
* **`go_forward`**: Navigates forward to the next page in history and automatically waits for the page load to complete.

---

## 4. Clipboard Tools (Host OS Sync)

* **`clipboard_copy`**: Extracts text from a page element AND copies it directly to your **host operating system clipboard**. This bypasses browser sandbox restrictions that prevent "Copy to clipboard" buttons from working in automated Chromium. Supports three targeting modes:
  * **Direct text**: Pass `text: "your string"` to copy a known value without any page interaction.
  * **From page element**: Pass `selector`, `name`, `elementId`, or `x`/`y` to extract text from the page first, then copy.
  * **Confirmation**: Always echoes back the full copied text so you can verify it.
* **`clipboard_paste`**: Reads the current **host OS clipboard** and types its content into the focused page element. Supports `selector`, `x`, `y` to target a specific input. Perfect after using `clipboard_copy` on one page and pasting into another.

---

## 5. Tab & Window Management

* **`tab_list`**: Lists all open browser tabs with their IDs, URLs, and titles. Essential when links open in new windows — use this to discover and switch to background tabs.
* **`tab_switch`**: Switches focus to a specific tab by its numeric `tabId` (from `tab_list`).
* **`tab_close`**: Closes a specific tab by its numeric `tabId` (from `tab_list`).
