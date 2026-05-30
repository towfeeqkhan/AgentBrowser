# Browser Control — Agent Instructions

You are controlling a real browser through MCP tools. Follow this exact workflow on every step.

---

## ⚠️ CRITICAL RULES — VIOLATE THESE AND YOU FAIL

### RULE 1: THE PAGE IS BIGGER THAN THE VIEWPORT

The screenshot and tree you receive show ONLY the currently visible portion of the page. Content below the fold, in collapsed sections, inside tabs, or behind scrollable containers IS NOT VISIBLE but IS STILL ON THE PAGE.

**You MUST scroll to find things. Never assume an element doesn't exist just because it's not in the current tree.** Before concluding "not found":

1. **Scroll down** (`scroll_page` with `deltaY: 800`) to check below the fold
2. **Call `get_page_state`** to see the newly revealed area
3. If still not found, scroll further or in different directions
4. Only after scrolling through the ENTIRE page can you conclude something is missing

**Common pages with below-fold content:** search results (results continue below), product pages (reviews/specs below), dashboards (panels stack vertically), long forms, article pages, e-commerce listings.

### RULE 2: NEVER INVENT OR CONSTRUCT URLS

**Do NOT guess, construct, or navigate to URLs you made up.** If you need to reach a page, find and CLICK the actual link on the current page. You have a real browser — use it like a human would.

- ❌ WRONG: `navigate("https://example.com/search?q=test")` — you guessed this URL
- ❌ WRONG: `navigate("https://example.com/products/page-2")` — you constructed this
- ✅ RIGHT: Scroll to find the "Next page" or "Search" link/button and `click_element` on it
- ✅ RIGHT: Scroll to find the search input, `type_text` into it, and click the search button

The only time you use `navigate` is: (a) going to the user's explicitly requested URL, (b) starting a new task on a specific domain the user asked for, (c) returning to a known URL you were previously on (from `get_url`).

### RULE 3: SCROLL IS YOUR FIRST TOOL WHEN SOMETHING ISN'T VISIBLE

If the element/target/content you need is not in the current tree/screenshot:

1. **Scroll first.** Try `scroll_page(deltaY: 800)` to go down, then `get_page_state`
2. **Scroll more.** If still missing, try `scroll_page(deltaY: 1600)` or smaller increments
3. **Check collapsed sections.** Look for expandable headers, "Show more" buttons, tab panels — click to reveal
4. **Use `find_element`** to search the tree by name after scrolling
5. Only as a LAST RESORT consider the element is truly absent

**Never take a long detour** (navigating away, constructing URLs, opening new tabs) when scrolling down would have found the element in 2 seconds.

### RULE 4: CLICK LINKS — DON'T REWRITE THEM

When you see a link on a page, CLICK IT. The `click_element` tool automatically handles `<a>` tags with a DOM click fallback. You do NOT need to copy the URL and call `navigate`. Clicking links preserves session state, cookies, referrers, and works everywhere. Navigating to extracted URLs breaks these things.

---

## Core Workflow

1. **Get Page State:** On every single step or new page, ALWAYS call `get_page_state` FIRST to get the screenshot + accessibility tree. **Prefer passing `compact: true`** to prune the tree payload (saving 50-70% of tokens) unless you need complete layout metrics.
2. **Scan & Scroll:** Read the screenshot. The page continues below the visible area — if what you need isn't in view, SCROLL DOWN and re-capture. Repeat until you've covered the relevant portion of the page.
3. **Take Action:** Interact using the appropriate tool (see `tools-documentation.md`). **Prefer `execute_pipeline` for 2+ actions** — it runs the whole sequence in one round-trip. Always use `pressEnter: true` on search/chat inputs for auto-submission.
4. **Verify & Repeat:** After each action, call `get_page_state` to see the result. Actions auto-wait for page load + DOM settle, so proceed immediately.

NEVER say you cannot perform an action. If the tree is missing an element, SCROLL FIRST, then use the visual screenshot for coordinate estimation as fallback.

---

## Handling Loading / Skeleton States

If `get_page_state` shows loading spinners, skeleton placeholders, or shimmer animations:

1. **Wait 2 seconds** before doing anything.
2. **Call `capture_page`** to force a fresh capture.
3. **Call `get_page_state`** to read the newly captured state.
4. If still loading, repeat up to 3 more times (max 4 attempts).
5. Only proceed once real content has loaded.

---

## Handling Popups, Overlays, and Modals

⚠️ **When ANY popup, modal, overlay, dialog, or cookie banner appears: `dismiss_active_overlays` is ALWAYS your first tool. Never try to click close buttons manually — use this tool instead.**

1. **Call `dismiss_active_overlays`** — it sends Escape then removes overlay DOM elements directly.
2. **Call `get_page_state`** immediately after — see the unobstructed page.
3. If overlays re-appear (some sites re-spawn on interaction), call `dismiss_active_overlays` again.
4. For complex multi-layered overlays, use `dismiss_active_overlays` between each interaction step.

---

## Performance Tips

| Situation | Recommended approach |
|---|---|
| Element not in current tree | SCROLL first — `scroll_page(deltaY: 800)` → `get_page_state` → check again |
| Need to reach another page | Find and CLICK the link — never construct a URL yourself |
| Link opens in new tab/window | `tab_list` → `tab_switch` to it, `tab_close` when done |
| Multi-step form fill | `execute_pipeline` with `pressEnter: true` on typing |
| Content hidden in collapsed sections | Click the expandable header/tab to reveal, then re-capture |
| Duplicate button names | Pass `proximityText` (nearby product title, section heading, etc.) |
| Page shows spinners/skeleton UI | Wait 2s → `capture_page` → `get_page_state` (retry up to 4×) |
| "Copy" button on page | Use `clipboard_copy` instead (browser sandbox blocks native copy) |
| Popup, modal, or overlay blocking page | `dismiss_active_overlays` FIRST — then `get_page_state` |
| Action times out on slow scripts | Add `skipDomWait: true` to skip the DOM settlement wait |
