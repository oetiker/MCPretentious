/**
 * Terminal Utilities for MCPretentious
 * 
 * Shared utilities for terminal ID management and validation
 */

// Constants
export const TERMINAL_ID_PATTERN = /^iterm-(\d+)-(\d+)$/;
export const TERMINAL_ID_FORMAT = 'iterm-{windowId}-{tabIndex}';

/**
 * Generate terminal ID from window and tab
 */
export function generateTerminalId(windowId, tabIndex) {
  return `iterm-${windowId}-${tabIndex}`;
}

/**
 * Parse terminal ID into components
 */
export function parseTerminalId(terminalId) {
  const match = terminalId.match(TERMINAL_ID_PATTERN);
  if (!match) return null;
  return {
    windowId: match[1],
    tabIndex: parseInt(match[2])
  };
}

/**
 * Validate terminal ID format
 */
export function isValidTerminalId(terminalId) {
  return TERMINAL_ID_PATTERN.test(terminalId);
}

/**
 * Create standard success response
 */
export function successResponse(text) {
  return {
    content: [{ type: "text", text }]
  };
}

/**
 * Create standard error response
 */
export function errorResponse(message) {
  return {
    content: [{ type: "text", text: message }]
  };
}

/**
 * Validate terminal ID and return error response if invalid
 */
export function validateTerminalId(terminalId) {
  if (!isValidTerminalId(terminalId)) {
    return errorResponse(`Invalid terminal ID format. Expected format: ${TERMINAL_ID_FORMAT}`);
  }
  return null;
}

/**
 * Get session ID for terminal with validation
 */
export function getSessionForTerminal(terminalId, terminalToSessionMap) {
  // First validate format
  const validationError = validateTerminalId(terminalId);
  if (validationError) return { error: validationError };
  
  // Then check if terminal exists
  const sessionId = terminalToSessionMap.get(terminalId);
  if (!sessionId) {
    return { error: errorResponse(`Terminal ${terminalId} not found`) };
  }
  
  return { sessionId };
}

/**
 * Safely execute async operation with error handling
 */
export async function safeExecute(operation, errorPrefix = "Operation failed") {
  try {
    return await operation();
  } catch (error) {
    return errorResponse(`${errorPrefix}: ${error.message}`);
  }
}

/**
 * Parse session identifier to extract window and tab info
 */
export function parseSessionIdentifier(identifier) {
  const match = identifier?.match(/w(\d+):t(\d+):s(\d+)/);
  if (!match) return null;
  
  return {
    windowId: match[1],
    tabIndex: parseInt(match[2]) + 1, // Convert to 1-based
    sessionIndex: parseInt(match[3])
  };
}