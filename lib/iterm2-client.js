/**
 * iTerm2 WebSocket Client for MCPretentious
 * 
 * Provides high-performance terminal control via iTerm2's WebSocket API
 * - 20x faster than AppleScript
 * - Type-safe Protocol Buffer messaging
 * - No focus stealing
 */

import protobuf from 'protobufjs';
import WebSocket from 'ws';
import { dirname, join } from 'path';
import { homedir } from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parseLineWithStyles, getCharacterStyle } from './color-utils.js';
import { WS_CONFIG, ITERM_DEFAULTS, STATUS, PATHS, ERRORS } from './constants.js';
import { isSuccessResponse, getErrorMessage, withErrorHandling, normalizeSessionId } from './response-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Singleton instance
let clientInstance = null;

/**
 * iTerm2 WebSocket Client
 * Manages WebSocket connection and Protocol Buffer communication
 */
class ITerm2Client {
  constructor() {
    this.requestId = 1;
    this.ws = null;
    this.root = null;
    this.ClientOriginatedMessage = null;
    this.ServerOriginatedMessage = null;
    this.cookie = null;
    this.key = null;
    this.connected = false;
    this.sessionWindowMap = new Map(); // Track session -> window mapping
  }

  /**
   * Initialize the client by loading protobuf definitions and auth
   * @returns {Promise<ITerm2Client>} This client instance
   */
  async init() {
    try {
      // Load protocol buffer definitions
      const protoPath = join(__dirname, '..', 'proto', 'api.proto');
      this.root = await protobuf.load(protoPath);
      this.ClientOriginatedMessage = this.root.lookupType('iterm2.ClientOriginatedMessage');
      this.ServerOriginatedMessage = this.root.lookupType('iterm2.ServerOriginatedMessage');
      
      // Get authentication cookie and key
      const auth = this.getAuthCookie();
      this.cookie = auth.cookie;
      this.key = auth.key;
      
      return this;
    } catch (error) {
      // Don't double-wrap authentication errors
      if (error.message.includes('Python API')) {
        throw error;
      }
      throw new Error(`Failed to initialize iTerm2 client: ${error.message}`);
    }
  }

