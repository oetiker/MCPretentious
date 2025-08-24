/**
 * Color Utilities for MCPretentious
 * 
 * Converts iTerm2 color representations to RGB values
 * Handles standard ANSI colors, 256-color palette, and true RGB colors
 */

/**
 * Standard ANSI colors (0-15) to RGB mapping
 * Based on default iTerm2 color scheme
 */
const ANSI_TO_RGB = {
  // Normal colors (0-7)
  0: { r: 0, g: 0, b: 0 },        // Black
  1: { r: 194, g: 54, b: 33 },    // Red
  2: { r: 37, g: 188, b: 36 },    // Green
  3: { r: 173, g: 173, b: 39 },   // Yellow
  4: { r: 73, g: 46, b: 225 },    // Blue
  5: { r: 211, g: 56, b: 211 },   // Magenta
  6: { r: 51, g: 187, b: 200 },   // Cyan
  7: { r: 203, g: 204, b: 205 },  // White
  // Bright colors (8-15)
  8: { r: 129, g: 131, b: 131 },  // Bright Black
  9: { r: 252, g: 57, b: 31 },    // Bright Red
  10: { r: 49, g: 231, b: 34 },   // Bright Green
  11: { r: 234, g: 236, b: 35 },  // Bright Yellow
  12: { r: 88, g: 51, b: 255 },   // Bright Blue
  13: { r: 249, g: 53, b: 248 },  // Bright Magenta
  14: { r: 20, g: 240, b: 240 },  // Bright Cyan
  15: { r: 233, g: 235, b: 235 }  // Bright White
};

/**
 * Convert 256-color palette index to RGB
 * Colors 0-15: Standard ANSI
 * Colors 16-231: 6x6x6 RGB cube
 * Colors 232-255: Grayscale
 */
function color256ToRGB(index) {
  if (index < 16) {
    // Standard ANSI colors
    return ANSI_TO_RGB[index] || { r: 0, g: 0, b: 0 };
  } else if (index < 232) {
    // 6x6x6 RGB cube (216 colors)
    const i = index - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    
    // Convert 0-5 range to 0-255
    const levels = [0, 95, 135, 175, 215, 255];
    return {
      r: levels[r],
      g: levels[g],
      b: levels[b]
    };
  } else {
    // Grayscale (24 shades)
    const gray = 8 + (index - 232) * 10;
    return { r: gray, g: gray, b: gray };
  }
}

/**
 * Extract RGB values from iTerm2 style color object
 * Handles different color formats: standard, RGB, alternate
 */
export function extractColorRGB(colorInfo, isBackground = false) {
  if (!colorInfo) return null;
  
  // Check for different color format fields based on our debug output
  // The style uses fgStandard/bgStandard, fgRgb/bgRgb, fgAlternate/bgAlternate
  
  // Direct RGB color (24-bit true color)
  if (colorInfo.rgb) {
    return {
      r: colorInfo.rgb.red || 0,
      g: colorInfo.rgb.green || 0,
      b: colorInfo.rgb.blue || 0
    };
  }
  
  // For styles from getScreenContents
  if (typeof colorInfo === 'object') {
    // Check for RGB fields
    if (colorInfo.fgRgb && !isBackground) {
      return {
        r: colorInfo.fgRgb.red || 0,
        g: colorInfo.fgRgb.green || 0,
        b: colorInfo.fgRgb.blue || 0
      };
    }
    if (colorInfo.bgRgb && isBackground) {
      return {
        r: colorInfo.bgRgb.red || 0,
        g: colorInfo.bgRgb.green || 0,
        b: colorInfo.bgRgb.blue || 0
      };
    }
    
    // Standard color (0-255 palette)
    if (colorInfo.fgStandard !== undefined && !isBackground) {
      return color256ToRGB(colorInfo.fgStandard);
    }
    if (colorInfo.bgStandard !== undefined && isBackground) {
      return color256ToRGB(colorInfo.bgStandard);
    }
    
    // Check simple standard field
    if (colorInfo.standard !== undefined) {
      return color256ToRGB(colorInfo.standard);
    }
  }
  
  // If it's just a number, treat as standard color index
  if (typeof colorInfo === 'number') {
    return color256ToRGB(colorInfo);
  }
  
  // Default color (usually means terminal default)
  if (colorInfo.alternate === 'DEFAULT' || 
      colorInfo.fgAlternate === 'DEFAULT' || 
      colorInfo.bgAlternate === 'DEFAULT') {
    // Return default terminal colors (can be customized)
    return isBackground 
      ? { r: 0, g: 0, b: 0 }      // Default background (black)
      : { r: 203, g: 204, b: 205 }; // Default foreground (light gray)
  }
  
  return null;
}

