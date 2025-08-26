/**
 * Simplified TMux Client using direct commands instead of control mode
 * This implementation uses execSync for simpler, more reliable operations
 */

import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

export class TmuxClientSimple {
  constructor() {
    this.sessionPrefix = 'mcp';
  }

  /**
   * Execute a tmux command
   * @param {Array<string>} args - Command arguments
   * @returns {string} Command output
   */
  executeCommand(args) {
    try {
      // Build command string, properly quoting arguments that contain special characters
      const quotedArgs = args.map(arg => {
        // Convert to string if not already
        const strArg = String(arg);
        // Always quote arguments that contain tmux format strings or special chars
        if (strArg.includes('#') || /[\s"'$`\\{}]/.test(strArg)) {
          return `'${strArg.replace(/'/g, "'\\''")}'`;
        }
        return strArg;
      });
      return execSync(`tmux ${quotedArgs.join(' ')}`, { encoding: 'utf8' });
    } catch (error) {
      // If tmux returns non-zero with no sessions, return empty
      if (error.status === 1 && error.message.includes('no server running')) {
        return '';
      }
      throw new Error(`tmux command failed: ${error.message}`);
    }
  }

  /**
   * Create a new tmux session
   * @param {number} columns - Width in columns
   * @param {number} rows - Height in rows
   * @returns {Promise<string>} Session ID
   */
  async createSession(columns = 80, rows = 24) {
    const sessionId = `${this.sessionPrefix}-${randomBytes(4).toString('hex')}`;
    
    try {
      // Create detached session with specified size
      this.executeCommand([
        'new-session',
        '-d',
        '-s', sessionId,
        '-x', columns,
        '-y', rows
      ]);
      
      return sessionId;
    } catch (error) {
      throw new Error(`Failed to create tmux session: ${error.message}`);
    }
  }

  /**
   * Close a tmux session
   * @param {string} sessionId - Session to close
   * @returns {Promise<boolean>} Success status
   */
  async closeSession(sessionId) {
    try {
      this.executeCommand(['kill-session', '-t', sessionId]);
      return true;
    } catch (error) {
      // Session might already be gone
      return false;
    }
  }

  /**
   * List tmux sessions
   * @returns {Promise<Array>} List of sessions
   */
  async listSessions() {
    try {
      const output = this.executeCommand([
        'list-sessions',
        '-F',
        '#{session_name}:#{session_attached}:#{session_windows}'
      ]);
      
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [name, attached, windows] = line.split(':');
        return {
          uniqueIdentifier: name,
          attached: attached === '1',
          windowCount: parseInt(windows) || 1
        };
      });
    } catch (error) {
      // No sessions
      return [];
    }
  }

  /**
   * Send text/keys to a tmux session
   * @param {string} sessionId - Target session
   * @param {string} text - Text to send
   * @returns {Promise<boolean>} Success status
   */
  async sendText(sessionId, text) {
    try {
      // Use -l flag to send literal text without shell interpretation
      this.executeCommand([
        'send-keys',
        '-t', sessionId,
        '-l',
        text
      ]);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to send text: ${error.message}`);
    }
  }

  /**
   * Send raw keys to a tmux session
   * @param {string} sessionId - Target session
   * @param {string} key - Key name (e.g., 'Enter', 'C-c')
   * @returns {Promise<boolean>} Success status
   */
  async sendKeys(sessionId, key) {
    try {
      this.executeCommand([
        'send-keys',
        '-t', sessionId,
        key
      ]);
      return true;
    } catch (error) {
      throw new Error(`Failed to send key: ${error.message}`);
    }
  }

  /**
   * Get screen contents from a tmux session
   * @param {string} sessionId - Target session
   * @param {boolean} includeStyles - Include ANSI escape sequences
   * @returns {Promise<Object>} Screen data
   */
  async getScreenContents(sessionId, includeStyles = false) {
    try {
      // Get cursor position
      const cursorOutput = this.executeCommand([
        'display-message',
        '-t', sessionId,
        '-p', '"#{cursor_x},#{cursor_y}"'
      ]);
      const [cursorX, cursorY] = cursorOutput.trim().split(',').map(Number);

      // Capture pane content
      const captureArgs = ['capture-pane', '-t', sessionId, '-p'];
      if (includeStyles) {
        captureArgs.push('-e'); // Preserve escape sequences
      }
      
      const content = this.executeCommand(captureArgs);
      const lines = content.split('\n');
      
      if (includeStyles) {
        // Parse ANSI codes to extract styles
        const { parseAnsiScreen } = await import('./ansi-parser.js');
        return parseAnsiScreen(lines, { x: cursorX, y: cursorY });
      } else {
        return {
          text: content,
          cursor: { x: cursorX, y: cursorY },
          lines: lines.map(text => ({ text }))
        };
      }
    } catch (error) {
      throw new Error(`Failed to get screen contents: ${error.message}`);
    }
  }

  /**
   * Get session information
   * @param {string} sessionId - Target session
   * @returns {Promise<Object>} Session info
   */
  async getSessionInfo(sessionId) {
    try {
      const output = this.executeCommand([
        'display-message',
        '-t', sessionId,
        '-p', '"#{session_name}:#{pane_width}:#{pane_height}:#{window_id}:#{pane_id}"'
      ]);
      
      const [name, width, height, windowId, paneId] = output.trim().split(':');
      
      return {
        sessionId: name || sessionId,
        windowId: windowId || '0',
        paneId: paneId || '0',
        dimensions: {
          columns: parseInt(width) || 80,
          rows: parseInt(height) || 24
        }
      };
    } catch (error) {
      throw new Error(`Failed to get session info: ${error.message}`);
    }
  }

  /**
   * Resize a tmux pane
   * @param {string} sessionId - Target session
   * @param {number} columns - New width
   * @param {number} rows - New height
   * @returns {Promise<boolean>} Success status
   */
  async resizePane(sessionId, columns, rows) {
    try {
      // Note: tmux doesn't directly support resizing to exact dimensions
      // We need to use refresh-client with -C flag
      this.executeCommand([
        'refresh-client',
        '-t', sessionId,
        '-C', `${columns},${rows}`
      ]);
      return true;
    } catch (error) {
      throw new Error(`Failed to resize pane: ${error.message}`);
    }
  }

  /**
   * Get a specific tmux property
   * @param {string} sessionId - Target session
   * @param {string} property - Property name
   * @returns {Promise<any>} Property value
   */
  async getTmuxProperty(sessionId, property) {
    try {
      const formatMap = {
        'grid_size': '#{pane_width}:#{pane_height}',
        'cursor_position': '#{cursor_x}:#{cursor_y}',
        'title': '#{pane_title}'
      };

      const format = formatMap[property];
      if (!format) {
        throw new Error(`Unknown property: ${property}`);
      }

      const output = this.executeCommand([
        'display-message',
        '-t', sessionId,
        '-p', `"${format}"`
      ]);

      const result = output.trim();
      
      // Parse based on property type
      if (property === 'grid_size') {
        const [width, height] = result.split(':').map(Number);
        // Return actual dimensions (no adjustment needed)
        return { width, height };
      } else if (property === 'cursor_position') {
        const [x, y] = result.split(':').map(Number);
        return { x, y };
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to get property ${property}: ${error.message}`);
    }
  }
}

// Export singleton instance
export const tmuxClient = new TmuxClientSimple();