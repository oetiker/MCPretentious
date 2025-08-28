/**
 * SGR (Select Graphic Rendition) Mouse Protocol utilities
 * Shared implementation for generating mouse escape sequences
 * Used by both iTerm2 and tmux backends
 */

// Button code mappings for named buttons
const BUTTON_CODES = {
  'left': 0,
  'middle': 1,
  'right': 2,
  'scrollUp': 64,
  'scrollDown': 65
};

// Modifier key bits
const MODIFIERS = {
  'shift': 4,
  'alt': 8,
  'ctrl': 16
};

// Special event modifiers
const DRAG_MODIFIER = 32; // Add to button code for drag motion

/**
 * Generate SGR mouse escape sequence for any event
 * This is the main function that handles the MCP API format
 * @param {string} event - Event type ('press', 'release', 'drag')
 * @param {number} x - X coordinate (0-based)
 * @param {number} y - Y coordinate (0-based)
 * @param {number|string} button - Button code (0-127) or named button
 * @param {Object} modifiers - Modifier keys ({shift: bool, alt: bool, ctrl: bool})
 * @returns {string} SGR escape sequence
 */
function generateMouseEvent(event, x, y, button, modifiers = {}) {
  // Parse button to get numeric code
  let buttonCode;
  if (typeof button === 'number') {
    buttonCode = button;
  } else if (typeof button === 'string') {
    if (button in BUTTON_CODES) {
      buttonCode = BUTTON_CODES[button];
    } else if (button.startsWith('button-')) {
      buttonCode = parseInt(button.slice(7));
      if (isNaN(buttonCode) || buttonCode < 0 || buttonCode > 127) {
        throw new Error(`Invalid button code: ${button}`);
      }
    } else {
      throw new Error(`Invalid button: ${button}`);
    }
  } else {
    throw new Error(`Invalid button type: ${typeof button}`);
  }
  
  // Apply modifiers
  if (modifiers.shift) buttonCode += MODIFIERS.shift;
  if (modifiers.alt) buttonCode += MODIFIERS.alt;
  if (modifiers.ctrl) buttonCode += MODIFIERS.ctrl;
  
  // Apply drag modifier for drag events
  if (event === 'drag') {
    buttonCode += DRAG_MODIFIER;
  }
  
  // Convert to 1-based coordinates for SGR protocol
  const protocolX = x + 1;
  const protocolY = y + 1;
  
  // Event suffix: 'M' for press/drag, 'm' for release
  const suffix = event === 'release' ? 'm' : 'M';
  
  // Return the escape sequence
  return `\x1b[<${buttonCode};${protocolX};${protocolY}${suffix}`;
}

export {
  generateMouseEvent,
  BUTTON_CODES,
  MODIFIERS,
  DRAG_MODIFIER
};