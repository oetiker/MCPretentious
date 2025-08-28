# MCPretentious - Universal Terminal MCP

[![npm version](https://badge.fury.io/js/mcpretentious.svg)](https://www.npmjs.com/package/mcpretentious)
[![Test Status](https://github.com/oetiker/MCPretentious/workflows/Test/badge.svg)](https://github.com/oetiker/MCPretentious/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**The ultimate terminal automation tool for LLM assistants.** MCPretentious enables your LLM to control multiple terminal windows across platforms - supporting both iTerm2 (macOS) and tmux (cross-platform). Run commands, debug applications, and interact with command-line tools on any system.

<!-- LATEST-CHANGES-START -->
## 📋 Latest Release (v1.2.0 - 2025-08-28)

### Changed
- **Redesigned mouse API to align with SGR protocol** - The `mcpretentious-mouse` tool now provides direct control over mouse events:
  - Changed from high-level actions (`click`, `drag`, `scroll`) to protocol-aligned events (`press`, `release`, `drag`)
  - Added support for named buttons (`left`, `middle`, `right`, `scrollUp`, `scrollDown`) and direct button codes (`button-0` through `button-127`)
  - Added keyboard modifier support (Shift, Alt, Ctrl) for all mouse events
  - Comprehensive in-tool documentation of all parameters and valid values
  - Mouse coordinates remain 0-based for developer convenience (converted to 1-based internally for SGR protocol)

For full changelog, see [CHANGELOG.md](CHANGELOG.md)
<!-- LATEST-CHANGES-END -->

## ⚡ Multi-Backend Support

MCPretentious supports two high-performance backends:

- **iTerm2 (macOS)**: Uses native WebSocket API with Protocol Buffers - **20x faster than AppleScript**
- **TMux (Cross-platform)**: Works on Linux, macOS, BSD, and even headless servers via tmux control mode

The backend is auto-detected, or you can specify your preference. Both backends provide the same API, ensuring your automations work everywhere.

## 🎯 What Can Your LLM Do With This?

Once installed, your LLM assistant can:

- **Run commands and scripts** in terminal windows (iTerm2 or tmux)
- **Test and debug code** by executing it and reading output
- **Interact with TUI applications** like vim, htop, or database CLIs
- **Control terminal apps with mouse** - click, drag, scroll in both iTerm2 and tmux
- **Get real-time feedback from TUI apps** by reading the actual screen content with cursor position and colors
- **Manage multiple terminal sessions** simultaneously
- **Monitor long-running processes** checking on progress or logs
- **Automate complex terminal workflows** with special key support
- **Work on remote servers** via SSH with tmux

### Example Prompts You Can Use:

- "Open a terminal and show me what Python version is installed"
- "Run my test suite and tell me which tests are fLLMling"
- "Start the development server and check if it's running properly"
- "Open vim and create a new config file with these settings"
- "Check what's using port 3000 and kill it"
- "Run this database migration and show me the output"

If the LLM doesn't get it, add that it should use MCPretentious to do it.

## 🚀 Quick Start

### Prerequisites

#### For iTerm2 Backend (macOS)
- macOS
- [iTerm2](https://iterm2.com/) installed with Python API enabled
  - Go to iTerm2 → Preferences → General → Magic
  - Enable "Python API"
- Node.js 20 or higher

#### For TMux Backend (Cross-platform)
- [tmux](https://github.com/tmux/tmux) installed (`brew install tmux`, `apt install tmux`, etc.)
- Node.js 20 or higher
- Works on Linux, macOS, BSD, WSL, and headless servers

### Installation

```bash
npm install -g mcpretentious
```

### Verify Installation

After installing, you can verify everything is working correctly:

```bash
npx mcpretentious-test
```

This will run a safe integration test that opens test terminals, runs some echo commands, and confirms MCPretentious can control iTerm2 on your system.

For detailed test output, use:
```bash
npx mcpretentious-test --verbose
```

### Configuration

#### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcpretentious": {
      "command": "npx",
      "args": ["mcpretentious"],
      "env": {
        "MCP_TERMINAL_BACKEND": "auto"  // Options: "auto", "iterm", "tmux", "api"
      }
    }
  }
}
```

#### For Claude Code

Simply run:
```bash
claude mcp add mcpretentious npx mcpretentious 
```

Or to specify a backend:
```bash
claude mcp add mcpretentious npx mcpretentious --backend=auto
```

#### For Cursor IDE

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcpretentious-tmux": {
      "command": "npx",
      "args": ["mcpretentious","--backend","tmux],
    }
  }
}
```

## 🌍 Backend Configuration

### Automatic Detection
By default, MCPretentious automatically detects the best available backend:
1. iTerm2 (if on macOS with iTerm2 installed)
2. TMux (if tmux is installed)

### Manual Configuration
Set the `MCP_TERMINAL_BACKEND` environment variable or use command-line options:
- `auto` - Automatic detection (default)
- `iterm` - Force iTerm2 backend
- `tmux` - Force tmux backend
- `api` - API mode: LLM selects backend per session

### API Mode
When started with `--backend=api` and multiple backends are available (both iTerm2 and tmux), the LLM can choose which backend to use for each new terminal session. This is useful when you want to:
- Use iTerm2 for local development with rich TUI support
- Use tmux for remote server sessions or persistent workflows
- Let the LLM decide based on the task at hand

In API mode, the `mcpretentious-open` tool gains an optional `backend` parameter.

### Backend Comparison

| Feature | iTerm2 | TMux |
|---------|--------|------|
| Platform | macOS only | Cross-platform |
| Performance | WebSocket (fastest) | Control mode (fast) |
| Colors | Full RGB | ANSI 256 |
| Styles | All attributes | Bold, italic, underline |
| Screenshots | Native | ANSI parsed |
| Mouse support | Full SGR protocol | Full SGR protocol |
| Focus management | Automatic | Terminal-dependent |
| Remote servers | No | Yes (via SSH) |
| Authentication | Cookie/key | Unix permissions |

## 💪 Why MCPretentious?

### The Problem with Other Terminal MCPs

Other implementations have critical limitations:
- Newly opened iTerms **steal focus** - disrupting your workflow
- They use **fake terminal names** - well intentioned for better security, but after restarting the MCP all these names are lost
- They **read scrollback buffer, not screen** - can only get lines from history and do not distinguish what is visible on screen, making TUI debugging impossible
- They have **limited test coverage** - basic unit tests at best
- They use **AppleScript** - much slower than native WebSocket

### MCPretentious Does It Right

✅ **WebSocket API**: The only MCP using iTerm2's native WebSocket protocol (reverse-engineered from Python bindings)  
✅ **No Focus Stealing**: Your LLM works in background terminals while you keep coding both for iTerm as well as VS Code and other Electron apps  
✅ **Real Terminal IDs**: Access ANY iTerm window or tab, not just the ones created from the MCP  
✅ **True Screen Reading**: See what's actually visible on screen, not just scrollback buffer (essential for TUI apps)  
✅ **Token-Optimized Screenshots**: Layered format reduces token usage by 85-98% with configurable data layers  
✅ **Battle-Tested**: Comprehensive test suite with protocol validation and integration tests  
✅ **Security First**: Proper input validation and command escaping

## 🎮 What Your LLM Can Control

### Terminal Operations
- Open new terminal windows (without stealing focus!)
- Execute any command or script
- Send special keys (Ctrl+C, arrows, function keys, etc.)
- Send mouse events (click, drag, scroll) for TUI interaction
- Read terminal output or just what's visible on screen
- Close terminals when done

### Supported Input Types
- Regular text and commands
- Special keys: Enter, Escape, Tab, Arrows, Ctrl+[A-Z], F1-F12
- Mouse events with SGR protocol:
  - Button events: left/middle/right click with press and release
  - Drag operations: movement with button held down
  - Scroll: wheel up/down events
  - Modifiers: Shift, Alt, Ctrl key combinations
  - Direct protocol access: button-0 through button-127
- ASCII codes for special characters (© ™ • etc.)
- Complex key combinations for TUI navigation

### Smart Features
- Preserves your current window focus
- Works with VS Code and other Electron apps
- Handles multiple terminals simultaneously
- Always reads the current screen viewport (not scrollback)
- Provides cursor position and color information for TUI apps

### Token-Optimized Screenshots
The `mcpretentious-screenshot` tool uses an innovative layered format that dramatically reduces token usage:
- **85% reduction** with minimal mode (text + cursor only)
- **98% reduction** when using viewport limiting (e.g., 5 lines around cursor)
- Choose only the data layers you need: text, cursor, colors, styles
- Smart viewport options: full screen, specific region, or around cursor
- Compact mode removes empty lines automatically

This means your LLM can inspect terminal screens without hitting token limits, even for complex TUI applications!

## ⚠️ Security Note

Your LLM gets full terminal access - it can run any command you could run. Be mindful when:
- Running commands from untrusted sources
- Providing system passwords
- Executing destructive operations

The server includes input validation and proper escaping, but the LLM's capabilities are intentionally unrestricted within the terminal context.

## 🔧 Troubleshooting

### macOS Permissions
If terminals aren't responding, check:
**System Preferences → Security & Privacy → Privacy → Automation**
- Ensure your app can control iTerm2

### Common Issues

**"Terminal not found"** - The terminal window was closed manually  
**"Commands not executing"** - LLM needs to send Enter key after commands  
**"Can't see TUI app correctly"** - Use `mcpretentious-screenshot` tool for full screen details with cursor and colors  

### Getting Help

Check your MCP client's logs - all errors are logged to stderr and captured there.

## 📚 For Developers

- [API Documentation](API.md) - Technical detLLMls for tool implementation
- [Changelog](CHANGELOG.md) - Version history and updates

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

## 👤 Author

Tobias Oetiker <tobi@oetiker.ch>

## 🙏 Acknowledgments

- Built for the [Model Context Protocol](https://modelcontextprotocol.io/)
- Designed for [Claude Desktop](https://claude.LLM) and other MCP-compatible clients
- Inspired by [iTerm-Server-MCP](https://github.com/rishabkoul/iTerm-MCP-Server)
