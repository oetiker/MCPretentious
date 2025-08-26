/**
 * Backend Manager for MCPretentious
 * Handles backend selection, auto-detection, and session routing
 */

import { TerminalBackend } from './terminal-backend.js';
import { ITerm2Backend } from './iterm2-backend.js';
import { TmuxBackend } from './tmux-backend.js';

class BackendManager {
  constructor() {
    this.backends = new Map();
    this.availableBackends = new Map(); // For API mode
    this.defaultBackend = null;
    this.initialized = false;
    this.apiMode = false;
    this.noBackendsAvailable = false; // Track if no backends are available
  }

  /**
   * Initialize the backend manager
   * @param {string} preferredBackend - Preferred backend ('iterm', 'tmux', or 'auto')
   * @returns {Promise<void>}
   */
  async init(preferredBackend = 'auto') {
    if (this.initialized) {
      return;
    }

    // Register available backends
    this.backends.set('iterm', new ITerm2Backend());
    this.backends.set('tmux', new TmuxBackend());

    // Determine which backend to use
    if (preferredBackend === 'auto') {
      this.defaultBackend = await this.autoDetectBackend();
    } else {
      const backend = this.backends.get(preferredBackend);
      if (backend && await backend.isAvailable()) {
        await backend.init();
        this.defaultBackend = backend;
      } else {
        throw new Error(`Backend '${preferredBackend}' is not available`);
      }
    }

    if (!this.defaultBackend) {
      // No backends available - initialize in degraded mode
      this.noBackendsAvailable = true;
      console.error('Warning: No terminal backends available. Tools will return errors.');
    }

    this.initialized = true;
    this.apiMode = false;
  }

  /**
   * Initialize in API mode - backends selected per session
   * @returns {Promise<void>}
   */
  async initApiMode() {
    if (this.initialized) {
      return;
    }

    // Register all backends
    this.backends.set('iterm', new ITerm2Backend());
    this.backends.set('tmux', new TmuxBackend());

    // Check which backends are available
    for (const [type, backend] of this.backends) {
      if (await backend.isAvailable()) {
        try {
          await backend.init();
          this.availableBackends.set(type, backend);
        } catch (error) {
          console.error(`Failed to initialize ${type}: ${error.message}`);
        }
      }
    }

    if (this.availableBackends.size === 0) {
      // No backends available - initialize in degraded mode
      this.noBackendsAvailable = true;
      console.error('Warning: No terminal backends available. Tools will return errors.');
    } else {
      // Set a default for non-open operations
      this.defaultBackend = this.availableBackends.values().next().value;
    }

    this.initialized = true;
    this.apiMode = true;
  }

  /**
   * Auto-detect the best available backend
   * @returns {Promise<TerminalBackend>} The selected backend
   */
  async autoDetectBackend() {
    // Priority order: iTerm2 (if on macOS), then tmux
    const priority = ['iterm', 'tmux'];
    
    for (const backendType of priority) {
      const backend = this.backends.get(backendType);
      if (backend && await backend.isAvailable()) {
        try {
          await backend.init();
          return backend;
        } catch (error) {
          console.error(`Failed to initialize ${backendType}: ${error.message}`);
        }
      }
    }
    
    return null;
  }

  /**
   * Get backend for a terminal ID
   * @param {string} terminalId - Terminal ID
   * @returns {TerminalBackend} The appropriate backend
   */
  getBackendForTerminal(terminalId) {
    if (!this.initialized) {
      throw new Error('Backend manager not initialized');
    }

    // Parse terminal ID to determine backend
    const parsed = TerminalBackend.parseTerminalId(terminalId);
    
    if (!parsed) {
      throw new Error(`Invalid terminal ID format: ${terminalId}. Expected format: backend:sessionId`);
    }
    
    const backend = this.backends.get(parsed.backend);
    if (!backend) {
      throw new Error(`Unknown backend '${parsed.backend}' in terminal ID: ${terminalId}`);
    }
    
    return backend;
  }

  /**
   * Check if any backends are available
   * @returns {boolean}
   */
  hasBackends() {
    return !this.noBackendsAvailable && this.defaultBackend !== null;
  }

  /**
   * Get error message for no backends available
   * @returns {string}
   */
  getNoBackendError() {
    return 'No terminal backend is available on this system. Please install either iTerm2 (macOS) or tmux to use terminal features. For iTerm2: Enable Python API in Preferences → General → Magic. For tmux: Install with your package manager (brew install tmux, apt install tmux, etc.).';
  }

  /**
   * Get the default backend
   * @returns {TerminalBackend}
   */
  getDefaultBackend() {
    if (!this.initialized) {
      throw new Error('Backend manager not initialized');
    }
    if (this.noBackendsAvailable) {
      return null;
    }
    return this.defaultBackend;
  }

