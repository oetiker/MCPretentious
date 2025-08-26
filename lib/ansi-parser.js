/**
 * ANSI escape sequence parser for tmux output
 * Converts ANSI-coded text to structured format matching iTerm2's output
 */

import { color256ToRGB, rgbToHex } from './color-utils.js';

// ANSI SGR (Select Graphic Rendition) codes
const SGR_CODES = {
  RESET: 0,
  BOLD: 1,
  DIM: 2,
  ITALIC: 3,
  UNDERLINE: 4,
  BLINK: 5,
  REVERSE: 7,
  HIDDEN: 8,
  STRIKETHROUGH: 9,
  
  // Reset individual attributes
  RESET_BOLD_DIM: 22,
  RESET_ITALIC: 23,
  RESET_UNDERLINE: 24,
  RESET_BLINK: 25,
  RESET_REVERSE: 27,
  RESET_HIDDEN: 28,
  RESET_STRIKE: 29,
  
  // Foreground colors
  FG_BLACK: 30,
  FG_RED: 31,
  FG_GREEN: 32,
  FG_YELLOW: 33,
  FG_BLUE: 34,
  FG_MAGENTA: 35,
  FG_CYAN: 36,
  FG_WHITE: 37,
  FG_256: 38,
  FG_DEFAULT: 39,
  
  // Background colors
  BG_BLACK: 40,
  BG_RED: 41,
  BG_GREEN: 42,
  BG_YELLOW: 43,
  BG_BLUE: 44,
  BG_MAGENTA: 45,
  BG_CYAN: 46,
  BG_WHITE: 47,
  BG_256: 48,
  BG_DEFAULT: 49,
  
  // Bright foreground colors
  FG_BRIGHT_BLACK: 90,
  FG_BRIGHT_RED: 91,
  FG_BRIGHT_GREEN: 92,
  FG_BRIGHT_YELLOW: 93,
  FG_BRIGHT_BLUE: 94,
  FG_BRIGHT_MAGENTA: 95,
  FG_BRIGHT_CYAN: 96,
  FG_BRIGHT_WHITE: 97,
  
  // Bright background colors
  BG_BRIGHT_BLACK: 100,
  BG_BRIGHT_RED: 101,
  BG_BRIGHT_GREEN: 102,
  BG_BRIGHT_YELLOW: 103,
  BG_BRIGHT_BLUE: 104,
  BG_BRIGHT_MAGENTA: 105,
  BG_BRIGHT_CYAN: 106,
  BG_BRIGHT_WHITE: 107
};

// Standard 16-color palette (matches iTerm2 defaults)
const STANDARD_COLORS = {
  // Normal colors
  30: { r: 0, g: 0, b: 0 },        // Black
  31: { r: 194, g: 54, b: 33 },    // Red
  32: { r: 37, g: 188, b: 36 },    // Green
  33: { r: 173, g: 173, b: 39 },   // Yellow
  34: { r: 73, g: 46, b: 225 },    // Blue
  35: { r: 211, g: 56, b: 211 },   // Magenta
  36: { r: 51, g: 187, b: 200 },   // Cyan
  37: { r: 203, g: 204, b: 205 },  // White
  
  // Bright colors
  90: { r: 129, g: 131, b: 131 },  // Bright Black
  91: { r: 252, g: 57, b: 31 },    // Bright Red
  92: { r: 49, g: 231, b: 34 },    // Bright Green
  93: { r: 234, g: 236, b: 35 },   // Bright Yellow
  94: { r: 88, g: 51, b: 255 },    // Bright Blue
  95: { r: 249, g: 53, b: 248 },   // Bright Magenta
  96: { r: 20, g: 240, b: 240 },   // Bright Cyan
  97: { r: 233, g: 235, b: 235 }   // Bright White
};

/**
 * Parse a single ANSI escape sequence
 * @param {string} sequence - The escape sequence (without ESC[)
 * @returns {Object} Parsed attributes
 */
