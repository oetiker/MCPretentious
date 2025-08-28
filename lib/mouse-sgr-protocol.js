/**
 * SGR (Select Graphic Rendition) Mouse Protocol utilities
 * Shared implementation for generating mouse escape sequences
 * Used by both iTerm2 and tmux backends
 */

const BUTTON_CODES = {
  'left': 0,
  'middle': 1,
  'right': 2
};

const SCROLL_CODES = {
  'up': 64,
  'down': 65
};

const DRAG_MODIFIER = 32; // Add to button code for drag motion

/**
 * Generate mouse click escape sequences (press and release)
 * @param {number} x - X coordinate (0-based)
 * @param {number} y - Y coordinate (0-based)
 * @param {string} button - Mouse button ('left', 'middle', 'right')
 * @returns {Object} Object with press and release sequences
 */
function generateMouseClick(x, y, button = 'left') {
  const buttonCode = BUTTON_CODES[button] || 0;
  
  // Convert to 1-based coordinates for SGR protocol
  const protocolX = x + 1;
  const protocolY = y + 1;
  
  return {
    press: `\x1b[<${buttonCode};${protocolX};${protocolY}M`,
    release: `\x1b[<${buttonCode};${protocolX};${protocolY}m`
  };
}

/**
 * Generate mouse drag escape sequences
 * @param {number} startX - Starting X coordinate (0-based)
 * @param {number} startY - Starting Y coordinate (0-based)
 * @param {number} endX - Ending X coordinate (0-based)
 * @param {number} endY - Ending Y coordinate (0-based)
 * @param {string} button - Mouse button to drag with ('left', 'middle', 'right')
 * @returns {Object} Object with press, drag, and release sequences
 */
function generateMouseDrag(startX, startY, endX, endY, button = 'left') {
  const buttonCode = BUTTON_CODES[button] || 0;
  const dragCode = buttonCode + DRAG_MODIFIER;
  
  // Convert to 1-based coordinates
  const startProtocolX = startX + 1;
  const startProtocolY = startY + 1;
  const endProtocolX = endX + 1;
  const endProtocolY = endY + 1;
  
  return {
    press: `\x1b[<${buttonCode};${startProtocolX};${startProtocolY}M`,
    drag: `\x1b[<${dragCode};${endProtocolX};${endProtocolY}M`,
    release: `\x1b[<${buttonCode};${endProtocolX};${endProtocolY}m`
  };
}

/**
 * Generate mouse scroll escape sequence
 * @param {number} x - X coordinate (0-based)
 * @param {number} y - Y coordinate (0-based)
 * @param {string} direction - Scroll direction ('up' or 'down')
 * @returns {string} Scroll escape sequence
 */
function generateMouseScroll(x, y, direction) {
  const scrollCode = SCROLL_CODES[direction] || SCROLL_CODES['down'];
  
  // Convert to 1-based coordinates
  const protocolX = x + 1;
  const protocolY = y + 1;
  
  // Scroll events only need the press event, no release
  return `\x1b[<${scrollCode};${protocolX};${protocolY}M`;
}

export {
  generateMouseClick,
  generateMouseDrag,
  generateMouseScroll,
  BUTTON_CODES,
  SCROLL_CODES,
  DRAG_MODIFIER
};