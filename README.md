# MCPretentious - Universal Terminal MCP

[![npm version](https://badge.fury.io/js/mcpretentious.svg)](https://www.npmjs.com/package/mcpretentious)
[![Test Status](https://github.com/oetiker/MCPretentious/workflows/Test/badge.svg)](https://github.com/oetiker/MCPretentious/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

MCP server for terminal control. Supports iTerm2 (macOS) via WebSocket API and tmux (cross-platform) via direct commands.

<!-- LATEST-CHANGES-START -->
## 📋 Latest Release (v1.2.3 - 2025-08-30)

### Fixed
- Fixed missing `setSessionSize` method in tmux backend that prevented terminal resizing

For full changelog, see [CHANGELOG.md](CHANGELOG.md)
<!-- LATEST-CHANGES-END -->

## Installation

```bash
npm install -g mcpretentious
```

### Prerequisites

**iTerm2 (macOS):**
- Enable Python API: iTerm2 → Preferences → General → Magic → Enable "Python API"

**TMux (any platform):**
- Install tmux: `brew install tmux` / `apt install tmux` / etc.

## Configuration

### Claude Desktop
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

### Claude Code
```bash
claude mcp add mcpretentious npx mcpretentious
```

## Main Applications

- **TUI application testing**: Simulates all human interactions - keyboard, mouse, screen reading
- **Remote server management**: Persistent terminal sessions allow remote system control over SSH

## Features

- **Multiple backends**: iTerm2 (WebSocket, 20x faster than AppleScript) and tmux (direct commands)
- **No focus stealing**: Background terminal control
- **Real terminal IDs**: Access existing terminals, not just MCP-created ones
- **Screen reading**: Actual viewport content with cursor position and colors
- **Mouse support**: Full SGR protocol (click, drag, scroll) in both backends
- **Token-optimized screenshots**: 85-98% reduction via layered format

## Backend Comparison

| Feature | iTerm2 | TMux |
|---------|--------|------|
| Platform | macOS | Cross-platform |
| Method | WebSocket + Protobuf | Direct commands |
| Performance | Fastest | Fast |
| Colors | Full RGB | ANSI 256 |
| Authentication | Cookie/key | Unix permissions |

## Tools

- `mcpretentious-open` - Create terminal session
- `mcpretentious-type` - Send text/keys/ASCII codes
- `mcpretentious-screenshot` - Get screen content (configurable layers)
- `mcpretentious-mouse` - Send mouse events (SGR protocol)
- `mcpretentious-resize` - Set terminal dimensions
- `mcpretentious-close` - Close terminal
- `mcpretentious-list` - List active terminals

## Testing

```bash
npx mcpretentious-test          # Basic test
npx mcpretentious-test --verbose # Detailed output
```

## Security

Full terminal access - the LLM can run any command you could. Be cautious with:
- Untrusted commands
- System passwords
- Destructive operations

## Documentation

- [API Documentation](API.md)
- [Changelog](CHANGELOG.md)

## License

MIT - Tobias Oetiker <tobi@oetiker.ch>