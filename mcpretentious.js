#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getClient } from "./lib/iterm2-client.js";
import { getCurrentFocus, restoreFocus } from "./lib/focus-manager.js";
import { ITERM_DEFAULTS } from "./lib/constants.js";
import {
  generateTerminalId,
  parseTerminalId,
  isValidTerminalId,
  successResponse,
  errorResponse,
  validateTerminalId,
  getSessionForTerminal,
  safeExecute,
  parseSessionIdentifier,
  TERMINAL_ID_FORMAT
} from "./lib/terminal-utils.js";

// No longer need session mappings - using UUID directly as terminal ID

// Terminal key mappings
const TERMINAL_KEY_MAP = {
  'tab': '\t',
  'shift-tab': '\x1b[Z',
  'enter': '\r',
  'return': '\r',
  'escape': '\x1b',
  'esc': '\x1b',
  'backspace': '\x08',
  'delete': '\x7f',
  'up': '\x1b[A',
  'down': '\x1b[B',
  'right': '\x1b[C',
  'left': '\x1b[D',
  'home': '\x1b[H',
  'end': '\x1b[F',
  'pageup': '\x1b[5~',
  'pagedown': '\x1b[6~',
  // Ctrl keys
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => 
      [`ctrl-${String.fromCharCode(97 + i)}`, String.fromCharCode(i + 1)]
    )
  ),
  // Function keys
  'f1': '\x1bOP',
  'f2': '\x1bOQ',
  'f3': '\x1bOR',
  'f4': '\x1bOS',
  'f5': '\x1b[15~',
  'f6': '\x1b[17~',
  'f7': '\x1b[18~',
  'f8': '\x1b[19~',
  'f9': '\x1b[20~',
  'f10': '\x1b[21~',
  'f11': '\x1b[23~',
  'f12': '\x1b[24~',
};

const SUPPORTED_KEYS = Object.keys(TERMINAL_KEY_MAP).join(', ');

// Create server instance
const server = new McpServer({
  name: "mcpretentious",
  version: "1.2.0",
});

// Helper function to handle terminal operations with session
async function withTerminalSession(terminalId, operation) {
  // Terminal ID is now the session ID directly
  if (!terminalId) {
    return errorResponse("Terminal ID is required");
  }
  
  const client = await getClient();
  
  // Verify the session exists
  const sessions = await client.listSessions();
  const sessionExists = sessions.some(s => s.uniqueIdentifier === terminalId);
  
  if (!sessionExists) {
    return errorResponse(`Terminal not found: ${terminalId}`);
  }
  
  return operation(client, terminalId);
}

// === Tool Handlers ===

server.tool(
  "mcpretentious-open", 
  "Opens a new iTerm2 window and creates a tracked terminal session. Returns a terminal ID that can be used with other commands.",
  {
    columns: z.number().min(ITERM_DEFAULTS.MIN_COLUMNS).max(ITERM_DEFAULTS.MAX_COLUMNS).optional().describe(`Initial width in columns (default: ${ITERM_DEFAULTS.COLUMNS})`),
    rows: z.number().min(ITERM_DEFAULTS.MIN_ROWS).max(ITERM_DEFAULTS.MAX_ROWS).optional().describe(`Initial height in rows (default: ${ITERM_DEFAULTS.ROWS})`),
  }, 
  async ({ columns, rows }) => {
    return safeExecute(async () => {
      const originalFocus = getCurrentFocus();
      const client = await getClient();
      
      const sessionId = await client.createTab();
      if (!sessionId) {
        throw new Error("Failed to create new terminal session");
      }
      
      // Use session UUID directly as terminal ID
      const terminalId = sessionId;
      
      // Resize if dimensions were specified
      if (columns || rows) {
        try {
          await client.setSessionSize(sessionId, columns || ITERM_DEFAULTS.COLUMNS, rows || ITERM_DEFAULTS.ROWS);
        } catch (resizeError) {
          // Non-fatal: log but continue
          console.warn(`Could not resize terminal: ${resizeError.message}`);
        }
      }
      
      // Restore focus
      if (originalFocus) {
        setTimeout(() => restoreFocus(originalFocus), 100);
      }
      
      const sizeInfo = (columns || rows) 
        ? ` (${columns || ITERM_DEFAULTS.COLUMNS}×${rows || ITERM_DEFAULTS.ROWS})` 
        : '';
      return successResponse(`Terminal opened with ID: ${terminalId}${sizeInfo}`);
    }, "Failed to open terminal");
  }
);

server.tool(
  "mcpretentious-read",
  "Reads text output from a terminal session. Returns the current screen contents. Use mcpretentious-screenshot for rich terminal info including colors, cursor position, and styles.",
  {
    terminalId: z.string().describe("The terminal ID to read from"),
    lines: z.number().optional().describe("Number of lines to read from the bottom"),
  },
  async ({ terminalId, lines }) => {
    return withTerminalSession(terminalId, async (client, sessionId) => {
      return safeExecute(async () => {
        const screen = await client.getScreenContents(sessionId, false);
        let content = screen?.text || "";
        
        if (lines && content) {
          const allLines = content.split('\n');
          let lastNonEmpty = allLines.length - 1;
          while (lastNonEmpty >= 0 && allLines[lastNonEmpty].trim() === '') {
            lastNonEmpty--;
          }
          const startIdx = Math.max(0, lastNonEmpty - lines + 1);
          content = allLines.slice(startIdx, lastNonEmpty + 1).join('\n');
        }
        
        return successResponse(content || "No output available");
      }, "Failed to read output");
    });
  }
);

