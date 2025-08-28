/**
 * iTerm2 backend implementation for MCPretentious
 * Uses WebSocket API with Protocol Buffers for high-performance terminal control
 */

import { TerminalBackend } from './terminal-backend.js';
import { getClient } from './iterm2-client.js';
import { getCurrentFocus, restoreFocus } from './focus-manager.js';
import { ITERM_DEFAULTS } from './constants.js';
import { execSync } from 'child_process';
import { platform } from 'os';
import { generateMouseEvent } from './mouse-sgr-protocol.js';

export class ITerm2Backend extends TerminalBackend {
  constructor() {
    super();
    this.client = null;
  }

  async init() {
    if (!this.client) {
      this.client = await getClient();
    }
    return this.client;
  }

  async isAvailable() {
    // iTerm2 only available on macOS
    if (platform() !== 'darwin') {
      return false;
    }

    try {
      // Check if iTerm2 is installed
      execSync('osascript -e \'tell application "System Events" to name of application processes\' | grep -q iTerm', {
        stdio: 'ignore'
      });
      
      // Try to initialize client to verify API is enabled
      await this.init();
      return true;
    } catch (error) {
      return false;
    }
  }

  getName() {
    return 'iTerm2';
  }

  getType() {
    return 'iterm';
  }

  async createSession(options = {}) {
    await this.init();
    
    const columns = options.columns || ITERM_DEFAULTS.COLUMNS;
    const rows = options.rows || ITERM_DEFAULTS.ROWS;
    
    // Store current focus to restore later
    const previousFocus = await getCurrentFocus();
    
    // Create new tab (passing null for windowId creates a new window)
    // TODO: In the future, we should properly handle window creation with dimensions
    const sessionId = await this.client.createTab(null, null);
    
    if (!sessionId) {
      throw new Error('Failed to create iTerm2 session');
    }
    
    // Note: columns and rows parameters are currently ignored for iTerm2
    // iTerm2's createTab doesn't support setting dimensions directly
    
    // Restore focus to previous application
    if (previousFocus) {
      await restoreFocus(previousFocus);
    }
    
    // Return terminal ID in new format
    return TerminalBackend.generateTerminalId('iterm', sessionId);
  }

  async closeSession(sessionId) {
    await this.init();
    
    // Extract actual session ID if full terminal ID was passed
    const parsed = TerminalBackend.parseTerminalId(sessionId);
    const actualSessionId = parsed ? parsed.sessionId : sessionId;
    
    return await this.client.closeSession(actualSessionId, true);
  }

  async listSessions() {
    await this.init();
    
    const sessions = await this.client.listSessions();
    
    // Convert to terminal IDs
    return sessions.map(session => ({
      terminalId: TerminalBackend.generateTerminalId('iterm', session.uniqueIdentifier),
      sessionId: session.uniqueIdentifier,
      backend: this.getName()
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
    
    return await this.client.getScreenContents(actualSessionId, includeStyles);
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
    await this.client.sendText(actualSessionId, sequence);
    
    return true;
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
    
    // iTerm2 uses UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(actualSessionId);
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
}