# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCPretentious is the Final iTerm MCP - a Model Context Protocol server that enables AI assistants to control iTerm2 terminals on macOS. It uses iTerm2's high-performance WebSocket API with Protocol Buffers for lightning-fast terminal control (20x faster than AppleScript). Unlike other implementations, MCPretentious provides real terminal addressing, no focus stealing, and proper TUI screen content reading with cursor position and color information.

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
- Uses iTerm2's WebSocket API with Protocol Buffers for high-performance control
- Implements the MCP protocol using `@modelcontextprotocol/sdk`
- Provides terminal control with session tracking for window management
- Terminal IDs follow format: `iterm-{windowId}-{tabIndex}`
- Includes utility libraries for terminal operations, color handling, and focus management

## Key Implementation Details

### WebSocket API Integration
- iTerm2 control is done through the native WebSocket API using Protocol Buffers
- Authentication via iTerm2's Python API (must be enabled in Preferences)
- Focus restoration logic handles VS Code and other Electron apps specially
- 20x faster performance compared to AppleScript-based solutions

### Terminal Input System
The `mcpretentious-type` tool is the universal input method that handles:
- Text strings (with proper AppleScript escaping)
- ASCII codes (0-255)
- Special keys via escape sequences (stored in `TERMINAL_KEY_MAP`)
- Mixed sequences combining all input types

### Security Considerations
- Input validation using Zod schemas
- Proper error handling with try-catch blocks throughout
- Authentication via iTerm2's secure cookie/key system
- No direct shell execution without terminal context