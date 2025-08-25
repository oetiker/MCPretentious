# Implementation Plan: Layered Screenshot Format

## Overview
Reduce screenshot output from 30,000+ tokens to under 3,000 tokens by implementing a layered data format with selective viewport rendering.

## Implementation Steps

### 1. Update Zod Schema (mcpretentious.js:164-168)
```javascript
{
  terminalId: z.string().describe("The terminal ID to read from"),
  layers: z.array(z.enum([
    "text", "cursor", "fgColors", "bgColors", 
    "styles", "bold", "italic", "underline"
  ])).optional().default(["text", "cursor"]),
  region: z.object({
    left: z.number(),
    top: z.number(),
    width: z.number(),
    height: z.number()
  }).optional(),
  aroundCursor: z.number().optional(),
  compact: z.boolean().optional().default(false)
}
```

### 2. Create Layer Processing Module (lib/screenshot-layers.js)

#### Core Functions:
```javascript
// Calculate viewport based on parameters
function calculateViewport(screen, cursor, params) {
  if (params.region) {
    return {
      mode: "region",
      left: params.region.left,
      top: params.region.top,
      width: params.region.width,
      height: params.region.height
    };
  }
  
  if (params.aroundCursor) {
    const n = params.aroundCursor;
    return {
      mode: "aroundCursor",
      left: 0,
      top: Math.max(0, cursor.top - n),
      width: screen.width,
      height: Math.min(screen.height, n * 2 + 1)
    };
  }
  
  return {
    mode: "full",
    left: 0,
    top: 0,
    width: screen.width,
    height: screen.height
  };
}

// Extract text content for viewport
function extractTextLayer(lines, viewport, compact) {
  const result = [];
  for (let i = viewport.top; i < viewport.top + viewport.height; i++) {
    if (lines[i]) {
      let text = lines[i].text || "";
      if (viewport.left > 0 || viewport.width < text.length) {
        text = text.substring(viewport.left, viewport.left + viewport.width);
      }
      if (!compact || text.trim()) {
        result.push(text);
      }
    }
  }
  return result;
}

// Build color palette and encode colors
function extractColorLayers(lines, viewport, layers) {
  const palette = {};
  const fgColors = [];
  const bgColors = [];
  let paletteIndex = 1; // 0 reserved for default
  
  // First pass: build palette
  for (let i = viewport.top; i < viewport.top + viewport.height; i++) {
    if (lines[i]?.style) {
      for (const styleRun of lines[i].style) {
        // Process foreground colors
        const fgColor = extractColor(styleRun, false);
        const fgHex = rgbToHex(fgColor);
        if (fgHex && !palette[fgHex]) {
          palette[fgHex] = indexToChar(paletteIndex++);
        }
        
        // Process background colors
        const bgColor = extractColor(styleRun, true);
        const bgHex = rgbToHex(bgColor);
        if (bgHex && !palette[bgHex]) {
          palette[bgHex] = indexToChar(paletteIndex++);
        }
      }
    }
  }
  
  // Second pass: encode lines
  for (let i = viewport.top; i < viewport.top + viewport.height; i++) {
    if (lines[i]) {
      const fgLine = encodeColorLine(lines[i], viewport, palette, false);
      const bgLine = encodeColorLine(lines[i], viewport, palette, true);
      fgColors.push(fgLine);
      bgColors.push(bgLine);
    }
  }
  
  // Invert palette for output
  const outputPalette = { "0": null };
  for (const [hex, char] of Object.entries(palette)) {
    outputPalette[char] = hex;
  }
  
  return { fgColors, bgColors, colorPalette: outputPalette };
}

// Encode style information
function extractStyleLayers(lines, viewport, layers) {
  const result = {};
  
  if (layers.includes("styles")) {
    result.styles = [];
    result.styleLegend = {
      ".": null,
      "b": "bold",
      "i": "italic",
      "u": "underline",
      "I": "bold+italic",
      "U": "bold+underline",
      "J": "italic+underline",
      "X": "bold+italic+underline"
    };
    
    for (let i = viewport.top; i < viewport.top + viewport.height; i++) {
      const styleLine = encodeStyleLine(lines[i], viewport);
      result.styles.push(styleLine);
    }
  }
  
  if (layers.includes("bold")) {
    result.bold = extractSingleStyle(lines, viewport, "bold");
  }
  
  if (layers.includes("italic")) {
    result.italic = extractSingleStyle(lines, viewport, "italic");
  }
  
  if (layers.includes("underline")) {
    result.underline = extractSingleStyle(lines, viewport, "underline");
  }
  
  return result;
}

// Helper: Convert index to character (0-9, a-z)
function indexToChar(index) {
  if (index < 10) return String(index);
  if (index < 36) return String.fromCharCode(97 + index - 10);
  throw new Error("Palette overflow");
}

// Helper: Encode combined style character
function getStyleChar(bold, italic, underline) {
  if (!bold && !italic && !underline) return ".";
  if (bold && !italic && !underline) return "b";
  if (!bold && italic && !underline) return "i";
  if (!bold && !italic && underline) return "u";
  if (bold && italic && !underline) return "I";
  if (bold && !italic && underline) return "U";
  if (!bold && italic && underline) return "J";
  if (bold && italic && underline) return "X";
}
```