function parseSGR(sequence) {
  const codes = sequence.replace('m', '').split(';').map(Number);
  const attrs = {};
  
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    
    switch (code) {
      case SGR_CODES.RESET:
        attrs.reset = true;
        break;
      
      case SGR_CODES.BOLD:
        attrs.bold = true;
        break;
      
      case SGR_CODES.ITALIC:
        attrs.italic = true;
        break;
      
      case SGR_CODES.UNDERLINE:
        attrs.underline = true;
        break;
      
      case SGR_CODES.RESET_BOLD_DIM:
        attrs.bold = false;
        break;
      
      case SGR_CODES.RESET_ITALIC:
        attrs.italic = false;
        break;
      
      case SGR_CODES.RESET_UNDERLINE:
        attrs.underline = false;
        break;
      
      // Standard foreground colors
      case SGR_CODES.FG_BLACK:
      case SGR_CODES.FG_RED:
      case SGR_CODES.FG_GREEN:
      case SGR_CODES.FG_YELLOW:
      case SGR_CODES.FG_BLUE:
      case SGR_CODES.FG_MAGENTA:
      case SGR_CODES.FG_CYAN:
      case SGR_CODES.FG_WHITE:
        attrs.fgColor = STANDARD_COLORS[code];
        attrs.fgStandard = code - 30;
        break;
      
      // Bright foreground colors
      case SGR_CODES.FG_BRIGHT_BLACK:
      case SGR_CODES.FG_BRIGHT_RED:
      case SGR_CODES.FG_BRIGHT_GREEN:
      case SGR_CODES.FG_BRIGHT_YELLOW:
      case SGR_CODES.FG_BRIGHT_BLUE:
      case SGR_CODES.FG_BRIGHT_MAGENTA:
      case SGR_CODES.FG_BRIGHT_CYAN:
      case SGR_CODES.FG_BRIGHT_WHITE:
        attrs.fgColor = STANDARD_COLORS[code];
        attrs.fgStandard = code - 90 + 8;
        break;
      
      // Standard background colors
      case SGR_CODES.BG_BLACK:
      case SGR_CODES.BG_RED:
      case SGR_CODES.BG_GREEN:
      case SGR_CODES.BG_YELLOW:
      case SGR_CODES.BG_BLUE:
      case SGR_CODES.BG_MAGENTA:
      case SGR_CODES.BG_CYAN:
      case SGR_CODES.BG_WHITE:
        attrs.bgColor = STANDARD_COLORS[code - 10];
        attrs.bgStandard = code - 40;
        break;
      
      // Bright background colors
      case SGR_CODES.BG_BRIGHT_BLACK:
      case SGR_CODES.BG_BRIGHT_RED:
      case SGR_CODES.BG_BRIGHT_GREEN:
      case SGR_CODES.BG_BRIGHT_YELLOW:
      case SGR_CODES.BG_BRIGHT_BLUE:
      case SGR_CODES.BG_BRIGHT_MAGENTA:
      case SGR_CODES.BG_BRIGHT_CYAN:
      case SGR_CODES.BG_BRIGHT_WHITE:
        attrs.bgColor = STANDARD_COLORS[code - 10];
        attrs.bgStandard = code - 100 + 8;
        break;
      
      // 256-color mode
      case SGR_CODES.FG_256:
        if (codes[i + 1] === 5 && i + 2 < codes.length) {
          const colorIndex = codes[i + 2];
          attrs.fgColor = color256ToRGB(colorIndex);
          attrs.fgStandard = colorIndex;
          i += 2;
        } else if (codes[i + 1] === 2 && i + 4 < codes.length) {
          // RGB color
          attrs.fgColor = {
            r: codes[i + 2],
            g: codes[i + 3],
            b: codes[i + 4]
          };
          i += 4;
        }
        break;
      
      case SGR_CODES.BG_256:
        if (codes[i + 1] === 5 && i + 2 < codes.length) {
          const colorIndex = codes[i + 2];
          attrs.bgColor = color256ToRGB(colorIndex);
          attrs.bgStandard = colorIndex;
          i += 2;
        } else if (codes[i + 1] === 2 && i + 4 < codes.length) {
          // RGB color
          attrs.bgColor = {
            r: codes[i + 2],
            g: codes[i + 3],
            b: codes[i + 4]
          };
          i += 4;
        }
        break;
      
      case SGR_CODES.FG_DEFAULT:
        attrs.fgColor = null;
        attrs.fgAlternate = 'DEFAULT';
        break;
      
      case SGR_CODES.BG_DEFAULT:
        attrs.bgColor = null;
        attrs.bgAlternate = 'DEFAULT';
        break;
    }
  }
  
  return attrs;
}

/**
 * Parse a line with ANSI escape codes
 * @param {string} line - Line with ANSI codes
 * @returns {Object} Parsed line with text and style runs
 */