  /**
   * Create a new terminal session
   * @param {Object} options - Creation options
   * @returns {Promise<string>} Terminal ID
   * @throws {Error} If no backends are available
   */
  async createSession(options = {}) {
    if (this.noBackendsAvailable) {
      throw new Error(this.getNoBackendError());
    }
    // In API mode with explicit backend selection
    if (this.apiMode && options.backend) {
      const backend = this.availableBackends.get(options.backend);
      if (!backend) {
        throw new Error(`Backend '${options.backend}' is not available. Available: ${Array.from(this.availableBackends.keys()).join(', ')}`);
      }
      // Remove backend from options before passing to backend
      const { backend: _, ...backendOptions } = options;
      return await backend.createSession(backendOptions);
    }
    
    // Default behavior
    const backend = this.getDefaultBackend();
    return await backend.createSession(options);
  }

  /**
   * Get list of available backends (for API mode)
   * @returns {Array<string>} List of available backend types
   */
  getAvailableBackends() {
    if (this.apiMode) {
      return Array.from(this.availableBackends.keys());
    }
    return this.defaultBackend ? [this.defaultBackend.getType()] : [];
  }

  /**
   * Check if in API mode
   * @returns {boolean}
   */
  isApiMode() {
    return this.apiMode;
  }

  /**
   * Close a terminal session
   * @param {string} terminalId - Terminal to close
   * @returns {Promise<boolean>} Success status
   */
  async closeSession(terminalId) {
    const backend = this.getBackendForTerminal(terminalId);
    return await backend.closeSession(terminalId);
  }

  /**
   * List all sessions across all backends
   * @returns {Promise<Array>} Combined session list
   */
  async listSessions() {
    const allSessions = [];
    
    for (const [type, backend] of this.backends) {
      try {
        if (await backend.isAvailable()) {
          const sessions = await backend.listSessions();
          allSessions.push(...sessions);
        }
      } catch (error) {
        console.error(`Failed to list ${type} sessions: ${error.message}`);
      }
    }
    
    return allSessions;
  }

  /**
   * Send text to a terminal
   * @param {string} terminalId - Target terminal
   * @param {string} text - Text to send
   * @returns {Promise<boolean>} Success status
   * @throws {Error} If no backends are available
   */
  async sendText(terminalId, text) {
    if (this.noBackendsAvailable) {
      throw new Error(this.getNoBackendError());
    }
    const backend = this.getBackendForTerminal(terminalId);
    return await backend.sendText(terminalId, text);
  }

  /**
   * Get screen contents from a terminal
   * @param {string} terminalId - Target terminal
   * @param {boolean} includeStyles - Include style information
   * @returns {Promise<Object>} Screen data
   * @throws {Error} If no backends are available
   */
  async getScreenContents(terminalId, includeStyles = false) {
    if (this.noBackendsAvailable) {
      throw new Error(this.getNoBackendError());
    }
    const backend = this.getBackendForTerminal(terminalId);
    return await backend.getScreenContents(terminalId, includeStyles);
  }

  /**
   * Get session information
   * @param {string} terminalId - Target terminal
   * @returns {Promise<Object>} Session info
   */
  async getSessionInfo(terminalId) {
    const backend = this.getBackendForTerminal(terminalId);
    return await backend.getSessionInfo(terminalId);
  }

  /**
   * Resize a terminal
   * @param {string} terminalId - Target terminal
   * @param {number} columns - New width
   * @param {number} rows - New height
   * @returns {Promise<boolean>} Success status
   */
  async setSessionSize(terminalId, columns, rows) {
    const backend = this.getBackendForTerminal(terminalId);
    return await backend.setSessionSize(terminalId, columns, rows);
  }

  /**
   * Get a property from a terminal
   * @param {string} terminalId - Target terminal
   * @param {string} property - Property name
   * @returns {Promise<any>} Property value
   */
  async getProperty(terminalId, property) {
    const backend = this.getBackendForTerminal(terminalId);
    return await backend.getProperty(terminalId, property);
  }

  /**
   * Get screenshot in layered format
   * @param {string} terminalId - Target terminal
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>} Layered screenshot data
   */
  async getScreenshot(terminalId, options = {}) {
    const backend = this.getBackendForTerminal(terminalId);
    
    // TMux backend has dedicated screenshot method
    if (backend instanceof TmuxBackend) {
      return await backend.getScreenshot(terminalId, options);
    }
    
    // iTerm2 backend uses the existing flow
    // This will be handled in mcpretentious.js
    throw new Error('Screenshot should be handled by mcpretentious.js for iTerm2');
  }

  /**
   * Check if a terminal exists
   * @param {string} terminalId - Terminal to check
   * @returns {Promise<boolean>}
   */
  async sessionExists(terminalId) {
    try {
      const backend = this.getBackendForTerminal(terminalId);
      return await backend.sessionExists(terminalId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up all backends
   */
  async close() {
    for (const backend of this.backends.values()) {
      await backend.close();
    }
    this.backends.clear();
    this.defaultBackend = null;
    this.initialized = false;
  }
}

// Export singleton instance
export const backendManager = new BackendManager();