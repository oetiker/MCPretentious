# MCPretentious API Reference

This document contains technical API details for developers who want to understand the tool internals.

## Backend Support

MCPretentious supports multiple terminal backends:

- **iTerm2** (macOS only): Uses iTerm2's WebSocket API with Protocol Buffers for high-performance control
- **tmux** (cross-platform): Works with tmux sessions on Linux, macOS, and other Unix-like systems
- **Auto mode**: Automatically selects the best available backend

### Backend Selection

Set the backend using the `MCP_TERMINAL_BACKEND` environment variable:
- `auto` (default): Automatically detect and use the best available backend
- `iterm`: Force iTerm2 backend (macOS only)
- `tmux`: Force tmux backend

### Terminal ID Format

Terminal IDs vary by backend:
- iTerm2: `iterm-{windowId}-{tabIndex}` (e.g., `iterm-12345-1`)
- tmux: `tmux:{sessionName}` (e.g., `tmux:mcp-session-123`)

## Available Tools

### `mcpretentious-open`
Opens a new terminal session with optional size specification. The backend used depends on availability and configuration (iTerm2 on macOS, tmux on any platform).

**Parameters**:
- `columns` (number, optional): Initial width in columns (20-500, default: 80)
- `rows` (number, optional): Initial height in rows (5-200, default: 24)

**Returns**: Terminal ID for subsequent operations

**Example Response**:
```json
{
  "terminalId": "iterm-12345-1"  // iTerm2 backend
  // or
  "terminalId": "tmux:session-name"  // tmux backend
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
Closes the terminal session associated with the terminal ID.

**Parameters**:
- `terminalId` (string, required): ID of the terminal

### `mcpretentious-list`
Lists all currently open terminal sessions across all available backends (iTerm2, tmux, etc.).

**Returns**: JSON array of session objects with terminal IDs, backend names, and session metadata

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
Takes a layered screenshot of the terminal screen with configurable data layers to minimize output size.

**Parameters**:
- `terminalId` (string, required): ID of the terminal
- `layers` (array, optional): Data layers to include. Default: `["text", "cursor"]`. Options:
  - `"text"`: Terminal text content
  - `"cursor"`: Cursor position (absolute and relative)
  - `"fgColors"`: Foreground color map with palette
  - `"bgColors"`: Background color map with palette
  - `"styles"`: Combined style encoding (all attributes in one layer)
  - `"bold"`: Bold text markers only
  - `"italic"`: Italic text markers only
  - `"underline"`: Underline text markers only
- `region` (object, optional): Specific viewport rectangle:
  - `left`: Starting column from left (0-based)
  - `top`: Starting row from top (0-based)
  - `width`: Width in columns
  - `height`: Height in rows
- `aroundCursor` (number, optional): Number of lines to show around cursor (e.g., 5 shows 11 lines total)
- `compact` (boolean, optional): Skip empty lines and trim trailing spaces. Default: false

**Returns**: JSON with layered screen data:
```json
{
  "terminal": {
    "width": 80,
    "height": 24
  },
  "viewport": {
    "mode": "aroundCursor",  // "region", "aroundCursor", or "full"
    "left": 0,
    "top": 10,
    "width": 80,
    "height": 11
  },
  "cursor": {
    "left": 35,      // Column position from left
    "top": 15,       // Row position from top
    "relLeft": 35,   // Relative to viewport left
    "relTop": 5      // Relative to viewport top
  },
  "text": ["line1", "line2", ...],  // If "text" layer requested
  "styles": ["..b..i..u..", ...],   // If "styles" layer requested
  "styleLegend": {                  // Included with style layers
    ".": null,
    "b": "bold",
    "i": "italic",
    "u": "underline",
    "I": "bold+italic",
    "U": "bold+underline",
    "J": "italic+underline",
    "X": "bold+italic+underline"
  },
  "bold": ["  X  X  ", ...],        // If "bold" layer requested
  "italic": ["    X X ", ...],      // If "italic" layer requested
  "underline": ["      XX", ...],   // If "underline" layer requested
  "fgColors": ["aaabbcccc", ...],   // If "fgColors" layer requested
  "bgColors": ["000000000", ...],   // If "bgColors" layer requested
  "colorPalette": {                  // Included with color layers
    "0": null,  // default
    "a": "#ff0000",
    "b": "#00ff00"
  }
}
```

**Style Encoding**:
- Combined styles use single lowercase for single attributes, uppercase for combinations
- Individual style layers use 'X' for active, space for inactive
- Color layers use single characters mapped to palette entries
- Empty/default values can use '.' or '0' for clarity

## Usage Examples for LLM Interaction

### Basic Terminal Interaction
```javascript
// Open a new terminal with custom size
const terminal = await use_mcp_tool("mcpretentious", "mcpretentious-open", {
  columns: 120,
  rows: 40
});
// Returns terminalId like "iterm-12345-1" or "tmux:mcp-session-123"

