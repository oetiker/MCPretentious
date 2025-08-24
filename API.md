# MCPretentious API Reference

This document contains technical API details for developers who want to understand the tool internals.

## Available Tools

### `mcpretentious-open`
Opens a new iTerm2 terminal window with optional size specification.

**Parameters**:
- `columns` (number, optional): Initial width in columns (20-500, default: 80)
- `rows` (number, optional): Initial height in rows (5-200, default: 24)

**Returns**: Terminal ID for subsequent operations

**Example Response**:
```json
{
  "terminalId": "iterm-12345-1"
}
```

### `mcpretentious-type`
Send text and keystrokes to a terminal.

**Parameters**:
- `terminalId` (string, required): ID of the terminal
- `input` (string | number | object | array): Input to send, can be:
  - **String**: Normal text to type (e.g., `"ls -la"`)
  - **Number**: ASCII/extended ASCII code 0-255 (e.g., `32` for space, `169` for ©)
  - **Object**: Special key as `{key: 'name'}` (e.g., `{key: "enter"}`)
  - **Array**: Mix of the above for complex sequences

**Supported Special Keys**:
- Navigation: `tab`, `shift-tab`, `enter`, `return`, `escape`, `esc`, `backspace`, `delete`
- Arrows: `up`, `down`, `left`, `right`
- Movement: `home`, `end`, `pageup`, `pagedown`
- Control: `ctrl-a` through `ctrl-z`
- Function: `f1` through `f12`

### `mcpretentious-read`
Reads the current screen contents from a terminal session. Always returns what's visible on screen (viewport), not scrollback history.

**Parameters**:
- `terminalId` (string, required): ID of the terminal
- `lines` (number, optional): Number of lines to read from the bottom of the screen

**Returns**: Plain text of the terminal screen content

### `mcpretentious-close`
Closes the iTerm2 window associated with the terminal ID.

**Parameters**:
- `terminalId` (string, required): ID of the terminal

### `mcpretentious-list`
Lists all currently open iTerm2 terminal sessions.

**Returns**: List of active terminal IDs and iTerm status

### `mcpretentious-info`
Gets terminal metadata including dimensions and session information.

**Parameters**:
- `terminalId` (string, required): ID of the terminal

**Returns**: JSON with terminal metadata:
- Terminal ID
- Session ID
- Window ID (if available)
- Dimensions (columns × rows)

### `mcpretentious-resize`
Resizes a terminal to specified dimensions.

**Parameters**:
- `terminalId` (string, required): ID of the terminal
- `columns` (number, required): Width in columns (20-500)
- `rows` (number, required): Height in rows (5-200)

**Returns**: Success message with new dimensions

### `mcpretentious-screenshot` 
Takes a screenshot of the terminal screen with full metadata including cursor position, colors, and text styles.

**Parameters**:
- `terminalId` (string, required): ID of the terminal
- `format` (string, optional): Output format, one of:
  - `"full"` (default): Complete screen data with cursor, dimensions, and styled lines
  - `"cursor-only"`: Just the cursor position

**Returns**: JSON with screen metadata including:
- Cursor position (x, y coordinates)
- Screen dimensions (width × height)
- Lines with text and style information (colors, bold, italic, etc.)

## Usage Examples for LLM Interaction

### Basic Terminal Interaction
```javascript
// Open a new terminal with custom size
const terminal = await use_mcp_tool("mcpretentious", "mcpretentious-open", {
  columns: 120,
  rows: 40
});

// Get terminal info
const info = await use_mcp_tool("mcpretentious", "mcpretentious-info", {
  terminalId: "iterm-12345-1"
});

// Resize terminal
await use_mcp_tool("mcpretentious", "mcpretentious-resize", {
  terminalId: "iterm-12345-1",
  columns: 80,
  rows: 24
});

// Execute a command
await use_mcp_tool("mcpretentious", "mcpretentious-type", {
  terminalId: "iterm-12345-1",
  input: ["ls -la", {key: "enter"}]
});

// Read the output
const output = await use_mcp_tool("mcpretentious", "mcpretentious-read", {
  terminalId: "iterm-12345-1"
});
```

### TUI Application Testing
```javascript
// Read screen content (always returns visible screen)
const screenText = await use_mcp_tool("mcpretentious", "mcpretentious-read", {
  terminalId: "iterm-12345-1"
});

// Get detailed screen info with cursor and colors
const screenInfo = await use_mcp_tool("mcpretentious", "mcpretentious-screenshot", {
  terminalId: "iterm-12345-1",
  format: "full"
});

// Get just cursor position for navigation
const cursor = await use_mcp_tool("mcpretentious", "mcpretentious-screenshot", {
  terminalId: "iterm-12345-1",
  format: "cursor-only"
});
```