### 3. Update Main Screenshot Handler (mcpretentious.js:169-204)

```javascript
async ({ terminalId, layers = ["text", "cursor"], region, aroundCursor, compact = false }) => {
  return withTerminalSession(terminalId, async (client, sessionId) => {
    return safeExecute(async () => {
      const screen = await client.getScreenContents(sessionId, true);
      
      // Normalize cursor
      const cursor = {
        left: typeof screen.cursor.x === 'object' ? (screen.cursor.x.low || screen.cursor.x) : screen.cursor.x,
        top: typeof screen.cursor.y === 'object' ? (screen.cursor.y.low || screen.cursor.y) : screen.cursor.y
      };
      
      // Calculate viewport
      const terminal = {
        width: ITERM_DEFAULTS.COLUMNS,
        height: screen.lines?.length || ITERM_DEFAULTS.ROWS
      };
      
      const viewport = calculateViewport(terminal, cursor, { region, aroundCursor });
      
      // Build response
      const response = {
        terminal,
        viewport,
        cursor: {
          left: cursor.left,
          top: cursor.top,
          relLeft: cursor.left - viewport.left,
          relTop: cursor.top - viewport.top
        }
      };
      
      // Add requested layers
      if (layers.includes("text")) {
        response.text = extractTextLayer(screen.lines, viewport, compact);
      }
      
      // Add color layers if requested
      if (layers.includes("fgColors") || layers.includes("bgColors")) {
        const colors = extractColorLayers(screen.lines, viewport, layers);
        if (layers.includes("fgColors")) response.fgColors = colors.fgColors;
        if (layers.includes("bgColors")) response.bgColors = colors.bgColors;
        response.colorPalette = colors.colorPalette;
      }
      
      // Add style layers if requested
      const styles = extractStyleLayers(screen.lines, viewport, layers);
      Object.assign(response, styles);
      
      return successResponse(JSON.stringify(response, null, 2));
    }, "Failed to get screen info");
  });
}
```

### 4. Testing Strategy

#### Test Cases:
1. **Minimal output**: `layers: ["text", "cursor"]`
2. **Style combinations**: Test all 8 style combinations
3. **Color palette**: Verify palette generation and encoding
4. **Viewport modes**: Test region, aroundCursor, and full
5. **Compact mode**: Verify empty line removal
6. **Token reduction**: Measure output size reduction

#### Expected Results:
- Default (text+cursor): ~500 tokens
- With styles: ~1000 tokens  
- With colors: ~1500 tokens
- Full data: ~2500 tokens
- Previous format: 30,000+ tokens

### 5. Migration Notes

Since this is an MCP with no backward compatibility required:
- Remove old `format` parameter completely
- Remove `cursor-only` format option
- Update all tests to use new format
- Update documentation

### 6. Performance Optimizations

- Pre-allocate arrays for known viewport size
- Use character codes instead of string concatenation
- Cache color palette between calls for same session
- Lazy evaluation of unused layers

## Files to Modify

1. `/Users/oetiker/checkouts/MCPretentious/mcpretentious.js` - Update tool definition and handler
2. `/Users/oetiker/checkouts/MCPretentious/lib/screenshot-layers.js` - New file with layer processing
3. `/Users/oetiker/checkouts/MCPretentious/test/integration.test.mjs` - Update tests
4. `/Users/oetiker/checkouts/MCPretentious/API.md` - Already updated

## Success Metrics

- Output size reduced by 90%+ for typical usage
- Response time under 100ms for full screen
- All existing functionality preserved
- Clear and intuitive API