// Get terminal info
const info = await use_mcp_tool("mcpretentious", "mcpretentious-info", {
  terminalId: terminal.terminalId
});

// Resize terminal
await use_mcp_tool("mcpretentious", "mcpretentious-resize", {
  terminalId: terminal.terminalId,
  columns: 80,
  rows: 24
});

// Execute a command
await use_mcp_tool("mcpretentious", "mcpretentious-type", {
  terminalId: terminal.terminalId,
  input: ["ls -la", {key: "enter"}]
});

// Read the output
const output = await use_mcp_tool("mcpretentious", "mcpretentious-read", {
  terminalId: terminal.terminalId
});
```

### TUI Application Testing

#### Example 1: Minimal Screenshot (text and cursor only)
```javascript
const minimalScreen = await use_mcp_tool("mcpretentious", "mcpretentious-screenshot", {
  terminalId: terminal.terminalId,
  layers: ["text", "cursor"]
});
```

**Sample Response:**
```json
{
  "terminal": {
    "width": 80,
    "height": 24
  },
  "viewport": {
    "mode": "full",
    "left": 0,
    "top": 0,
    "width": 80,
    "height": 24
  },
  "cursor": {
    "left": 15,
    "top": 10,
    "relLeft": 15,
    "relTop": 10
  },
  "text": [
    "$ ls -la",
    "total 64",
    "drwxr-xr-x  12 user  staff   384 Jan 15 10:30 .",
    "drwxr-xr-x   8 user  staff   256 Jan 14 09:15 ..",
    "-rw-r--r--   1 user  staff  2048 Jan 15 10:30 README.md",
    "-rw-r--r--   1 user  staff  1024 Jan 15 09:45 package.json",
    "$ ",
    "",
    "",
    "..."
  ]
}
```

#### Example 2: Screenshot Around Cursor with Styles
```javascript
const aroundCursor = await use_mcp_tool("mcpretentious", "mcpretentious-screenshot", {
  terminalId: terminal.terminalId,
  layers: ["text", "cursor", "styles"],
  aroundCursor: 3
});
```

**Sample Response:**
```json
{
  "terminal": {
    "width": 80,
    "height": 24
  },
  "viewport": {
    "mode": "aroundCursor",
    "left": 0,
    "top": 7,
    "width": 80,
    "height": 7
  },
  "cursor": {
    "left": 2,
    "top": 10,
    "relLeft": 2,
    "relTop": 3
  },
  "text": [
    "drwxr-xr-x   8 user  staff   256 Jan 14 09:15 ..",
    "-rw-r--r--   1 user  staff  2048 Jan 15 10:30 README.md",
    "-rw-r--r--   1 user  staff  1024 Jan 15 09:45 package.json",
    "$ vim README.md",
    "~",
    "~",
    "-- INSERT --"
  ],
  "styles": [
    "bbbbbbbbbbb...................................",
    "..............................................",
    "..............................................",
    "..bbb.........................................",
    "I.............................................",
    "I.............................................",
    "bbbbbbbbbbbb.................................."
  ],
  "styleLegend": {
    ".": null,
    "b": "bold",
    "I": "bold+italic"
  }
}
```

#### Example 3: Region with Colors
```javascript
const region = await use_mcp_tool("mcpretentious", "mcpretentious-screenshot", {
  terminalId: terminal.terminalId,
  layers: ["text", "fgColors", "bgColors"],
  region: { left: 0, top: 0, width: 40, height: 5 }
});
```

**Sample Response:**
```json
{
  "terminal": {
    "width": 80,
    "height": 24
  },
  "viewport": {
    "mode": "region",
    "left": 0,
    "top": 0,
    "width": 40,
    "height": 5
  },
  "cursor": {
    "left": 15,
    "top": 10,
    "relLeft": -1,  // Cursor is outside viewport
    "relTop": -1    // Cursor is outside viewport
  },
  "text": [
    "$ git status",
    "On branch main",
    "Changes not staged for commit:",
    "  modified:   README.md",
    "  modified:   package.json"
  ],
  "fgColors": [
    "0000000000000",
    "aaaaaaaaaaaaa",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "00cccccccccc00ddddddddd",
    "00cccccccccc00eeeeeeeeeeeee"
  ],
  "bgColors": [
    "0000000000000",
    "0000000000000",
    "0000000000000",
    "0000000000000",
    "0000000000000"
  ],
  "colorPalette": {
    "0": null,
    "a": "#00ff00",
    "b": "#ffff00",
    "c": "#ff0000",
    "d": "#ffffff",
    "e": "#cccccc"
  }
}
```

#### Example 4: Combined Styles with Colors
```javascript
const combined = await use_mcp_tool("mcpretentious", "mcpretentious-screenshot", {
  terminalId: terminal.terminalId,
  layers: ["text", "cursor", "styles", "fgColors", "bgColors"],
  region: { left: 0, top: 5, width: 50, height: 8 }
});
```

**Sample Response:**
```json
{
  "terminal": {
    "width": 80,
    "height": 24
  },
  "viewport": {
    "mode": "region",
    "left": 0,
    "top": 5,
    "width": 50,
    "height": 8
  },
  "cursor": {
    "left": 25,
    "top": 8,
    "relLeft": 25,
    "relTop": 3
  },
  "text": [
    "┌────────────────────────────────────────────────┐",
    "│ File  Edit  View  Help                        │",
    "├────────────────────────────────────────────────┤",
    "│ README.md                                      │",
    "│ ============                                   │",
    "│                                                │",
    "│ This is **bold** and _italic_ and __underline__│",
    "│ Combined: ***bold italic*** text               │"
  ],
  "styles": [
    "...................................................",
    "..bbbb..bbbb..bbbb..bbbb.........................",
    "...................................................",
    "..bbbbbbbbb.......................................",
    "..UUUUUUUUUUUU....................................",
    "...................................................",
    "..........bbbbbbbb.....iiiiiiiii....uuuuuuuuuuuu.",
    "...........XXXXXXXXXXXXXXb........................"
  ],
  "styleLegend": {
    ".": null,
    "b": "bold",
    "i": "italic",
    "u": "underline",
    "U": "bold+underline",
    "X": "bold+italic+underline"
  },
  "fgColors": [
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "a0bbbb00bbbb00bbbb00bbbb00000000000000000000000a",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "a0cccccccccc0000000000000000000000000000000000a",
    "a0dddddddddddddd0000000000000000000000000000000a",
    "a00000000000000000000000000000000000000000000000a",
    "a0000000000eeeeeee00000fffffff00000ggggggggggg0a",
    "a00000000000hhhhhhhhhhhhhhhh00000000000000000000a"
  ],
  "bgColors": [
    "11111111111111111111111111111111111111111111111111",
    "10222222222222222222222222222222222222222222221",
    "11111111111111111111111111111111111111111111111111",
    "10000000000000000000000000000000000000000000001",
    "10000000000000000000000000000000000000000000001",
    "10000000000000000000000000000000000000000000001",
    "10000000000000000000000000000000000000000000001",
    "10000000003333333333333300000000000000000000001"
  ],
  "colorPalette": {
    "0": null,
    "1": "#1e1e1e",
    "2": "#2d2d30",
    "3": "#ffff00",
    "a": "#808080",
    "b": "#ffffff",
    "c": "#569cd6",
    "d": "#4ec9b0",
    "e": "#ce9178",
    "f": "#d7ba7d",
    "g": "#b5cea8",
    "h": "#c586c0"
  }
}
```

#### Example 5: Individual Style Layers with Compact Mode
```javascript
const fullStyles = await use_mcp_tool("mcpretentious", "mcpretentious-screenshot", {
  terminalId: terminal.terminalId,
  layers: ["text", "bold", "italic", "underline"],
  compact: true,
  aroundCursor: 2
});
```

**Sample Response:**
```json
{
  "terminal": {
    "width": 80,
    "height": 24
  },
  "viewport": {
    "mode": "aroundCursor",
    "left": 0,
    "top": 8,
    "width": 80,
    "height": 5
  },
  "cursor": {
    "left": 10,
    "top": 10,
    "relLeft": 10,
    "relTop": 2
  },
  "text": [
    "Welcome to Vim",
    "Press i for insert mode",
    "Hello World",
    "Type :q to quit",
    "~"
  ],
  "bold": [
    "XXXXXXXXXXXXXXX                    ",
    "      X                            ",
    "XXXXX XXXXX                        ",
    "                                   ",
    "X                                  "
  ],
  "italic": [
    "                                   ",
    "       XXXXXXXXXXXXXXXXXXXX        ",
    "                                   ",
    "      XX                           ",
    "                                   "
  ],
  "underline": [
    "                                   ",
    "                                   ",
    "      XXXXX                        ",
    "XXXX                               ",
    "                                   "
  ]
}
```