/**
 * TMux Client for MCPretentious
 * 
 * Provides terminal control via tmux control mode
 * - Cross-platform support (Linux, macOS, BSD)
 * - No authentication required
 * - Structured JSON output matching iTerm2 format
 */

import { spawn } from 'child_process';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

// Singleton instance
let clientInstance = null;

/**
 * TMux Client
 * Manages tmux control mode communication
 */
class TmuxClient {
  constructor() {
    this.sessions = new Map(); // session ID -> control process
    this.initialized = false;
  }

  /**
   * Initialize the client
   * @returns {Promise<TmuxClient>} This client instance
   */
  async init() {
    if (this.initialized) {
      return this;
    }

    // Verify tmux is available with -V flag instead of version command
    try {
      await this.executeCommand(['-V']);
      this.initialized = true;
    } catch (error) {
      throw new Error(`TMux not available: ${error.message}`);
    }

    return this;
  }

  /**
   * Execute a tmux command
   * @param {Array} args - Command arguments
   * @returns {Promise<string>} Command output
   */
  executeCommand(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn('tmux', args);
      let output = '';
      let error = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(error || `tmux exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Execute a control mode command for a session
   * @param {string} sessionId - TMux session name
   * @param {string} command - Command to execute
   * @returns {Promise<Array>} Command output lines
   */
  async executeControlCommand(sessionId, command) {
    return new Promise((resolve, reject) => {
      const tmux = spawn('tmux', ['-C', 'attach-session', '-t', sessionId]);
      const rl = readline.createInterface({
        input: tmux.stdout,
        crlfDelay: Infinity
      });

      let capturing = false;
      const lines = [];
      let timeout;

      rl.on('line', (line) => {
        if (line.startsWith('%begin')) {
          capturing = true;
        } else if (line.startsWith('%end')) {
          capturing = false;
          clearTimeout(timeout);
          tmux.stdin.write('exit\n');
          resolve(lines);
        } else if (line.startsWith('%error')) {
          clearTimeout(timeout);
          tmux.stdin.write('exit\n');
          reject(new Error(line.substring(7)));
        } else if (capturing && !line.startsWith('%')) {
          lines.push(line);
        }
      });

      tmux.on('error', reject);

      // Send command after connection
      setTimeout(() => {
        tmux.stdin.write(command + '\n');
        
        // Timeout if no response
        timeout = setTimeout(() => {
          tmux.kill();
          reject(new Error('Command timeout'));
        }, 5000);
      }, 100);
    });
  }

  /**
   * Create a new tmux session
   * @param {number} columns - Width in columns
   * @param {number} rows - Height in rows
   * @returns {Promise<string>} Session ID
   */
  async createSession(columns = 80, rows = 24) {
    // Generate unique session name
    const sessionId = `mcp-${uuidv4().substring(0, 8)}`;
    
    try {
      // Create detached session with specified size
      await this.executeCommand([
        'new-session',
        '-d',
        '-s', sessionId,
        '-x', columns.toString(),
        '-y', rows.toString()
      ]);

      return sessionId;
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  /**
   * Close a tmux session
   * @param {string} sessionId - Session to close
   * @returns {Promise<boolean>} Success status
   */
  async closeSession(sessionId) {
    try {
      await this.executeCommand(['kill-session', '-t', sessionId]);
      return true;
    } catch (error) {
      // Session might already be closed
      return false;
    }
  }

  /**
   * List all tmux sessions
   * @returns {Promise<Array>} List of sessions
   */
  async listSessions() {
    try {
      const output = await this.executeCommand([
        'list-sessions',
        '-F', '#{session_name}:#{session_created}:#{session_attached}:#{session_windows}'
      ]);

      if (!output) {
        return [];
      }

      return output.split('\n').map(line => {
        const [name, created, attached, windows] = line.split(':');
        return {
          uniqueIdentifier: name,
          created: parseInt(created),
          attached: attached === '1',
          windowCount: parseInt(windows)
        };
      });
    } catch (error) {
      // No sessions
      return [];
    }
  }

  /**
   * Send text to a session
   * @param {string} sessionId - Target session
   * @param {string} text - Text to send
   * @returns {Promise<boolean>} Success status
   */
  async sendText(sessionId, text) {
    try {
      // Escape special characters for tmux
      const escaped = text.replace(/\$/g, '\\$')
                         .replace(/"/g, '\\"')
                         .replace(/`/g, '\\`');
      
      await this.executeCommand([
        'send-keys',
        '-t', `${sessionId}:0.0`,
        escaped
      ]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get screen contents from a session
   * @param {string} sessionId - Target session
   * @param {boolean} includeStyles - Include ANSI codes for styles
   * @returns {Promise<Object>} Screen data
   */
  async getScreenContents(sessionId, includeStyles = false) {
    try {
      // Get cursor position
      const cursorOutput = await this.executeControlCommand(sessionId,
        `display-message -p "#{cursor_x},#{cursor_y}"`
      );
      const [cursorX, cursorY] = cursorOutput[0]?.split(',').map(Number) || [0, 0];

      // Capture pane content
      const captureCmd = includeStyles 
        ? 'capture-pane -e -p'  // -e preserves escape sequences
        : 'capture-pane -p';
      
      const lines = await this.executeControlCommand(sessionId, captureCmd);
      
      if (includeStyles) {
        // Parse ANSI codes to extract styles
        const { parseAnsiScreen } = await import('./ansi-parser.js');
        return parseAnsiScreen(lines, { x: cursorX, y: cursorY });
      } else {
        return {
          text: lines.join('\n'),
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
      const output = await this.executeControlCommand(sessionId,
        'display-message -p "#{session_name}:#{pane_width}:#{pane_height}:#{window_id}:#{pane_id}"'
      );
      
      const [name, width, height, windowId, paneId] = output[0]?.split(':') || [];
      
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
   * Resize a session
   * @param {string} sessionId - Target session
   * @param {number} columns - New width
   * @param {number} rows - New height
   * @returns {Promise<boolean>} Success status
   */
  async setSessionSize(sessionId, columns, rows) {
    try {
      await this.executeCommand([
        'resize-pane',
        '-t', `${sessionId}:0.0`,
        '-x', columns.toString(),
        '-y', rows.toString()
      ]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get a property value from the session
   * @param {string} sessionId - Target session
   * @param {string} property - Property name
   * @returns {Promise<any>} Property value
   */
  async getProperty(sessionId, property) {
    try {
      const propertyMap = {
        'grid_size': '#{pane_width}:#{pane_height}',
        'cursor_position': '#{cursor_x}:#{cursor_y}',
        'pane_id': '#{pane_id}',
        'window_id': '#{window_id}',
        'session_name': '#{session_name}'
      };

      const format = propertyMap[property];
      if (!format) {
        throw new Error(`Unknown property: ${property}`);
      }

      const output = await this.executeControlCommand(sessionId,
        `display-message -p "${format}"`
      );

      const result = output[0];
      
      // Parse based on property type
      if (property === 'grid_size') {
        const [width, height] = result.split(':').map(Number);
        // Note: tmux dimensions are already the full size
        return { width: width - 1, height: height - 1 };
      } else if (property === 'cursor_position') {
        const [x, y] = result.split(':').map(Number);
        return { x, y };
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to get property: ${error.message}`);
    }
  }

  /**
   * Clean up resources
   */
  close() {
    // Kill any active control sessions
    for (const [sessionId, proc] of this.sessions) {
      if (proc && !proc.killed) {
        proc.kill();
      }
    }
    this.sessions.clear();
  }
}

/**
 * Get singleton client instance
 * @returns {Promise<TmuxClient>} TMux client instance
 */
export async function getClient() {
  if (!clientInstance) {
    clientInstance = new TmuxClient();
    await clientInstance.init();
  }
  return clientInstance;
}