  /**
   * Check if auth is disabled via special file (like Python does)
   * @returns {boolean} True if authentication is disabled
   */
  isAuthDisabled() {
    const authDisableFile = join(homedir(), PATHS.AUTH_DISABLE_FILE);
    try {
      const stats = fs.statSync(authDisableFile, { followSymlinks: false });
      if (stats.uid !== 0) return false; // Must be owned by root
      
      const expected = Buffer.from(authDisableFile).toString('hex') + ' ' + PATHS.AUTH_MAGIC;
      
      if (stats.size !== expected.length) return false;
      
      const content = fs.readFileSync(authDisableFile, 'utf-8');
      return content === expected;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get authentication cookie and key from iTerm2
   * @returns {{cookie: string, key: string}} Authentication credentials
   */
  getAuthCookie() {
    // Check if auth is disabled (like Python does)
    if (this.isAuthDisabled()) {
      return {
        cookie: '',
        key: ''
      };
    }
    
    // Check environment first (reuse existing auth like Python does)
    if (process.env.ITERM2_COOKIE && process.env.ITERM2_KEY) {
      return {
        cookie: process.env.ITERM2_COOKIE,
        key: process.env.ITERM2_KEY
      };
    }
    
    // Get the script name for the auth request (like Python does)
    const scriptName = 'MCPretentious';
    
    // Request from iTerm2 via AppleScript with app name
    // Python format: 'tell application "iTerm2" to request cookie and key for app named "{name}"'
    const script = `tell application "iTerm2" to request cookie and key for app named "${scriptName}"`;
    
    try {
      const result = execSync(`osascript -e '${script}' 2>&1`, { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // Parse "cookie key" format
      const parts = result.trim().split(' ');
      if (parts.length === 2) {
        // Store in environment for reuse
        process.env.ITERM2_COOKIE = parts[0];
        process.env.ITERM2_KEY = parts[1];
        return {
          cookie: parts[0],
          key: parts[1]
        };
      }
    } catch (e) {
      // The cookie and key might be in the error output (this is normal iTerm2 behavior)
      const errorStr = e.stdout ? e.stdout.toString() : e.toString();
      
      // Try to extract cookie and key from error
      const match = errorStr.match(/([a-f0-9]{32})\s+([a-f0-9-]+)/);
      if (match) {
        // Store in environment for reuse
        process.env.ITERM2_COOKIE = match[1];
        process.env.ITERM2_KEY = match[2];
        return {
          cookie: match[1],
          key: match[2]
        };
      }
    }
    
    throw new Error(ERRORS.AUTH_FAILED);
  }

  /**
   * Connect to iTerm2 WebSocket API
   * @returns {Promise<ITerm2Client>} This client instance
   */
  async connect() {
    if (this.connected) return this;
    
    return new Promise((resolve, reject) => {
      // Use UID-based symlink to avoid conflicts
      const uid = process.getuid();
      const socketPath = `${WS_CONFIG.SOCKET_PREFIX}${uid}`;
      
      // Create symlink to actual socket location
      const actualSocketPath = join(homedir(), PATHS.SOCKET_PATH);
      
      // Check if the actual socket exists
      if (!fs.existsSync(actualSocketPath)) {
        reject(new Error(ERRORS.PYTHON_API_NOT_ENABLED));
        return;
      }
      
      try {
        // Check if symlink exists and is correct
        const linkStat = fs.lstatSync(socketPath);
        if (!linkStat.isSymbolicLink() || fs.readlinkSync(socketPath) !== actualSocketPath) {
          fs.unlinkSync(socketPath);
          fs.symlinkSync(actualSocketPath, socketPath);
        }
      } catch (err) {
        // Create symlink if it doesn't exist
        try {
          fs.symlinkSync(actualSocketPath, socketPath);
        } catch (symlinkErr) {
          // Non-fatal: continue without symlink
          console.warn('Could not create socket symlink:', symlinkErr.message);
        }
      }
      
      const socketUrl = `ws+unix:${socketPath}:/`;
      
      this.ws = new WebSocket(socketUrl, ['api.iterm2.com'], {
        headers: {
          'Origin': WS_CONFIG.HEADERS.ORIGIN,
          'x-iterm2-library-version': WS_CONFIG.HEADERS.LIBRARY_VERSION,
          'x-iterm2-cookie': this.cookie || '',
          'x-iterm2-key': this.key || '',
          'x-iterm2-advisory-name': WS_CONFIG.HEADERS.ADVISORY_NAME
        }
      });
      
      this.ws.on('open', () => {
        this.connected = true;
        resolve(this);
      });
      
      this.ws.on('error', (err) => {
        this.connected = false;
        // Provide more helpful error messages for common issues
        if (err.message.includes('ECONNREFUSED')) {
          reject(new Error(ERRORS.CONNECTION_REFUSED));
        } else if (err.message.includes('EACCES')) {
          reject(new Error(ERRORS.PERMISSION_DENIED));
        } else {
          reject(new Error(`WebSocket connection failed: ${err.message}`));
        }
      });
      
      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  /**
   * Send a request to iTerm2 and wait for response
   * @param {Object} request - The request object
   * @returns {Promise<Object>} The response from iTerm2
   */
  async sendRequest(request) {
    if (!this.connected) {
      await this.connect();
    }
    
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      
      // Verify the message before creating
      const messageData = {
        id: id,
        ...request
      };
      
      const verifyError = this.ClientOriginatedMessage.verify(messageData);
      if (verifyError) {
        console.error('Protobuf verification error:', verifyError);
        console.error('Message data:', JSON.stringify(messageData, null, 2));
        reject(new Error(`Invalid protobuf message: ${verifyError}`));
        return;
      }
      
      const message = this.ClientOriginatedMessage.create(messageData);
      
      // Encode with error handling
      let buffer;
      try {
        buffer = this.ClientOriginatedMessage.encode(message).finish();
        
        // Verify encoding by decoding back
        const decoded = this.ClientOriginatedMessage.decode(buffer);
        if (process.env.DEBUG) {
          console.log('Encoded message:', JSON.stringify(decoded, null, 2));
        }
      } catch (encodeError) {
        console.error('Protobuf encoding error:', encodeError);
        reject(encodeError);
        return;
      }
      
      const responseHandler = (data) => {
        try {
          const response = this.ServerOriginatedMessage.decode(new Uint8Array(data));
          if (response.id == id) {
            this.ws.removeListener('message', responseHandler);
            resolve(response);
          }
        } catch (err) {
          this.ws.removeListener('message', responseHandler);
          reject(err);
        }
      };
      
      this.ws.on('message', responseHandler);
      this.ws.send(buffer);
      
      // Timeout after configured duration
      setTimeout(() => {
        this.ws.removeListener('message', responseHandler);
        reject(new Error(ERRORS.REQUEST_TIMEOUT));
      }, WS_CONFIG.TIMEOUT_MS);
    });
  }

  // === Core API Methods ===
  
  /**
   * List all iTerm2 sessions
   * @returns {Promise<Array>} Array of session objects
   */
  async listSessions() {
    return withErrorHandling(async () => {
      const response = await this.sendRequest({
        listSessionsRequest: {}
      });
      
      // Extract sessions from the windows/tabs structure
      const sessions = [];
      const windows = response.listSessionsResponse?.windows || [];
      
      for (const window of windows) {
        for (const tab of window.tabs || []) {
          // Extract sessions from the tab's split tree
          const extractSessions = (node) => {
            if (node?.links) {
              for (const link of node.links) {
                if (link.session) {
                  sessions.push({
                    ...link.session,
                    windowId: window.windowId,
                    tabId: tab.tabId
                  });
                }
              }
            }
          };
          extractSessions(tab.root);
        }
      }
      
      return sessions;
    }, 'Failed to list sessions');
  }

  /**
   * Create a new tab in iTerm2
   * @param {string|null} windowId - Optional window ID
   * @param {string|null} profile - Optional profile name
   * @returns {Promise<string>} Session ID of created tab
   */
  async createTab(windowId = null, profile = null) {
    return withErrorHandling(async () => {
      const request = { createTabRequest: {} };
      
      if (windowId) {
        request.createTabRequest.window_id = windowId;
      }
      if (profile) {
        request.createTabRequest.profile = profile;
      }
      
      const response = await this.sendRequest(request);
      const sessionId = response.createTabResponse?.sessionId;
      
      // Try to find the window ID for this new session
      if (sessionId && !windowId) {
        try {
          // Wait a bit for the session to appear
          await new Promise(r => setTimeout(r, WS_CONFIG.RECONNECT_DELAY_MS));
          
          // List sessions to find the window
          const sessions = await this.listSessions();
          const session = sessions.find(s => s.uniqueIdentifier === sessionId);
          if (session?.windowId) {
            this.sessionWindowMap.set(sessionId, session.windowId);
          }
        } catch (error) {
          // Non-fatal: we can continue without the window mapping
          console.warn(`Could not map session to window: ${error.message}`);
        }
      } else if (sessionId && windowId) {
        this.sessionWindowMap.set(sessionId, windowId);
      }
      
      return sessionId;
    }, 'Failed to create tab');
  }

  /**
   * Send text to a terminal session
   * @param {string} session - Session ID
   * @param {string} text - Text to send
   * @returns {Promise<boolean>} True if successful
   */
  async sendText(session, text) {
    return withErrorHandling(async () => {
      const response = await this.sendRequest({
        sendTextRequest: { session, text }
      });
      if (process.env.DEBUG) {
        console.log('sendText response:', JSON.stringify(response, null, 2));
      }
      return isSuccessResponse(response, 'sendTextResponse');
    }, `Failed to send text to session ${session}`);
  }

  /**
   * Get buffer contents from a session
   * @param {string} session - Session ID
   * @param {Object|null} lineRange - Optional line range specification
   * @returns {Promise<Object>} Buffer response
   */
  async getBuffer(session, lineRange = null) {
    return withErrorHandling(async () => {
      // The getBuffer API requires 'pty-' prefix for UUID sessions
      const sessionId = normalizeSessionId(session, true);
      
      const request = { 
        getBufferRequest: { 
          session: sessionId,
          // Default to getting recent lines if no range specified
          lineRange: lineRange || {
            location: 0,
            length: 100
          }
        } 
      };
      
      const response = await this.sendRequest(request);
      return response?.getBufferResponse;
    }, `Failed to get buffer for session ${session}`);
  }

  /**
   * Get screen contents with full text, cursor position, colors and styles
   * This is the enhanced version that properly reads all screen data
   */
  async getScreenContents(session, includeStyles = true) {
    try {
      // Session ID should be used as-is for screen contents
      const sessionId = session;
      
      const response = await this.sendRequest({
        getBufferRequest: {
          session: sessionId,
          lineRange: {
            screenContentsOnly: true  // Get current screen contents
          },
          includeStyles  // Include color and style information
        }
      });
      
      const bufferResponse = response.getBufferResponse;
      if (!isSuccessResponse(response, 'getBufferResponse')) {
        throw new Error(getErrorMessage(response, 'getBufferResponse', 'Failed to get screen contents'));
      }
      
      // Parse lines with full style information
      const parsedLines = includeStyles 
        ? (bufferResponse.contents || []).map(line => parseLineWithStyles(line))
        : bufferResponse.contents || [];
      
      // Return parsed screen data with RGB colors
      return {
        lines: bufferResponse.contents || [],
        parsedLines,  // Lines with parsed RGB colors
        cursor: bufferResponse.cursor,  // {x: 8, y: 16}
        text: (bufferResponse.contents || []).map(line => line.text || '').join('\n'),
        styles: includeStyles ? (bufferResponse.contents || []).map(line => line.style) : null,
        // Helper method to get character at specific position with RGB colors
        getCharacterAt: (lineIndex, charIndex) => {
          if (!includeStyles || !bufferResponse.contents[lineIndex]) return null;
          return getCharacterStyle(bufferResponse.contents[lineIndex], charIndex);
        }
      };
    } catch (error) {
      throw new Error(`Failed to get screen contents for session ${session}: ${error.message}`);
    }
  }

  async closeSession(sessionId, force = false) {
    try {
      // Try to close the window containing this session
      const windowId = this.sessionWindowMap.get(sessionId);
      
      if (windowId) {
        // Close the entire window - use camelCase for protobuf.js
        const response = await this.sendRequest({
          closeRequest: {
            windows: {
              windowIds: [windowId]  // camelCase for protobuf.js!
            },
            force
          }
        });
        
        if (process.env.DEBUG) {
          console.log('Close window response:', JSON.stringify(response, null, 2));
        }
        
        // Clean up all sessions in this window
        for (const [sid, wid] of this.sessionWindowMap.entries()) {
          if (wid === windowId) {
            this.sessionWindowMap.delete(sid);
          }
        }
        
        // Check if it succeeded (response might be empty for success)
        return isSuccessResponse(response, 'closeResponse') || response.closeResponse !== undefined;
      } else {
        // Fallback: try to close just the session - use camelCase for protobuf.js
        const response = await this.sendRequest({
          closeRequest: {
            sessions: {
              sessionIds: [sessionId]  // camelCase for protobuf.js!
            },
            force
          }
        });
        
        if (process.env.DEBUG) {
          console.log('Close session response:', JSON.stringify(response, null, 2));
        }
        
        this.sessionWindowMap.delete(sessionId);
        
        return isSuccessResponse(response, 'closeResponse') || response.closeResponse !== undefined;
      }
    } catch (error) {
      throw new Error(`Failed to close session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * Get the command prompt from a session
   * @param {string} session - Session ID
   * @returns {Promise<Object>} Prompt response
   */
  async getPrompt(session) {
    return withErrorHandling(async () => {
      const response = await this.sendRequest({
        getPromptRequest: { session }
      });
      return response.getPromptResponse;
    }, `Failed to get prompt for session ${session}`);
  }

  /**
   * Split a pane in the terminal
   * @param {string} session - Session ID
   * @param {boolean} vertical - True for vertical split, false for horizontal
   * @returns {Promise<string>} New session ID
   */
  async splitPane(session, vertical = true) {
    return withErrorHandling(async () => {
      const response = await this.sendRequest({
        splitPaneRequest: { session, vertical }
      });
      const sessionId = response.splitPaneResponse?.sessionId;
      return Array.isArray(sessionId) ? sessionId[0] : sessionId;
    }, `Failed to split pane for session ${session}`);
  }

  /**
   * Set the terminal size for a session
   * @param {string} sessionId - Session ID
   * @param {number} columns - Number of columns (width)
   * @param {number} rows - Number of rows (height)
   * @returns {Promise<boolean>} True if successful
   */
  async setSessionSize(sessionId, columns, rows) {
    return withErrorHandling(async () => {
      const response = await this.sendRequest({
        setPropertyRequest: {
          sessionId: sessionId,
          name: 'grid_size',
          jsonValue: JSON.stringify({ width: columns, height: rows })
        }
      });
      
      if (!isSuccessResponse(response, 'setPropertyResponse')) {
        throw new Error(getErrorMessage(response, 'setPropertyResponse', 'Failed to resize'));
      }
      
      return true;
    }, `Failed to resize session ${sessionId}`);
  }

  /**
   * Get information about a session including dimensions
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session information
   */
  async getSessionInfo(sessionId) {
    return withErrorHandling(async () => {
      // Get screen to get dimensions
      const screen = await this.getScreenContents(sessionId, false);
      
      // Get window ID from our map
      const windowId = this.sessionWindowMap.get(sessionId);
      
      return {
        sessionId,
        windowId: windowId || null,
        dimensions: {
          columns: ITERM_DEFAULTS.COLUMNS, // Default, would need to query actual
          rows: screen.lines ? screen.lines.length : ITERM_DEFAULTS.ROWS
        }
      };
    }, `Failed to get session info for ${sessionId}`);
  }

  // === Helper Methods ===
  
  /**
   * Get window ID for a session
   * @param {string} sessionId - Session ID
   * @returns {string|undefined} Window ID if found
   */
  getWindowForSession(sessionId) {
    return this.sessionWindowMap.get(sessionId);
  }

  /**
   * Close the WebSocket connection
   */
  close() {
    if (this.ws) {
      try {
        this.ws.close();
        this.connected = false;
      } catch (err) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Get singleton client instance
 * @returns {Promise<ITerm2Client>} The client instance
 */
export async function getClient() {
  if (!clientInstance) {
    try {
      clientInstance = new ITerm2Client();
      await clientInstance.init();
      await clientInstance.connect();
    } catch (error) {
      clientInstance = null; // Reset on failure
      // Don't double-wrap errors that already have good messages
      if (error.message.includes('Python API') || error.message.includes('WebSocket API')) {
        throw error;
      }
      throw new Error(`Failed to get iTerm2 client: ${error.message}`);
    }
  }
  return clientInstance;
}

// Export class for testing
export { ITerm2Client };