server.tool(
  "mcpretentious-screenshot",
  "Takes a token-optimized screenshot of the terminal screen using a layered format that reduces token usage by 85-98%. Returns only the data layers you need (text, cursor, colors, styles). Supports viewport limiting to show just a region or area around cursor. Essential for inspecting TUI applications without hitting token limits.",
  {
    terminalId: z.string().describe("The terminal ID to read from"),
    layers: z.array(z.enum([
      "text", "cursor", "fgColors", "bgColors", 
      "styles", "bold", "italic", "underline"
    ])).optional().default(["text", "cursor"])
      .describe("Data layers to include. 'text' for content, 'cursor' for position, 'styles' for combined formatting, individual style layers, or color layers with palette. Default: ['text', 'cursor'] for minimal token usage"),
    region: z.object({
      left: z.number().describe("Starting column from left (0-based)"),
      top: z.number().describe("Starting row from top (0-based)"),
      width: z.number().describe("Width in columns"),
      height: z.number().describe("Height in rows")
    }).optional().describe("Limit to specific viewport rectangle to reduce tokens"),
    aroundCursor: z.number().optional()
      .describe("Show N lines around cursor (e.g., 5 shows 11 lines total). Great for reducing tokens when debugging at cursor position"),
    compact: z.boolean().optional().default(false)
      .describe("Skip empty lines to further reduce token usage")
  },
  async ({ terminalId, layers = ["text", "cursor"], region, aroundCursor, compact = false }) => {
    return withTerminalSession(terminalId, async (client, sessionId) => {
      return safeExecute(async () => {
        const { 
          calculateViewport, 
          extractTextLayer, 
          extractColorLayers, 
          extractStyleLayers,
          applyCompactMode 
        } = await import('./lib/screenshot-layers.js');
        
        const screen = await client.getScreenContents(sessionId, true);
        
        // Normalize cursor values
        const cursor = {
          x: typeof screen.cursor?.x === 'object' ? (screen.cursor.x.low || screen.cursor.x) : (screen.cursor?.x || 0),
          y: typeof screen.cursor?.y === 'object' ? (screen.cursor.y.low || screen.cursor.y) : (screen.cursor?.y || 0)
        };
        
        // Get terminal dimensions
        // iTerm2's grid_size is typically 1 less than actual content dimensions
        const gridSize = await client.getProperty(sessionId, 'grid_size');
        const terminal = {
          width: gridSize.width + 1,
          height: gridSize.height + 1
        };
        
        // Calculate viewport
        const viewport = calculateViewport(terminal, cursor, { region, aroundCursor });
        
        // Build response structure
        let response = {
          terminal,
          viewport
        };
        
        // Add cursor info if requested
        if (layers.includes("cursor")) {
          response.cursor = {
            left: cursor.x,
            top: cursor.y,
            relLeft: cursor.x - viewport.left,
            relTop: cursor.y - viewport.top
          };
        }
        
        // Add text layer if requested
        if (layers.includes("text")) {
          response.text = extractTextLayer(screen.lines, viewport, false);
        }
        
        // Add color layers if requested
        const colorLayers = layers.filter(l => l === "fgColors" || l === "bgColors");
        if (colorLayers.length > 0) {
          const colors = extractColorLayers(screen.lines, viewport, colorLayers);
          Object.assign(response, colors);
        }
        
        // Add style layers if requested
        const styleLayers = layers.filter(l => ["styles", "bold", "italic", "underline"].includes(l));
        if (styleLayers.length > 0) {
          const styles = extractStyleLayers(screen.lines, viewport, styleLayers);
          Object.assign(response, styles);
        }
        
        // Apply compact mode if requested
        if (compact && response.text) {
          response = applyCompactMode(response);
        }
        
        return successResponse(JSON.stringify(response, null, 2));
      }, "Failed to get screen info");
    });
  }
);

server.tool(
  "mcpretentious-close",
  "Closes the iTerm2 window associated with the specified terminal ID.",
  {
    terminalId: z.string().describe("The terminal ID to close"),
  },
  async ({ terminalId }) => {
    return withTerminalSession(terminalId, async (client, sessionId) => {
      return safeExecute(async () => {
        const success = await client.closeSession(sessionId, true);
        
        if (success) {
          return successResponse(`Terminal ${terminalId} closed`);
        }
        
        throw new Error(`Failed to close terminal ${terminalId}`);
      }, "Failed to close terminal");
    });
  }
);

