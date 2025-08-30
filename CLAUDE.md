# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCPretentious is a universal terminal MCP - a Model Context Protocol server that enables AI assistants to control terminals across platforms. It supports tmux (cross-platform - Linux, macOS, BSD, remote servers) via control mode, and iTerm2 (macOS) via high-performance WebSocket API with Protocol Buffers (20x faster than AppleScript-based iTerm2 solutions, with no focus stealing). Both backends provide real terminal addressing and proper TUI screen content reading with cursor position and color information.

## Development Commands

```bash
# Install dependencies
npm install

# Run the server locally
npm start
# or
node mcpretentious.js

# Link for local development
npm link

# Run tests
npm test
npm run test:integration  # Integration tests with real iTerm2
npm run test:all         # All tests
```

## Architecture

The project is a modular MCP server with `mcpretentious.js` as the main entry point that:
- Supports multiple backends: tmux (control mode) and iTerm2 (WebSocket API with Protocol Buffers)
- Implements the MCP protocol using `@modelcontextprotocol/sdk`
- Provides terminal control with session tracking for window management
- Terminal IDs follow format: `iterm-{windowId}-{tabIndex}` (iTerm2) or `tmux-{sessionName}` (tmux)
- Includes utility libraries for terminal operations, color handling, and focus management
- Auto-detects available backend or allows manual selection

## Key Implementation Details

### Backend Integration
- **iTerm2**: Native WebSocket API using Protocol Buffers, 20x faster than AppleScript
  - Authentication via iTerm2's Python API (must be enabled in Preferences)
  - Focus restoration logic handles VS Code and other Electron apps specially
- **TMux**: Control mode for cross-platform support
  - Works on Linux, macOS, BSD, and remote servers via SSH
  - Unix permission-based authentication

### Terminal Input System
The `mcpretentious-type` tool is the universal input method that handles:
- Text strings with proper escaping for each backend
- ASCII codes (0-255)
- Special keys via escape sequences (stored in `TERMINAL_KEY_MAP`)
- Mixed sequences combining all input types
- Mouse events (click, drag, scroll) with SGR protocol support in both backends

### Security Considerations
- Input validation using Zod schemas
- Proper error handling with try-catch blocks throughout
- Authentication: iTerm2's secure cookie/key system or tmux Unix permissions
- No direct shell execution without terminal context
- Command escaping appropriate for each backend