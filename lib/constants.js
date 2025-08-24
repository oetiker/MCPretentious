/**
 * Constants for MCPretentious
 * 
 * Central configuration and constants management
 */

// WebSocket configuration
export const WS_CONFIG = {
  TIMEOUT_MS: 3000,
  RECONNECT_DELAY_MS: 100,
  SOCKET_PREFIX: '/tmp/iterm2-socket-',
  HEADERS: {
    ORIGIN: 'ws://localhost/',
    LIBRARY_VERSION: 'node 0.1.0',
    ADVISORY_NAME: 'MCPretentious'
  }
};

// iTerm2 defaults
export const ITERM_DEFAULTS = {
  COLUMNS: 80,
  ROWS: 24,
  MAX_COLUMNS: 500,
  MAX_ROWS: 200,
  MIN_COLUMNS: 20,
  MIN_ROWS: 5
};

// Status codes
export const STATUS = {
  OK: 'OK',
  OK_NUMBER: 0,
  ERROR: 'ERROR'
};

// File paths
export const PATHS = {
  AUTH_DISABLE_FILE: 'Library/Application Support/iTerm2/disable-automation-auth',
  SOCKET_PATH: 'Library/Application Support/iTerm2/private/socket',
  AUTH_MAGIC: '61DF88DC-3423-4823-B725-22570E01C027'
};

// Error messages
export const ERRORS = {
  PYTHON_API_NOT_ENABLED: 'iTerm2 WebSocket API socket not found. Make sure:\n1. iTerm2 is running\n2. Python API is enabled in iTerm2 Preferences > General > Magic',
  AUTH_FAILED: 'Failed to get iTerm2 authentication. Make sure:\n1. iTerm2 Python API is enabled in Preferences > General > Magic\n2. You have allowed this app when prompted for API access\n3. iTerm2 is running',
  CONNECTION_REFUSED: 'Cannot connect to iTerm2 WebSocket API. Make sure:\n1. iTerm2 is running\n2. Python API is enabled in iTerm2 Preferences > General > Magic',
  PERMISSION_DENIED: 'Permission denied accessing iTerm2 socket. Try running with appropriate permissions.',
  REQUEST_TIMEOUT: 'Request timeout'
};