function parseAnsiLine(line) {
  const result = {
    text: '',
    style: []
  };
  
  // Current style state
  let currentStyle = {
    bold: false,
    italic: false,
    underline: false,
    fgColor: null,
    bgColor: null,
    fgStandard: undefined,
    bgStandard: undefined
  };
  
  // Split by ANSI escape sequences
  const parts = line.split(/\x1b\[([0-9;]+m)/);
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Text content
      const text = parts[i];
      if (text.length > 0) {
        result.text += text;
        
        // Create style run for this text
        const styleRun = {
          repeats: text.length
        };
        
        // Add style attributes if not default
        if (currentStyle.bold) styleRun.bold = true;
        if (currentStyle.italic) styleRun.italic = true;
        if (currentStyle.underline) styleRun.underline = true;
        
        if (currentStyle.fgColor) {
          if (currentStyle.fgStandard !== undefined) {
            styleRun.fgStandard = currentStyle.fgStandard;
          } else {
            styleRun.fgRgb = {
              red: currentStyle.fgColor.r,
              green: currentStyle.fgColor.g,
              blue: currentStyle.fgColor.b
            };
          }
        } else if (currentStyle.fgAlternate) {
          styleRun.fgAlternate = currentStyle.fgAlternate;
        }
        
        if (currentStyle.bgColor) {
          if (currentStyle.bgStandard !== undefined) {
            styleRun.bgStandard = currentStyle.bgStandard;
          } else {
            styleRun.bgRgb = {
              red: currentStyle.bgColor.r,
              green: currentStyle.bgColor.g,
              blue: currentStyle.bgColor.b
            };
          }
        } else if (currentStyle.bgAlternate) {
          styleRun.bgAlternate = currentStyle.bgAlternate;
        }
        
        result.style.push(styleRun);
      }
    } else {
      // ANSI escape sequence
      const attrs = parseSGR(parts[i]);
      
      if (attrs.reset) {
        // Reset all attributes
        currentStyle = {
          bold: false,
          italic: false,
          underline: false,
          fgColor: null,
          bgColor: null,
          fgStandard: undefined,
          bgStandard: undefined
        };
      } else {
        // Apply attribute changes
        if (attrs.bold !== undefined) currentStyle.bold = attrs.bold;
        if (attrs.italic !== undefined) currentStyle.italic = attrs.italic;
        if (attrs.underline !== undefined) currentStyle.underline = attrs.underline;
        
        if (attrs.fgColor !== undefined) {
          currentStyle.fgColor = attrs.fgColor;
          currentStyle.fgStandard = attrs.fgStandard;
          currentStyle.fgAlternate = attrs.fgAlternate;
        }
        
        if (attrs.bgColor !== undefined) {
          currentStyle.bgColor = attrs.bgColor;
          currentStyle.bgStandard = attrs.bgStandard;
          currentStyle.bgAlternate = attrs.bgAlternate;
        }
      }
    }
  }
  
  // If no styles were added, add a default style run
  if (result.style.length === 0 && result.text.length > 0) {
    result.style.push({ repeats: result.text.length });
  }
  
  return result;
}

/**
 * Parse entire screen with ANSI codes
 * @param {Array<string>} lines - Lines with ANSI codes
 * @param {Object} cursor - Cursor position {x, y}
 * @returns {Object} Parsed screen matching iTerm2 format
 */
export function parseAnsiScreen(lines, cursor = { x: 0, y: 0 }) {
  const parsedLines = lines.map(line => parseAnsiLine(line));
  
  return {
    text: parsedLines.map(l => l.text).join('\n'),
    cursor: cursor,
    lines: parsedLines
  };
}

/**
 * Convert parsed ANSI screen to layered format
 * @param {Object} screen - Parsed screen from parseAnsiScreen
 * @param {Array<string>} layers - Requested layers
 * @returns {Object} Layered screen data
 */
