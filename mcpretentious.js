#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseArgs } from "util";
import { backendManager } from "./lib/backend-manager.js";
import { TerminalBackend } from "./lib/terminal-backend.js";
import { TmuxBackend } from "./lib/tmux-backend.js";
import { getCurrentFocus, restoreFocus } from "./lib/focus-manager.js";
import { ITERM_DEFAULTS } from "./lib/constants.js";
import {
  successResponse,
  errorResponse,
  safeExecute
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
  // Check if any backends are available first
  if (!backendManager.hasBackends()) {
    return errorResponse(backendManager.getNoBackendError());
  }
  
  if (!terminalId) {
    return errorResponse("Terminal ID is required");
  }
  
  // Check if session exists
  const sessionExists = await backendManager.sessionExists(terminalId);
  
  if (!sessionExists) {
    return errorResponse(`Terminal not found: ${terminalId}`);
  }
  
  return operation(terminalId);
}

// === Tool Handlers ===

// Function to register tools after backend initialization
function registerTools() {
  // Build schema for mcpretentious-open based on current mode
  const openToolSchema = {
    columns: z.number().min(ITERM_DEFAULTS.MIN_COLUMNS).max(ITERM_DEFAULTS.MAX_COLUMNS).optional().describe(`Initial width in columns (default: ${ITERM_DEFAULTS.COLUMNS})`),
    rows: z.number().min(ITERM_DEFAULTS.MIN_ROWS).max(ITERM_DEFAULTS.MAX_ROWS).optional().describe(`Initial height in rows (default: ${ITERM_DEFAULTS.ROWS})`)
  };
  
  // Only add backend parameter if in API mode with multiple backends available
  if (backendManager.isApiMode()) {
    const availableBackends = backendManager.getAvailableBackends();
    if (availableBackends.length > 1) {
      // Only show backend option if there's actually a choice
      openToolSchema.backend = z.enum(availableBackends)
        .optional()
        .describe(`Backend to use for this session. Options: ${availableBackends.map(b => `'${b}'`).join(', ')}. Default: ${availableBackends[0]}`);
    }
  }

  server.tool(
    "mcpretentious-open", 
    "Opens a new terminal window and creates a tracked terminal session. Returns a terminal ID that can be used with other commands.",
    openToolSchema,
  async ({ columns, rows, backend }) => {
    return safeExecute(async () => {
      // Check if any backends are available
      if (!backendManager.hasBackends()) {
        throw new Error(backendManager.getNoBackendError());
      }
      
      // Store focus before creating terminal (iTerm2 only)
      const originalFocus = await getCurrentFocus();
      
      // Create terminal using backend manager
      const sessionOptions = { columns, rows };
      
      // Add backend selection in API mode
      if (backendManager.isApiMode()) {
        if (backend) {
          // Validate backend is available
          const available = backendManager.getAvailableBackends();
          if (!available.includes(backend)) {
            throw new Error(`Backend '${backend}' is not available. Available backends: ${available.join(', ')}`);
          }
          sessionOptions.backend = backend;
        } else {
          // Use first available backend if not specified
          const available = backendManager.getAvailableBackends();
          if (available.length > 0) {
            sessionOptions.backend = available[0];
          }
        }
      } else if (backend) {
        // Backend parameter provided but not in API mode
        throw new Error('Backend selection is only available when server is started with --backend=api');
      }
      
      const terminalId = await backendManager.createSession(sessionOptions);
      
      if (!terminalId) {
        throw new Error("Failed to create new terminal session");
      }
      
      // Restore focus (iTerm2 only)
      if (originalFocus) {
        setTimeout(() => restoreFocus(originalFocus), 100);
      }
      
      const terminalBackend = backendManager.getBackendForTerminal(terminalId);
      const backendName = terminalBackend.getName();
      const sizeInfo = (columns || rows) 
        ? ` (${columns || ITERM_DEFAULTS.COLUMNS}×${rows || ITERM_DEFAULTS.ROWS})` 
        : '';
      
      // Include available backends info in API mode
      if (backendManager.isApiMode()) {
        const availableList = backendManager.getAvailableBackends().join(', ');
        return successResponse(`${backendName} terminal opened with ID: ${terminalId}${sizeInfo}\nAvailable backends: ${availableList}`);
      }
      
      return successResponse(`${backendName} terminal opened with ID: ${terminalId}${sizeInfo}`);
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
    return withTerminalSession(terminalId, async (sessionId) => {
      return safeExecute(async () => {
        const screen = await backendManager.getScreenContents(sessionId, false);
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
    return withTerminalSession(terminalId, async (sessionId) => {
      return safeExecute(async () => {
        const backend = backendManager.getBackendForTerminal(sessionId);
        
        // Check if backend is TMux - it has dedicated screenshot method
        if (backend instanceof TmuxBackend) {
          const screenshot = await backend.getScreenshot(sessionId, {
            layers, region, aroundCursor, compact
          });
          return successResponse(JSON.stringify(screenshot, null, 2));
        }
        
        // iTerm2 backend - use existing logic
        const { 
          calculateViewport, 
          extractTextLayer, 
          extractColorLayers, 
          extractStyleLayers,
          applyCompactMode 
        } = await import('./lib/screenshot-layers.js');
        
        const screen = await backendManager.getScreenContents(sessionId, true);
        
        // Normalize cursor values
        const cursor = {
          x: typeof screen.cursor?.x === 'object' ? (screen.cursor.x.low || screen.cursor.x) : (screen.cursor?.x || 0),
          y: typeof screen.cursor?.y === 'object' ? (screen.cursor.y.low || screen.cursor.y) : (screen.cursor?.y || 0)
        };
        
        // Get terminal dimensions
        // iTerm2's grid_size is typically 1 less than actual content dimensions
        const gridSize = await backendManager.getProperty(sessionId, 'grid_size');
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
  "Closes the terminal window associated with the specified terminal ID.",
  {
    terminalId: z.string().describe("The terminal ID to close"),
  },
  async ({ terminalId }) => {
    return withTerminalSession(terminalId, async (sessionId) => {
      return safeExecute(async () => {
        const success = await backendManager.closeSession(sessionId);
        
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
  "Lists all currently open terminal sessions with their IDs.",
  {},
  async () => {
    return safeExecute(async () => {
      // Check if any backends are available
      if (!backendManager.hasBackends()) {
        throw new Error(backendManager.getNoBackendError());
      }
      
      const sessions = await backendManager.listSessions();
      
      // Return JSON array of session objects
      return successResponse(JSON.stringify(sessions));
    }, "Could not list terminal sessions");
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
    return withTerminalSession(terminalId, async (sessionId) => {
      return safeExecute(async () => {
        const success = await backendManager.sendText(sessionId, textToSend);
        
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
    return withTerminalSession(terminalId, async (sessionId) => {
      return safeExecute(async () => {
        const info = await backendManager.getSessionInfo(sessionId);
        const backend = backendManager.getBackendForTerminal(sessionId);
        
        // iTerm2's grid_size is typically 1 less than actual content dimensions
        // TMux already returns correct dimensions
        const adjustDimensions = backend.getType() === 'iterm';
        
        return successResponse(JSON.stringify({
          terminalId,
          backend: backend.getName(),
          sessionId: info.sessionId,
          windowId: info.windowId,
          dimensions: {
            columns: adjustDimensions ? info.dimensions.columns + 1 : info.dimensions.columns,
            rows: adjustDimensions ? info.dimensions.rows + 1 : info.dimensions.rows
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
    return withTerminalSession(terminalId, async (sessionId) => {
      return safeExecute(async () => {
        const success = await backendManager.setSessionSize(sessionId, columns, rows);
        
        if (success) {
          return successResponse(`Terminal ${terminalId} resized to ${columns}×${rows}`);
        }
        
        throw new Error(`Failed to resize terminal ${terminalId}`);
      }, "Failed to resize terminal");
    });
  }
  );
}

// Parse command-line arguments
function parseCommandLineArgs() {
  const options = {
    backend: {
      type: 'string',
      short: 'b',
      default: process.env.MCP_TERMINAL_BACKEND || 'auto'
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false
    },
    verbose: {
      type: 'boolean',
      short: 'v',
      default: process.env.VERBOSE === 'true'
    }
  };

  try {
    const { values } = parseArgs({ 
      options, 
      allowPositionals: false 
    });
    
    return values;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error('\nUsage: mcpretentious [options]');
    console.error('\nOptions:');
    console.error('  -b, --backend <type>  Backend to use: auto, iterm, tmux, api (default: auto)');
    console.error('  -v, --verbose         Enable verbose output');
    console.error('  -h, --help           Show this help message');
    process.exit(1);
  }
}

// Store backend mode globally for use in tools
let BACKEND_MODE = 'auto';

// Main entry point
async function main() {
  const args = parseCommandLineArgs();
  
  if (args.help) {
    console.log('MCPretentious - Universal Terminal MCP');
    console.log('\nUsage: mcpretentious [options]');
    console.log('\nOptions:');
    console.log('  -b, --backend <type>  Backend to use: auto, iterm, tmux, api (default: auto)');
    console.log('                        - auto: Automatically detect best backend');
    console.log('                        - iterm: Use iTerm2 backend (macOS only)');
    console.log('                        - tmux: Use tmux backend (cross-platform)');
    console.log('                        - api: Let LLM choose backend per session');
    console.log('  -v, --verbose         Enable verbose output');
    console.log('  -h, --help           Show this help message');
    console.log('\nEnvironment variables:');
    console.log('  MCP_TERMINAL_BACKEND  Default backend (overridden by --backend)');
    console.log('  VERBOSE               Enable verbose output (overridden by --verbose)');
    process.exit(0);
  }
  
  // Validate backend option
  const validBackends = ['auto', 'iterm', 'tmux', 'api'];
  if (!validBackends.includes(args.backend)) {
    console.error(`Error: Invalid backend '${args.backend}'. Must be one of: ${validBackends.join(', ')}`);
    process.exit(1);
  }
  
  // Store backend mode
  BACKEND_MODE = args.backend;
  
  // Initialize backend manager
  if (BACKEND_MODE === 'api') {
    // In API mode, initialize with available backends but don't select default
    await backendManager.initApiMode();
    if (args.verbose) {
      if (backendManager.hasBackends()) {
        const available = backendManager.getAvailableBackends();
        console.error(`MCPretentious: Running in API mode with backends: ${available.join(', ')}`);
      } else {
        console.error('MCPretentious: No backends available - tools will return errors');
      }
    }
  } else {
    // Normal mode - initialize with specific backend
    await backendManager.init(BACKEND_MODE);
    if (args.verbose) {
      if (backendManager.hasBackends()) {
        const backend = backendManager.getDefaultBackend();
        console.error(`MCPretentious: Using ${backend.getName()} backend`);
      } else {
        console.error('MCPretentious: No backends available - tools will return errors');
      }
    }
  }
  
  // Warn if no backends available but continue running
  if (!backendManager.hasBackends()) {
    console.error('\nWarning: No terminal backend available.');
    console.error('The server will continue running, but all terminal operations will fail.');
    console.error('\nTo enable terminal features, please install either:');
    console.error('  - iTerm2 with Python API enabled (macOS)');
    console.error('  - tmux (any platform)');
  }
  
  // Register tools after backend initialization
  registerTools();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  if (args.verbose) {
    console.error('MCPretentious MCP Server running on stdio');
  }
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});