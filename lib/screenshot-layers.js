/**
 * Screenshot layer processing utilities for MCPretentious
 * Provides efficient layered terminal screen capture with minimal token usage
 */

import { extractColorRGB, rgbToHex, color256ToRGB } from './color-utils.js';

/**
 * Calculate viewport based on parameters
 * @param {Object} terminal - Terminal dimensions {width, height}
 * @param {Object} cursor - Cursor position {x, y}
 * @param {Object} params - Screenshot parameters
 * @returns {Object} Viewport with mode, left, top, width, height
 */
export function calculateViewport(terminal, cursor, params) {
  if (params.region) {
    return {
      mode: 'region',
      left: params.region.left || 0,
      top: params.region.top || 0,
      width: params.region.width,
      height: params.region.height
    };
  }
  
  if (params.aroundCursor !== undefined) {
    const n = params.aroundCursor;
    return {
      mode: 'aroundCursor',
      left: 0,
      top: Math.max(0, cursor.y - n),
      width: terminal.width,
      height: Math.min(terminal.height, n * 2 + 1)
    };
  }
  
  return {
    mode: 'full',
    left: 0,
    top: 0,
    width: terminal.width,
    height: terminal.height
  };
}

/**
 * Extract text content for viewport
 * @param {Array} lines - Terminal lines from iTerm2
 * @param {Object} viewport - Viewport definition
 * @param {boolean} compact - Skip empty lines
 * @returns {Array} Text lines
 */
export function extractTextLayer(lines, viewport, compact) {
  const result = [];
  const endRow = Math.min(lines.length, viewport.top + viewport.height);
  
  for (let i = viewport.top; i < endRow; i++) {
    if (lines[i]) {
      let text = lines[i].text || '';
      
      // Extract horizontal slice if needed
      if (viewport.left > 0 || viewport.width < text.length) {
        text = text.substring(viewport.left, viewport.left + viewport.width);
      }
      
      // Add line unless compact mode and empty
      if (!compact || text.trim()) {
        result.push(text);
      }
    } else if (!compact) {
      result.push('');
    }
  }
  
  return result;
}

/**
 * Convert index to character (0-9, a-z, A-Z)
 * Supports up to 62 unique values
 */
function indexToChar(index) {
  if (index === 0) return '0';
  if (index < 10) return String(index);
  if (index < 36) return String.fromCharCode(97 + index - 10); // a-z
  if (index < 62) return String.fromCharCode(65 + index - 36); // A-Z
  throw new Error(`Palette overflow: ${index} exceeds maximum of 61 colors`);
}

/**
 * Extract color from style run
 */
function extractColorFromStyle(styleRun, isBackground) {
  if (!styleRun) return null;
  
  if (isBackground) {
    // Background color
    if (styleRun.bgRgb) {
      return {
        r: styleRun.bgRgb.red || 0,
        g: styleRun.bgRgb.green || 0,
        b: styleRun.bgRgb.blue || 0
      };
    }
    if (styleRun.bgStandard !== undefined) {
      return color256ToRGB(styleRun.bgStandard);
    }
    if (styleRun.bgAlternate === 'DEFAULT') {
      return null; // Use default
    }
  } else {
    // Foreground color
    if (styleRun.fgRgb) {
      return {
        r: styleRun.fgRgb.red || 0,
        g: styleRun.fgRgb.green || 0,
        b: styleRun.fgRgb.blue || 0
      };
    }
    if (styleRun.fgStandard !== undefined) {
      return color256ToRGB(styleRun.fgStandard);
    }
    if (styleRun.fgAlternate === 'DEFAULT') {
      return null; // Use default
    }
  }
  
  return null;
}

/**
 * Build color line encoding
 */
function encodeColorLine(line, viewport, palette, isBackground) {
  if (!line || !line.style) {
    return '0'.repeat(viewport.width);
  }
  
  const result = [];
  let currentPos = 0;
  
  for (const styleRun of line.style) {
    const repeats = styleRun.repeats || 1;
    const color = extractColorFromStyle(styleRun, isBackground);
    const hex = color ? rgbToHex(color) : null;
    const char = hex && palette[hex] ? palette[hex] : '0';
    
    // Handle viewport slicing
    for (let i = 0; i < repeats; i++) {
      if (currentPos >= viewport.left && currentPos < viewport.left + viewport.width) {
        result.push(char);
      }
      currentPos++;
      if (currentPos >= viewport.left + viewport.width) break;
    }
    
    if (currentPos >= viewport.left + viewport.width) break;
  }
  
  // Pad if necessary
  while (result.length < viewport.width) {
    result.push('0');
  }
  
  return result.join('');
}

/**
 * Extract color layers with palette
 */
