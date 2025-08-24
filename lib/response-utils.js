/**
 * Response Utilities for MCPretentious
 * 
 * Common response handling and validation
 */

import { STATUS } from './constants.js';

/**
 * Check if a response indicates success
 * @param {Object} response - The response object
 * @param {string} responseType - The response type field name
 * @returns {boolean} True if successful
 */
export function isSuccessResponse(response, responseType) {
  if (!response || !response[responseType]) {
    return false;
  }
  
  const status = response[responseType].status;
  return status === STATUS.OK || status === STATUS.OK_NUMBER || status === undefined;
}

/**
 * Extract error message from response
 * @param {Object} response - The response object
 * @param {string} responseType - The response type field name
 * @param {string} defaultMessage - Default error message
 * @returns {string} Error message
 */
export function getErrorMessage(response, responseType, defaultMessage) {
  if (!response || !response[responseType]) {
    return defaultMessage;
  }
  
  const status = response[responseType].status;
  if (status && status !== STATUS.OK && status !== STATUS.OK_NUMBER) {
    return `${defaultMessage}: ${status}`;
  }
  
  return defaultMessage;
}

/**
 * Wrap async operation with standard error handling
 * @param {Function} operation - Async operation to execute
 * @param {string} errorMessage - Error message prefix
 * @returns {Promise<*>} Result of operation
 * @throws {Error} With formatted error message
 */
export async function withErrorHandling(operation, errorMessage) {
  try {
    return await operation();
  } catch (error) {
    // Don't double-wrap errors with good messages
    if (error.message?.includes('Python API') || 
        error.message?.includes('WebSocket API') ||
        error.message?.includes('authentication')) {
      throw error;
    }
    throw new Error(`${errorMessage}: ${error.message}`);
  }
}

/**
 * Validate and transform session ID if needed
 * @param {string} sessionId - The session ID
 * @param {boolean} needsPtyPrefix - Whether to add pty- prefix
 * @returns {string} Transformed session ID
 */
export function normalizeSessionId(sessionId, needsPtyPrefix = false) {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }
  
  if (needsPtyPrefix && !sessionId.startsWith('pty-')) {
    return `pty-${sessionId}`;
  }
  
  return sessionId;
}