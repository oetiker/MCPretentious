/**
 * TMux backend implementation for MCPretentious
 * Provides cross-platform terminal control via tmux control mode
 */

import { TerminalBackend } from './terminal-backend.js';
import { TmuxClientSimple } from './tmux-client-simple.js';
import { convertToLayers } from './ansi-parser.js';
import { ITERM_DEFAULTS } from './constants.js';
import { generateMouseEvent } from './mouse-sgr-protocol.js';
import { execSync } from 'child_process';

export class TmuxBackend extends TerminalBackend {
  constructor() {
    super();
    this.client = null;
  }

  async init() {
    if (!this.client) {
      this.client = new TmuxClientSimple();
    }
    return this.client;
  }

  async isAvailable() {
    try {
      // Check if tmux is installed
      execSync('which tmux', { stdio: 'ignore' });
      
      // Try to initialize client
      await this.init();
      return true;
    } catch (error) {
      return false;
    }
  }

  getName() {
    return 'TMux';
  }

  getType() {
    return 'tmux';
  }

  async createSession(options = {}) {
    await this.init();
    
    const columns = options.columns || ITERM_DEFAULTS.COLUMNS;
    const rows = options.rows || ITERM_DEFAULTS.ROWS;
    
    // Create new tmux session
    const sessionId = await this.client.createSession(columns, rows);
    
    if (!sessionId) {
      throw new Error('Failed to create TMux session');
    }
    
    // Return terminal ID in new format
    return TerminalBackend.generateTerminalId('tmux', sessionId);
  }

  async closeSession(sessionId) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    return await this.client.closeSession(actualSessionId);
  }

  async listSessions() {
    await this.init();
    
    const sessions = await this.client.listSessions();
    
    // Convert to terminal IDs
    return sessions.map(session => ({
      terminalId: TerminalBackend.generateTerminalId('tmux', session.uniqueIdentifier),
      sessionId: session.uniqueIdentifier,
      backend: this.getName(),
      attached: session.attached,
      windowCount: session.windowCount
    }));
  }

  async sendText(sessionId, text) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    return await this.client.sendText(actualSessionId, text);
  }

  async getScreenContents(sessionId, includeStyles = false) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    const screenData = await this.client.getScreenContents(actualSessionId, includeStyles);
    
    // Ensure format matches iTerm2's structure
    if (!screenData.lines) {
      // Convert simple text format to lines array
      const text = screenData.text || '';
      screenData.lines = text.split('\n').map(line => ({ text: line }));
    }
    
    return screenData;
  }

  async getSessionInfo(sessionId) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    return await this.client.getSessionInfo(actualSessionId);
  }

  async setSessionSize(sessionId, columns, rows) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    return await this.client.setSessionSize(actualSessionId, columns, rows);
  }

  async getProperty(sessionId, property) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    return await this.client.getProperty(actualSessionId, property);
  }

  async close() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  isValidSessionId(sessionId) {
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    // TMux session names: alphanumeric, dash, underscore
    // Our format: mcp-{8-char-uuid}
    const sessionRegex = /^[a-zA-Z0-9_-]+$/;
    return sessionRegex.test(actualSessionId);
  }

  /**
   * Check if a session exists
   * @param {string} sessionId - Session to check
   * @returns {Promise<boolean>}
   */
  async sessionExists(sessionId) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    const sessions = await this.client.listSessions();
    return sessions.some(s => s.uniqueIdentifier === actualSessionId);
  }

  /**
   * Send mouse event using SGR protocol
   * @param {string} sessionId - Target session
   * @param {string} event - Event type ('press', 'release', 'drag')
   * @param {number} x - X coordinate (0-based)
   * @param {number} y - Y coordinate (0-based)
   * @param {number} buttonCode - Button code with modifiers already applied
   * @returns {Promise<boolean>} Success status
   */
  async sendMouseEvent(sessionId, event, x, y, buttonCode) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    // Generate SGR escape sequence using the shared protocol function
    // Note: buttonCode already has modifiers applied, so we pass empty modifiers
    const sequence = generateMouseEvent(event, x, y, buttonCode, {});
    
    // Send the sequence to the terminal
    return await this.client.sendText(actualSessionId, sequence);
  }

  /**
   * Get screenshot in layered format (matching iTerm2 API)
   * @param {string} sessionId - Target session
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>} Layered screenshot data
   */
  async getScreenshot(sessionId, options = {}) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    // Get screen contents with styles if needed
    const needsStyles = options.layers?.some(l => 
      ['fgColors', 'bgColors', 'styles', 'bold', 'italic', 'underline'].includes(l)
    );
    
    const screen = await this.client.getScreenContents(actualSessionId, needsStyles);
    
    // Get terminal dimensions
    const info = await this.client.getSessionInfo(actualSessionId);
    const terminal = {
      width: info.dimensions.columns,
      height: info.dimensions.rows
    };
    
    // Calculate viewport
    let viewport = {
      mode: 'full',
      left: 0,
      top: 0,
      width: terminal.width,
      height: terminal.height
    };
    
    // Apply viewport options
    if (options.region) {
      viewport = {
        mode: 'region',
        left: options.region.left || 0,
        top: options.region.top || 0,
        width: options.region.width,
        height: options.region.height
      };
    } else if (options.aroundCursor !== undefined) {
      const n = options.aroundCursor;
      const cursorY = screen.cursor?.y || 0;
      viewport = {
        mode: 'aroundCursor',
        left: 0,
        top: Math.max(0, cursorY - n),
        width: terminal.width,
        height: Math.min(terminal.height, n * 2 + 1)
      };
    }
    
    // Convert to layered format
    const layers = convertToLayers(screen, options.layers || ['text', 'cursor']);
    
    // Apply viewport slicing
    if (viewport.mode !== 'full') {
      const endRow = Math.min(layers.text.length, viewport.top + viewport.height);
      
      // Slice text and other array-based layers
      const arrayLayers = ['text', 'fgColors', 'bgColors', 'styles', 'bold', 'italic', 'underline'];
      for (const layer of arrayLayers) {
        if (layers[layer]) {
          layers[layer] = layers[layer]
            .slice(viewport.top, endRow)
            .map(line => {
              if (typeof line === 'string' && viewport.left > 0) {
                return line.substring(viewport.left, viewport.left + viewport.width);
              }
              return line;
            });
        }
      }
    }
    
    // Build response
    const response = {
      terminal,
      viewport,
      ...layers
    };
    
    // Adjust cursor position
    if (layers.cursor) {
      response.cursor = {
        left: layers.cursor.x || 0,
        top: layers.cursor.y || 0,
        relLeft: (layers.cursor.x || 0) - viewport.left,
        relTop: (layers.cursor.y || 0) - viewport.top
      };
      
      // Mark cursor as outside viewport if necessary
      if (response.cursor.relLeft < 0 || response.cursor.relLeft >= viewport.width ||
          response.cursor.relTop < 0 || response.cursor.relTop >= viewport.height) {
        response.cursor.relLeft = -1;
        response.cursor.relTop = -1;
      }
    }
    
    // Apply compact mode if requested
    if (options.compact) {
      const nonEmptyIndices = [];
      response.text.forEach((line, idx) => {
        if (line.trim()) {
          nonEmptyIndices.push(idx);
        }
      });
      
      // Filter all array-based layers
      const arrayLayers = ['text', 'fgColors', 'bgColors', 'styles', 'bold', 'italic', 'underline'];
      for (const layer of arrayLayers) {
        if (response[layer]) {
          response[layer] = nonEmptyIndices.map(idx => response[layer][idx]);
        }
      }
    }
    
    return response;
  }
}