export function extractColorLayers(lines, viewport, layers) {
  const needsFg = layers.includes('fgColors');
  const needsBg = layers.includes('bgColors');
  
  if (!needsFg && !needsBg) return {};
  
  const palette = {};
  const fgColors = [];
  const bgColors = [];
  let paletteIndex = 1; // 0 reserved for default/null
  
  // First pass: build palette
  const endRow = Math.min(lines.length, viewport.top + viewport.height);
  for (let i = viewport.top; i < endRow; i++) {
    if (lines[i]?.style) {
      for (const styleRun of lines[i].style) {
        // Process foreground colors
        if (needsFg) {
          const fgColor = extractColorFromStyle(styleRun, false);
          const fgHex = fgColor ? rgbToHex(fgColor) : null;
          if (fgHex && !palette[fgHex]) {
            palette[fgHex] = indexToChar(paletteIndex++);
          }
        }
        
        // Process background colors
        if (needsBg) {
          const bgColor = extractColorFromStyle(styleRun, true);
          const bgHex = bgColor ? rgbToHex(bgColor) : null;
          if (bgHex && !palette[bgHex]) {
            palette[bgHex] = indexToChar(paletteIndex++);
          }
        }
      }
    }
  }
  
  // Second pass: encode lines
  for (let i = viewport.top; i < endRow; i++) {
    if (needsFg) {
      const fgLine = lines[i] ? encodeColorLine(lines[i], viewport, palette, false) : '0'.repeat(viewport.width);
      fgColors.push(fgLine);
    }
    if (needsBg) {
      const bgLine = lines[i] ? encodeColorLine(lines[i], viewport, palette, true) : '0'.repeat(viewport.width);
      bgColors.push(bgLine);
    }
  }
  
  // Invert palette for output
  const outputPalette = { '0': null };
  for (const [hex, char] of Object.entries(palette)) {
    outputPalette[char] = hex;
  }
  
  const result = {};
  if (needsFg) result.fgColors = fgColors;
  if (needsBg) result.bgColors = bgColors;
  if (needsFg || needsBg) result.colorPalette = outputPalette;
  
  return result;
}

/**
 * Get style character for combined encoding
 */
function getStyleChar(bold, italic, underline) {
  if (!bold && !italic && !underline) return '.';
  if (bold && !italic && !underline) return 'b';
  if (!bold && italic && !underline) return 'i';
  if (!bold && !italic && underline) return 'u';
  if (bold && italic && !underline) return 'I';
  if (bold && !italic && underline) return 'U';
  if (!bold && italic && underline) return 'J';
  if (bold && italic && underline) return 'X';
}

/**
 * Encode style line for combined styles
 */
function encodeStyleLine(line, viewport) {
  if (!line || !line.style) {
    return '.'.repeat(viewport.width);
  }
  
  const result = [];
  let currentPos = 0;
  
  for (const styleRun of line.style) {
    const repeats = styleRun.repeats || 1;
    const char = getStyleChar(
      styleRun.bold || false,
      styleRun.italic || false,
      styleRun.underline || false
    );
    
    // Handle viewport slicing
    for (let i = 0; i < repeats; i++) {
      if (currentPos >= viewport.left && currentPos < viewport.left + viewport.width) {
        result.push(char);
      }
      currentPos++;
      if (currentPos >= viewport.left + viewport.width) break;
    }
    
    if (currentPos >= viewport.left + viewport.width) break;
  }
  
  // Pad if necessary
  while (result.length < viewport.width) {
    result.push('.');
  }
  
  return result.join('');
}

/**
 * Extract single style attribute (bold, italic, underline)
 */
function extractSingleStyle(lines, viewport, attribute) {
  const result = [];
  const endRow = Math.min(lines.length, viewport.top + viewport.height);
  
  for (let i = viewport.top; i < endRow; i++) {
    if (!lines[i] || !lines[i].style) {
      result.push(' '.repeat(viewport.width));
      continue;
    }
    
    const lineResult = [];
    let currentPos = 0;
    
    for (const styleRun of lines[i].style) {
      const repeats = styleRun.repeats || 1;
      const hasAttribute = styleRun[attribute] || false;
      const char = hasAttribute ? 'X' : ' ';
      
      // Handle viewport slicing
      for (let j = 0; j < repeats; j++) {
        if (currentPos >= viewport.left && currentPos < viewport.left + viewport.width) {
          lineResult.push(char);
        }
        currentPos++;
        if (currentPos >= viewport.left + viewport.width) break;
      }
      
      if (currentPos >= viewport.left + viewport.width) break;
    }
    
    // Pad if necessary
    while (lineResult.length < viewport.width) {
      lineResult.push(' ');
    }
    
    result.push(lineResult.join(''));
  }
  
  return result;
}

/**
 * Extract style layers
 */
export function extractStyleLayers(lines, viewport, layers) {
  const result = {};
  
  if (layers.includes('styles')) {
    result.styles = [];
    result.styleLegend = {
      '.': null,
      'b': 'bold',
      'i': 'italic',
      'u': 'underline',
      'I': 'bold+italic',
      'U': 'bold+underline',
      'J': 'italic+underline',
      'X': 'bold+italic+underline'
    };
    
    const endRow = Math.min(lines.length, viewport.top + viewport.height);
    for (let i = viewport.top; i < endRow; i++) {
      const styleLine = lines[i] ? encodeStyleLine(lines[i], viewport) : '.'.repeat(viewport.width);
      result.styles.push(styleLine);
    }
  }
  
  if (layers.includes('bold')) {
    result.bold = extractSingleStyle(lines, viewport, 'bold');
  }
  
  if (layers.includes('italic')) {
    result.italic = extractSingleStyle(lines, viewport, 'italic');
  }
  
  if (layers.includes('underline')) {
    result.underline = extractSingleStyle(lines, viewport, 'underline');
  }
  
  return result;
}

/**
 * Process compact mode - remove empty lines from all layers
 */
export function applyCompactMode(response) {
  if (!response.text) return response;
  
  // Find non-empty line indices
  const nonEmptyIndices = [];
  response.text.forEach((line, idx) => {
    if (line.trim()) {
      nonEmptyIndices.push(idx);
    }
  });
  
  // Filter all array-based layers
  const arrayLayers = ['text', 'styles', 'bold', 'italic', 'underline', 'fgColors', 'bgColors'];
  
  for (const layer of arrayLayers) {
    if (response[layer] && Array.isArray(response[layer])) {
      response[layer] = nonEmptyIndices.map(idx => response[layer][idx]);
    }
  }
  
  return response;
}