server.tool(
  "mcpretentious-list",
  "Lists all currently open iTerm2 terminal sessions with their IDs.",
  {},
  async () => {
    return safeExecute(async () => {
      const client = await getClient();
      const sessions = await client.listSessions();
      
      // Group sessions by window
      const windowMap = new Map();
      
      for (const session of sessions) {
        // Use the session UUID directly as the terminal ID
        const terminalId = session.uniqueIdentifier;
        const windowId = session.windowId;
        const tabId = session.tabId;
        
        if (windowId) {
          if (!windowMap.has(windowId)) {
            windowMap.set(windowId, []);
          }
          
          // No need for mapping - terminal ID IS the session ID
          windowMap.get(windowId).push({
            terminalId,
            tabIndex: tabId,
            sessionId: session.uniqueIdentifier
          });
        }
      }
      
      // Format output
      const terminals = [];
      for (const tabs of windowMap.values()) {
        for (const tab of tabs) {
          terminals.push(tab.terminalId);
        }
      }
      
      const output = [
        `Windows: ${windowMap.size}, Total tabs: ${sessions.length}`,
        ...terminals
      ].join('\n');
      
      return successResponse(`iTerm status and terminal IDs:\n${output}`);
    }, "Could not get iTerm status");
  }
);

server.tool(
  "mcpretentious-type", 
  `Send text and keystrokes to a terminal. Always pass as array.

Examples: ["ls -la"], ["cd /path", {"key": "enter"}], ["Hello", 32, "World"], [{"key": "ctrl-c"}]

Supported keys: ${SUPPORTED_KEYS}`,
  {
    terminalId: z.string().describe("ID of the terminal to send input to"),
    input: z.array(z.union([
      z.string().describe("Text to type"),
      z.number().int().min(0).max(255).describe("ASCII code"),
      z.object({ key: z.string() }).describe("Special key")
    ])).describe("Array of text / key / ascii to send"),
  },
  async ({ terminalId, input }) => {
    // Validate input first
    if (!input || input.length === 0) {
      return errorResponse("Empty sequence provided");
    }
    
    // Build text to send with validation
    let textToSend = "";
    
    for (const item of input) {
      if (typeof item === 'number') {
        if (item < 0 || item > 255) {
          return errorResponse(`Invalid ASCII code: ${item}. Must be between 0 and 255.`);
        }
        textToSend += String.fromCharCode(item);
      } else if (typeof item === 'string') {
        textToSend += item;
      } else if (typeof item === 'object' && item.key) {
        const keySeq = TERMINAL_KEY_MAP[item.key.toLowerCase()];
        if (keySeq === undefined) {
          return errorResponse(`Unknown key: ${item.key}. Available keys: ${SUPPORTED_KEYS}`);
        }
        textToSend += keySeq;
      } else {
        return errorResponse(`Invalid input type: ${typeof item}. Use string, number (0-255), or {key: 'name'}`);
      }
    }
    
    // Now execute with terminal session
    return withTerminalSession(terminalId, async (client, sessionId) => {
      return safeExecute(async () => {
        const success = await client.sendText(sessionId, textToSend);
        
        if (success) {
          return successResponse(`Sent sequence of ${input.length} items to ${terminalId}`);
        }
        
        throw new Error(`Failed to send sequence to ${terminalId}`);
      }, "Failed to send sequence");
    });
  }
);

server.tool(
  "mcpretentious-info",
  "Gets terminal metadata including dimensions (columns × rows) and session information.",
  {
    terminalId: z.string().describe("The terminal ID to get info for"),
  },
  async ({ terminalId }) => {
    return withTerminalSession(terminalId, async (client, sessionId) => {
      return safeExecute(async () => {
        const info = await client.getSessionInfo(sessionId);
        
        // iTerm2's grid_size is typically 1 less than actual content dimensions
        return successResponse(JSON.stringify({
          terminalId,
          sessionId: info.sessionId,
          windowId: info.windowId,
          dimensions: {
            columns: info.dimensions.columns + 1,
            rows: info.dimensions.rows + 1
          }
        }, null, 2));
      }, "Failed to get terminal info");
    });
  }
);

server.tool(
  "mcpretentious-resize",
  "Resizes a terminal to the specified dimensions in columns × rows.",
  {
    terminalId: z.string().describe("The terminal ID to resize"),
    columns: z.number().min(ITERM_DEFAULTS.MIN_COLUMNS).max(ITERM_DEFAULTS.MAX_COLUMNS).describe("Number of columns (width in characters)"),
    rows: z.number().min(ITERM_DEFAULTS.MIN_ROWS).max(ITERM_DEFAULTS.MAX_ROWS).describe("Number of rows (height in lines)"),
  },
  async ({ terminalId, columns, rows }) => {
    return withTerminalSession(terminalId, async (client, sessionId) => {
      return safeExecute(async () => {
        const success = await client.setSessionSize(sessionId, columns, rows);
        
        if (success) {
          return successResponse(`Terminal ${terminalId} resized to ${columns}×${rows}`);
        }
        
        throw new Error(`Failed to resize terminal ${terminalId}`);
      }, "Failed to resize terminal");
    });
  }
);

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  if (process.env.VERBOSE === 'true') {
    console.error("iTerm2 MCP Server (WebSocket) running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});