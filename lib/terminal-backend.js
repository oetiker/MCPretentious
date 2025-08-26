/**
 * Abstract base class for terminal backends
 * Defines the common interface for iTerm2 and tmux implementations
 */

export class TerminalBackend {
  constructor() {
    if (this.constructor === TerminalBackend) {
      throw new Error("Cannot instantiate abstract class TerminalBackend");
    }
  }

  /**
   * Initialize the backend
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error("Method 'init' must be implemented");
  }

  /**
   * Check if this backend is available on the current system
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error("Method 'isAvailable' must be implemented");
  }

  /**
   * Get the backend name
   * @returns {string}
   */
  getName() {
    throw new Error("Method 'getName' must be implemented");
  }

  /**
   * Get the backend type identifier
   * @returns {string} 'iterm' or 'tmux'
   */
  getType() {
    throw new Error("Method 'getType' must be implemented");
  }

  /**
   * Create a new terminal session
   * @param {Object} options - Creation options
   * @param {number} options.columns - Width in columns
   * @param {number} options.rows - Height in rows
   * @returns {Promise<string>} Session ID
   */
  async createSession(options = {}) {
    throw new Error("Method 'createSession' must be implemented");
  }

  /**
   * Close a terminal session
   * @param {string} sessionId - Session to close
   * @returns {Promise<boolean>} Success status
   */
  async closeSession(sessionId) {
    throw new Error("Method 'closeSession' must be implemented");
  }

  /**
   * List all active sessions
   * @returns {Promise<Array>} List of sessions
   */
  async listSessions() {
    throw new Error("Method 'listSessions' must be implemented");
  }

  /**
   * Send text/keys to a terminal
   * @param {string} sessionId - Target session
   * @param {string} text - Text to send
   * @returns {Promise<boolean>} Success status
   */
  async sendText(sessionId, text) {
    throw new Error("Method 'sendText' must be implemented");
  }

  /**
   * Get terminal screen contents
   * @param {string} sessionId - Target session
   * @param {boolean} includeStyles - Include color/style information
   * @returns {Promise<Object>} Screen data
   */
  async getScreenContents(sessionId, includeStyles = false) {
    throw new Error("Method 'getScreenContents' must be implemented");
  }

  /**
   * Get session information
   * @param {string} sessionId - Target session
   * @returns {Promise<Object>} Session info
   */
  async getSessionInfo(sessionId) {
    throw new Error("Method 'getSessionInfo' must be implemented");
  }

  /**
   * Resize a terminal session
   * @param {string} sessionId - Target session
   * @param {number} columns - New width
   * @param {number} rows - New height
   * @returns {Promise<boolean>} Success status
   */
  async setSessionSize(sessionId, columns, rows) {
    throw new Error("Method 'setSessionSize' must be implemented");
  }

  /**
   * Get a property value from the session
   * @param {string} sessionId - Target session
   * @param {string} property - Property name
   * @returns {Promise<any>} Property value
   */
  async getProperty(sessionId, property) {
    throw new Error("Method 'getProperty' must be implemented");
  }

  /**
   * Clean up resources
   */
  async close() {
    // Default implementation - override if needed
  }

  /**
   * Validate a session ID for this backend
   * @param {string} sessionId - Session ID to validate
   * @returns {boolean} Whether the ID is valid
   */
  isValidSessionId(sessionId) {
    throw new Error("Method 'isValidSessionId' must be implemented");
  }

  /**
   * Parse a terminal ID to extract backend type and session ID
   * Terminal IDs follow format: {backend}:{sessionId}
   * @param {string} terminalId - Full terminal ID
   * @returns {Object|null} {backend, sessionId} or null if invalid
   */
  static parseTerminalId(terminalId) {
    if (!terminalId || typeof terminalId !== 'string') {
      return null;
    }

    // Support legacy iTerm2 format for backwards compatibility
    if (terminalId.startsWith('iterm-') && !terminalId.includes(':')) {
      // Legacy format: iterm-{uuid}
      return {
        backend: 'iterm',
        sessionId: terminalId
      };
    }

    // New format: {backend}:{sessionId}
    const parts = terminalId.split(':', 2);
    if (parts.length !== 2) {
      return null;
    }

    return {
      backend: parts[0],
      sessionId: parts[1]
    };
  }

  /**
   * Generate a terminal ID from backend type and session ID
   * @param {string} backend - Backend type ('iterm' or 'tmux')
   * @param {string} sessionId - Session ID
   * @returns {string} Full terminal ID
   */
  static generateTerminalId(backend, sessionId) {
    return `${backend}:${sessionId}`;
  }
}