export function convertToLayers(screen, layers = ['text']) {
  const result = {};
  
  // Always include text
  result.text = screen.lines.map(l => l.text);
  
  // Include cursor if requested
  if (layers.includes('cursor')) {
    result.cursor = screen.cursor;
  }
  
  // Process style layers if requested
  if (layers.some(l => ['fgColors', 'bgColors', 'styles', 'bold', 'italic', 'underline'].includes(l))) {
    const palette = { '0': null };
    let paletteIndex = 1;
    
    // First pass: build color palette
    for (const line of screen.lines) {
      for (const styleRun of line.style || []) {
        // Process foreground colors
        if (styleRun.fgRgb) {
          const hex = rgbToHex(styleRun.fgRgb);
          if (!palette[hex]) {
            palette[hex] = String(paletteIndex++);
          }
        } else if (styleRun.fgStandard !== undefined) {
          const color = color256ToRGB(styleRun.fgStandard);
          const hex = rgbToHex(color);
          if (!palette[hex]) {
            palette[hex] = String(paletteIndex++);
          }
        }
        
        // Process background colors
        if (styleRun.bgRgb) {
          const hex = rgbToHex(styleRun.bgRgb);
          if (!palette[hex]) {
            palette[hex] = String(paletteIndex++);
          }
        } else if (styleRun.bgStandard !== undefined) {
          const color = color256ToRGB(styleRun.bgStandard);
          const hex = rgbToHex(color);
          if (!palette[hex]) {
            palette[hex] = String(paletteIndex++);
          }
        }
      }
    }
    
    // Invert palette for output
    const outputPalette = { '0': null };
    for (const [hex, char] of Object.entries(palette)) {
      if (hex !== '0') {
        outputPalette[char] = hex;
      }
    }
    
    // Second pass: build layer arrays
    if (layers.includes('fgColors')) {
      result.fgColors = [];
    }
    if (layers.includes('bgColors')) {
      result.bgColors = [];
    }
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
    }
    if (layers.includes('bold')) {
      result.bold = [];
    }
    if (layers.includes('italic')) {
      result.italic = [];
    }
    if (layers.includes('underline')) {
      result.underline = [];
    }
    
    for (const line of screen.lines) {
      const lineLength = line.text.length;
      let fgLine = layers.includes('fgColors') ? [] : null;
      let bgLine = layers.includes('bgColors') ? [] : null;
      let styleLine = layers.includes('styles') ? [] : null;
      let boldLine = layers.includes('bold') ? [] : null;
      let italicLine = layers.includes('italic') ? [] : null;
      let underlineLine = layers.includes('underline') ? [] : null;
      
      let position = 0;
      
      for (const styleRun of line.style || []) {
        const repeats = styleRun.repeats || 1;
        
        // Determine colors
        let fgChar = '0';
        let bgChar = '0';
        
        if (styleRun.fgRgb) {
          const hex = rgbToHex(styleRun.fgRgb);
          fgChar = palette[hex] || '0';
        } else if (styleRun.fgStandard !== undefined) {
          const color = color256ToRGB(styleRun.fgStandard);
          const hex = rgbToHex(color);
          fgChar = palette[hex] || '0';
        }
        
        if (styleRun.bgRgb) {
          const hex = rgbToHex(styleRun.bgRgb);
          bgChar = palette[hex] || '0';
        } else if (styleRun.bgStandard !== undefined) {
          const color = color256ToRGB(styleRun.bgStandard);
          const hex = rgbToHex(color);
          bgChar = palette[hex] || '0';
        }
        
        // Determine style character
        let styleChar = '.';
        if (styleRun.bold && styleRun.italic && styleRun.underline) {
          styleChar = 'X';
        } else if (styleRun.bold && styleRun.italic) {
          styleChar = 'I';
        } else if (styleRun.bold && styleRun.underline) {
          styleChar = 'U';
        } else if (styleRun.italic && styleRun.underline) {
          styleChar = 'J';
        } else if (styleRun.bold) {
          styleChar = 'b';
        } else if (styleRun.italic) {
          styleChar = 'i';
        } else if (styleRun.underline) {
          styleChar = 'u';
        }
        
        // Fill arrays
        for (let i = 0; i < repeats && position < lineLength; i++) {
          if (fgLine) fgLine.push(fgChar);
          if (bgLine) bgLine.push(bgChar);
          if (styleLine) styleLine.push(styleChar);
          if (boldLine) boldLine.push(styleRun.bold ? 'X' : ' ');
          if (italicLine) italicLine.push(styleRun.italic ? 'X' : ' ');
          if (underlineLine) underlineLine.push(styleRun.underline ? 'X' : ' ');
          position++;
        }
      }
      
      // Pad to line length if necessary
      while (position < lineLength) {
        if (fgLine) fgLine.push('0');
        if (bgLine) bgLine.push('0');
        if (styleLine) styleLine.push('.');
        if (boldLine) boldLine.push(' ');
        if (italicLine) italicLine.push(' ');
        if (underlineLine) underlineLine.push(' ');
        position++;
      }
      
      // Add lines to result
      if (fgLine) result.fgColors.push(fgLine.join(''));
      if (bgLine) result.bgColors.push(bgLine.join(''));
      if (styleLine) result.styles.push(styleLine.join(''));
      if (boldLine) result.bold.push(boldLine.join(''));
      if (italicLine) result.italic.push(italicLine.join(''));
      if (underlineLine) result.underline.push(underlineLine.join(''));
    }
    
    // Add palette if we have colors
    if ((layers.includes('fgColors') || layers.includes('bgColors')) && Object.keys(outputPalette).length > 1) {
      result.colorPalette = outputPalette;
    }
  }
  
  return result;
}