/**
 * Parse style run from iTerm2 and extract colors and attributes
 */
export function parseStyleRun(styleRun) {
  const result = {
    foreground: null,
    background: null,
    attributes: {
      bold: styleRun.bold || false,
      italic: styleRun.italic || false,
      underline: styleRun.underline || false,
      strikethrough: styleRun.strikethrough || false,
      blink: styleRun.blink || false,
      inverse: styleRun.inverse || false,
      invisible: styleRun.invisible || false,
      faint: styleRun.faint || false
    },
    repeats: styleRun.repeats || 1
  };
  
  // Extract foreground color
  if (styleRun.fgStandard !== undefined) {
    result.foreground = color256ToRGB(styleRun.fgStandard);
  } else if (styleRun.fgRgb) {
    result.foreground = {
      r: styleRun.fgRgb.red || 0,
      g: styleRun.fgRgb.green || 0,
      b: styleRun.fgRgb.blue || 0
    };
  } else if (styleRun.fgAlternate === 'DEFAULT') {
    result.foreground = { r: 203, g: 204, b: 205 }; // Default foreground
  }
  
  // Extract background color
  if (styleRun.bgStandard !== undefined) {
    result.background = color256ToRGB(styleRun.bgStandard);
  } else if (styleRun.bgRgb) {
    result.background = {
      r: styleRun.bgRgb.red || 0,
      g: styleRun.bgRgb.green || 0,
      b: styleRun.bgRgb.blue || 0
    };
  } else if (styleRun.bgAlternate === 'DEFAULT') {
    result.background = { r: 0, g: 0, b: 0 }; // Default background
  }
  
  return result;
}

/**
 * Convert RGB object to hex color string
 */
export function rgbToHex(rgb) {
  if (!rgb) return null;
  
  const toHex = (n) => {
    const hex = Math.round(n).toString(16).padStart(2, '0');
    return hex;
  };
  
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Parse a complete line with styles and return structured data
 */
export function parseLineWithStyles(lineContent) {
  if (!lineContent) return null;
  
  const result = {
    text: lineContent.text || '',
    styles: []
  };
  
  if (lineContent.style && Array.isArray(lineContent.style)) {
    // Parse each style run
    result.styles = lineContent.style.map(styleRun => parseStyleRun(styleRun));
  }
  
  return result;
}

/**
 * Get character at position with its color and style
 */
export function getCharacterStyle(lineContent, position) {
  if (!lineContent || !lineContent.style) return null;
  
  let currentPos = 0;
  
  for (const styleRun of lineContent.style) {
    const runLength = styleRun.repeats || 1;
    
    if (position >= currentPos && position < currentPos + runLength) {
      // Found the style run for this position
      const parsed = parseStyleRun(styleRun);
      return {
        character: lineContent.text ? lineContent.text[position] : '',
        foreground: parsed.foreground,
        foregroundHex: rgbToHex(parsed.foreground),
        background: parsed.background,
        backgroundHex: rgbToHex(parsed.background),
        ...parsed.attributes
      };
    }
    
    currentPos += runLength;
  }
  
  return null;
}

// Also export helper functions
export { color256ToRGB, ANSI_TO_RGB };

// Default export for convenience
export default {
  extractColorRGB,
  parseStyleRun,
  parseLineWithStyles,
  getCharacterStyle,
  rgbToHex,
  color256ToRGB,
  ANSI_TO_RGB
};