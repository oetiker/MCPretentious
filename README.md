# MCPretentious - the Final iTerm MCP

[![npm version](https://badge.fury.io/js/mcpretentious.svg)](https://www.npmjs.com/package/mcpretentious)
[![Test Status](https://github.com/oetiker/MCPretentious/workflows/Test/badge.svg)](https://github.com/oetiker/MCPretentious/actions/workflows/test.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**The ultimate iTerm2 automation tool for LLM assistants.** MCPretentious enables your LLM to control multiple terminal windows, run commands, debug applications, and interact with command-line tools - all without disrupting your workflow.

<!-- LATEST-CHANGES-START -->
## 📋 Latest Release (v0.1.2 - 2025-08-24)

See CHANGELOG.md for details

For full changelog, see [CHANGELOG.md](CHANGELOG.md)
<!-- LATEST-CHANGES-END -->

## ⚡ High-Performance WebSocket Implementation

MCPretentious is the **only MCP implementation** that uses iTerm2's native WebSocket API with Protocol Buffers for lightning-fast terminal control - **20x faster than AppleScript-based solutions**. We reverse-engineered the Python API bindings to bring you direct WebSocket communication, providing instant feedback and real-time terminal interaction.

## 🎯 What Can Your LLM Do With This?

Once installed, your LLM assistant can:

- **Run commands and scripts** in iTerm2 terminals
- **Test and debug code** by executing it and reading output
- **Interact with TUI applications** like vim, htop, or database CLIs
- **Get real-time feedback from TUI apps** by reading the actual screen content with cursor position and colors
- **Manage multiple terminal sessions** simultaneously
- **Monitor long-running processes** checking on progess or logs
- **Automate complex terminal workflows** with special key support

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
- macOS (iTerm2 is Mac-only)
- [iTerm2](https://iterm2.com/) installed with Python API enabled
  - Go to iTerm2 → Preferences → General → Magic
  - Enable "Python API"
- Node.js 20 or higher

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
      "args": ["mcpretentious"]
    }
  }
}
```

#### For Claude Code

Simply run:
```bash
claude mcp add mcpretentious npx mcpretentious
```

#### For Cursor IDE

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcpretentious": {
      "command": "npx",
      "args": ["mcpretentious"]
    }
  }
}
```

## 💪 Why MCPretentious?

### The Problem with Other iTerm MCPs

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
✅ **Battle-Tested**: Comprehensive test suite with protocol validation and integration tests  
✅ **Security First**: Proper input validation and command escaping

## 🎮 What Your LLM Can Control

### Terminal Operations
- Open new terminal windows (without stealing focus!)
- Execute any command or script
- Send special keys (Ctrl+C, arrows, function keys, etc.)
- Read terminal output or just what's visible on screen
- Close terminals when done

### Supported Input Types
- Regular text and commands
- Special keys: Enter, Escape, Tab, Arrows, Ctrl+[A-Z], F1-F12
- ASCII codes for special characters (© ™ • etc.)
- Complex key combinations for TUI navigation

### Smart Features
- Preserves your current window focus
- Works with VS Code and other Electron apps
- Handles multiple terminals simultaneously
- Always reads the current screen viewport (not scrollback)
- Provides cursor position and color information for TUI apps

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

ISC

## 👤 Author

Tobias Oetiker <tobi@oetiker.ch>

## 🙏 Acknowledgments

- Built for the [Model Context Protocol](https://modelcontextprotocol.io/)
- Designed for [Claude Desktop](https://claude.LLM) and other MCP-compatible clients
- Inspired by [iTerm-Server-MCP](
