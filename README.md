<div align="center">

# 🌐 AgentBrowser

**AI-powered browser automation via MCP**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-8B5CF6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDIgMC04LTMuNTgtOC04czMuNTgtOCA4LTggOCAzLjU4IDggOC0zLjU4IDgtOCA4eiIvPjwvc3ZnPg==&logoColor=white)](https://modelcontextprotocol.io/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-F59E0B?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: ISC](https://img.shields.io/badge/License-ISC-10B981?style=for-the-badge)](https://opensource.org/licenses/ISC)

---

AgentBrowser is a Chrome extension + MCP server that lets AI agents see, understand, and interact with any web page in real-time. It captures live accessibility trees and screenshots via Chrome DevTools Protocol, then exposes a rich set of browser-control tools over the [Model Context Protocol](https://modelcontextprotocol.io/) — enabling any MCP-compatible AI (Claude, GPT, Gemini, etc.) to navigate, click, type, scroll, and automate the browser like a human would.

---

</div>

## ✨ Features

<table>
<tr>
<td width="50%">

### 🧠 Intelligent Page Understanding
- **Accessibility Tree Capture** — Parses the full AX tree via CDP, extracts interactive elements with bounding boxes, roles, states, and values
- **Live Screenshots** — Real-time JPEG viewport captures returned alongside structured data
- **Smart Tree Pruning** — Filters to visible viewport elements, deduplicates repeated nodes, and strips noise for compact payloads

</td>
<td width="50%">

### 🖱️ Full Browser Control
- **Click, Type, Scroll, Hover** — Pixel-precise interactions using CDP `Input.dispatch*` commands
- **Element Resolution** — Find elements by ID, name, CSS selector, or proximity-based disambiguation
- **Navigation Suite** — Navigate to URLs, go back/forward, refresh, manage tabs (list, switch, close)

</td>
</tr>
<tr>
<td width="50%">

### ⚡ Action Pipeline
- **Batched Execution** — Chain multiple actions (click → type → click) in a single round-trip for dramatically faster multi-step flows
- **Auto-Dismiss Overlays** — Automatically handle popups, cookie banners, and modals during pipeline execution
- **Recovery Screenshots** — On failure, captures a screenshot at the point of error for AI diagnosis

</td>
<td width="50%">

### 🔌 MCP Integration
- **21 MCP Tools** — Complete browser automation toolkit exposed via the Model Context Protocol
- **Stdio Transport** — Standard MCP server communication over stdin/stdout
- **WebSocket Bridge** — Real-time bidirectional communication between the MCP server and Chrome extension
- **Works with Any MCP Client** — Claude Desktop, Cursor, Cline, or your own custom client

</td>
</tr>
<tr>
<td width="50%">

### 🔄 Real-Time State Sync
- **Post-Action Auto-Capture** — Every state-changing action automatically returns fresh page state
- **Mutation Observer** — Detects DOM changes and triggers re-capture
- **Heartbeat Keep-Alive** — Persistent WebSocket connection with automatic reconnection

</td>
<td width="50%">

### 🛡️ Robust Architecture
- **Chrome Manifest V3** — Modern service worker-based extension architecture
- **CDP Integration** — Direct Chrome DevTools Protocol access for reliable, low-level control
- **Cross-Platform Clipboard** — Native clipboard operations on Windows, macOS, and Linux
- **Configurable Agent Instructions** — Custom `.agent/` directory for browser behavior rules and tool documentation

</td>
</tr>
</table>

---

## 🛠️ MCP Tools

AgentBrowser exposes **21 tools** to AI agents via MCP:

| Category | Tools | Description |
|:---|:---|:---|
| 📸 **Page State** | `get_page_state`, `capture_page` | Screenshot + accessibility tree of the current viewport |
| 🖱️ **Interaction** | `click_element`, `click_at_coords`, `type_text`, `hover_element`, `scroll_page` | Click, type, hover, and scroll on the page |
| 🔍 **Query** | `find_element`, `get_text`, `get_url` | Find elements in the tree, extract text content, get current URL |
| 🧭 **Navigation** | `navigate`, `refresh`, `go_back`, `go_forward` | URL navigation and browser history |
| 📑 **Tabs** | `tab_list`, `tab_switch`, `tab_close` | Multi-tab management |
| 📋 **Clipboard** | `clipboard_copy`, `clipboard_paste` | Cross-platform native clipboard operations |
| 🚀 **Pipeline** | `execute_pipeline` | Batch multiple actions in a single round-trip |
| 🧹 **Overlays** | `dismiss_active_overlays` | Auto-dismiss popups, modals, and banners |

---

## 🏗️ Architecture

```
┌──────────────────┐       WebSocket (3001)       ┌──────────────────┐
│                  │◄────────────────────────────► │                  │
│  Chrome Extension│                               │   MCP Server     │
│  (Manifest V3)   │   Screenshots + AX Tree       │   (Node.js)      │
│                  │──────────────────────────────►│                  │
│  • Service Worker│                               │  • 21 MCP Tools  │
│  • CDP Bridge    │   Actions (click/type/scroll)  │  • Stdio Transport│
│  • A11y Capture  │◄──────────────────────────────│  • State Manager │
│  • Popup UI      │                               │                  │
└──────────────────┘                               └────────┬─────────┘
                                                            │ stdio
                                                   ┌────────▼─────────┐
                                                   │   MCP Client     │
                                                   │ (Claude, Cursor, │
                                                   │  Cline, etc.)    │
                                                   └──────────────────┘
```

---

## 📁 Project Structure

```
AgentBrowser/
├── src/
│   ├── background/          # Service worker & CDP logic
│   │   ├── serviceWorker.ts # WebSocket client, action dispatcher
│   │   ├── a11y.ts          # Accessibility tree capture & processing
│   │   ├── actions.ts       # Browser action implementations
│   │   ├── capture.ts       # Screenshot & page state capture
│   │   ├── cdp-helpers.ts   # Chrome DevTools Protocol utilities
│   │   ├── constants.ts     # Configuration constants
│   │   └── state.ts         # Extension state management
│   ├── popup/               # Extension popup UI
│   │   ├── index.html       # Popup markup
│   │   ├── popup.css        # Popup styles
│   │   ├── popup.ts         # Popup logic & status display
│   │   └── assets/          # Icons & images
│   └── types/               # TypeScript type definitions
├── mcp-server/              # MCP server (Node.js)
│   ├── index.ts             # Server entry point, WebSocket + MCP setup
│   └── tools/               # 21 individual MCP tool implementations
├── .agent/                  # Agent configuration
│   ├── browser-instructions.md  # AI agent behavioral rules
│   └── tools-documentation.md   # Tool usage documentation
├── manifest.json            # Chrome Extension Manifest V3
├── vite.config.ts           # Vite + CRXJS build config
└── package.json             # Extension dependencies
```

---

## ⚙️ Setup & Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Google Chrome](https://www.google.com/chrome/) browser
- An MCP-compatible IDE or AI client (see [Step 3](#step-3-connect-to-your-ide))

---

### Step 1 — Install the Chrome Extension

```bash
# Clone the repository
git clone https://github.com/towfeeqkhan/AgentBrowser.git
cd AgentBrowser

# Install dependencies and build
npm install
npm run build
```

Then load it into Chrome:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Navigate into the `AgentBrowser` folder and select the **`dist`** folder
5. The extension is now loaded — click the **Extensions** icon (puzzle piece) in Chrome's toolbar, then click **AgentBrowser**

> [!NOTE]
> The popup will show **"Disconnected"** status. This is expected — the MCP server isn't running yet.

---

### Step 2 — Build the MCP Server

```bash
# From the AgentBrowser root directory
cd mcp-server

# Install dependencies and compile TypeScript
npm install
npx tsc
```

After compilation, note the path to the built entry point:

```
<your-path>/AgentBrowser/mcp-server/dist/index.js
```

For example:

```
C:\Users\hp\Desktop\AgentBrowser\mcp-server\dist\index.js
```

> [!WARNING]
> **Windows users:** JSON config files require **double backslashes** (`\\`) since `\` is an escape character in JSON.
> For example: `"C:\\Users\\hp\\Desktop\\AgentBrowser\\mcp-server\\dist\\index.js"`

---

### Step 3 — Connect to Your IDE

Choose your IDE below and follow the configuration steps.

<details>
<summary><strong>🟣 GitHub Copilot (VS Code)</strong></summary>

<br>

**Option A — User Settings (global)**

1. Press `Ctrl + Shift + P` → type **"Open User Settings (JSON)"** → select it
2. Add the following to your `settings.json`:

```json
"github.copilot.chat.mcp.servers": {
  "agent-browser": {
    "command": "node",
    "args": [
      "C:\\Users\\hp\\Desktop\\AgentBrowser\\mcp-server\\dist\\index.js"
    ]
  }
}
```

**Option B — Workspace Config (project-scoped)**

Create a `.vscode/mcp.json` file in your workspace root:

```json
{
  "servers": {
    "agent-browser": {
      "command": "node",
      "args": [
        "C:\\Users\\hp\\Desktop\\AgentBrowser\\mcp-server\\dist\\index.js"
      ]
    }
  }
}
```

**Verify:** Open Copilot Chat (`Ctrl + Alt + I`) → click the **Tools** icon (plug/MCP icon) → confirm `agent-browser` is listed and enabled.

</details>

<details>
<summary><strong>🔵 Cursor</strong></summary>

<br>

1. Press `Ctrl + Shift + J` to open **Cursor Settings** (or go to `File → Preferences → Cursor Settings`)
2. In the left sidebar, click **MCP** → click **"Add new global MCP server"**
3. This opens `~/.cursor/mcp.json` — add your server config:

```json
{
  "mcpServers": {
    "agent-browser": {
      "command": "node",
      "args": [
        "C:\\Users\\hp\\Desktop\\AgentBrowser\\mcp-server\\dist\\index.js"
      ]
    }
  }
}
```

4. Save the file and **restart Cursor**

**Verify:** Go to `Settings → MCP` and confirm your server shows a **green active indicator**.

</details>

<details>
<summary><strong>🟠 Claude Code</strong></summary>

<br>

**Option A — CLI command (quick setup)**

```bash
claude mcp add agent-browser node "C:\Users\hp\Desktop\AgentBrowser\mcp-server\dist\index.js"
```

**Option B — Edit config file directly**

Open `~/.claude/claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "agent-browser": {
      "command": "node",
      "args": [
        "C:\\Users\\hp\\Desktop\\AgentBrowser\\mcp-server\\dist\\index.js"
      ]
    }
  }
}
```

**Verify:** Run `claude mcp list` to confirm the server is registered. Start Claude Code — your MCP tools will be available in sessions.

</details>

<details>
<summary><strong>🟢 Antigravity IDE</strong></summary>

<br>

1. Open **Settings → AI / MCP** (or `Preferences → MCP Servers`)
2. Click **"Edit MCP Config"**, or manually open the config file at:
   ```
   %APPDATA%\Antigravity\mcp.json
   ```
3. Add the following:

```json
{
  "mcpServers": {
    "agent-browser": {
      "command": "node",
      "args": [
        "C:\\Users\\hp\\Desktop\\AgentBrowser\\mcp-server\\dist\\index.js"
      ]
    }
  }
}
```

4. Save and **restart Antigravity IDE**

**Verify:** Navigate to the MCP servers panel to confirm `agent-browser` appears as connected.

</details>

> [!IMPORTANT]
> Replace the path in all examples above with your **actual path** to `AgentBrowser/mcp-server/dist/index.js`.

---

### Step 4 — Verify the Connection

Once your IDE is configured and the MCP server is running:

1. Open the **AgentBrowser** extension popup in Chrome
2. The status should now show **"Connected"** ✅
3. You're ready to go!

---

## 🚀 Usage

With Chrome open and the extension connected, ask your AI agent to use the `agent-browser` MCP tools. Here's an example prompt to get started:

> **Example Prompt:**
>
> *Use the agent-browser MCP tool to open the following GitHub repository and provide a detailed summary: https://github.com/towfeeqkhan/AgentBrowser*
>
> *The summary should include:*
> 1. *What it is — A clear explanation of the project*
> 2. *Its features — The key functionalities it offers*
> 3. *Who built it — The creator of the project*
> 4. *How to use it — A step-by-step guide on getting started*

> [!TIP]
> Make sure **Google Chrome is open** before sending browser automation prompts to your AI agent.

---

## 👤 Author

**Towfeeq Khan**

[![GitHub](https://img.shields.io/badge/GitHub-towfeeqkhan-181717?style=flat-square&logo=github)](https://github.com/towfeeqkhan)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-towfeeqkhan-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/towfeeqkhan)

---

<div align="center">

**Built with ❤️ by [Towfeeq Khan](https://github.com/towfeeqkhan)**

</div>
