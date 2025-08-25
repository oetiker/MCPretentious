/**
 * Test to verify screenshot captures full terminal content including edges
 */

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const execPromise = promisify(exec);
const VERBOSE = true;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to extract terminal ID (UUID) from response
function extractTerminalId(responseText) {
  const match = responseText.match(/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})/i);
  return match ? match[1] : null;
}

// Check if iTerm2 is installed
async function isITermInstalled() {
  try {
    await execPromise('osascript -e "tell application \\"System Events\\" to name of application processes" | grep iTerm2');
    return true;
  } catch {
    return false;
  }
}

const shouldRun = await isITermInstalled();

describe('Screenshot Full Capture Tests', { skip: !shouldRun }, () => {
  let client;
  let transport;
  let testTerminalId;
  
  before(async () => {
    if (!shouldRun) {
      console.log('iTerm2 is not installed. Skipping tests.');
      return;
    }
    
    // Create transport that spawns the server
    transport = new StdioClientTransport({
      command: 'node',
      args: [join(__dirname, '..', 'mcpretentious.js')]
    });
    
    // Create and connect client
    client = new Client({
      name: 'screenshot-full-capture-test',
      version: '1.0.0'
    });
    
    await client.connect(transport);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Open a terminal for testing
    const result = await client.callTool({
      name: 'mcpretentious-open',
      arguments: {}
    });
    testTerminalId = extractTerminalId(result.content[0].text);
    
    console.log(`Opened terminal: ${testTerminalId}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  });
  
  after(async () => {
    // Clean up terminal
    if (testTerminalId) {
      try {
        await client.callTool({
          name: 'mcpretentious-close',
          arguments: { terminalId: testTerminalId }
        });
      } catch (error) {
        console.error(`Failed to close terminal ${testTerminalId}:`, error.message);
      }
    }
    
    // Close connections
    await client?.close();
    await transport?.close();
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  
  it('should capture full terminal width including rightmost column', async () => {
    console.log('\n>>> Testing full width capture');
    
    // Resize to specific width
    const targetWidth = 100;
    await client.callTool({
      name: 'mcpretentious-resize',
      arguments: {
        terminalId: testTerminalId,
        columns: targetWidth,
        rows: 24
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear and add border content
    await client.callTool({
      name: 'mcpretentious-type',
      arguments: {
        terminalId: testTerminalId,
        input: ['clear', { key: 'enter' }]
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Create a line with markers on both sides that should span full width
    // Use simple characters that won't be interpreted by the shell
    const leftMarker = '[';
    const rightMarker = ']';
    const middleContent = '='.repeat(targetWidth - 2);
    const fullLine = leftMarker + middleContent + rightMarker;
    
    await client.callTool({
      name: 'mcpretentious-type',
      arguments: {
        terminalId: testTerminalId,
        input: [`echo "${fullLine}"`, { key: 'enter' }]
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Get screenshot
    const screenshotResult = await client.callTool({
      name: 'mcpretentious-screenshot',
      arguments: {
        terminalId: testTerminalId,
        layers: ['text']
      }
    });
    
    const screenshot = JSON.parse(screenshotResult.content[0].text);
    
    console.log(`Terminal dimensions: ${screenshot.terminal.width}x${screenshot.terminal.height}`);
    console.log(`Viewport dimensions: ${screenshot.viewport.width}x${screenshot.viewport.height}`);
    
    // Find the line with our marker pattern
    const markerLine = screenshot.text.find(line => 
      line.includes('[') && line.includes('='.repeat(20)) && line.includes(']')
    );
    
    if (markerLine) {
      console.log(`Found marker line with length: ${markerLine.length}`);
      console.log(`First char: "${markerLine[0]}"`);
      console.log(`Last char: "${markerLine[markerLine.length - 1]}"`);
      
      // Check that we captured both markers
      assert.equal(markerLine[0], '[', 'Should capture left marker');
      assert.equal(markerLine[markerLine.length - 1], ']', 'Should capture right marker');
      
      // Check length matches expected
      assert.equal(markerLine.length, targetWidth, 
        `Should capture full ${targetWidth} character width`);
      
      console.log('✓ Full width captured including markers!');
    } else {
      assert.fail('Could not find marker line in screenshot');
    }
  });
  
  it('should capture full terminal height including bottom row', async () => {
    console.log('\n>>> Testing full height capture');
    
    const targetHeight = 20;
    await client.callTool({
      name: 'mcpretentious-resize',
      arguments: {
        terminalId: testTerminalId,
        columns: 80,
        rows: targetHeight
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear screen
    await client.callTool({
      name: 'mcpretentious-type',
      arguments: {
        terminalId: testTerminalId,
        input: ['clear', { key: 'enter' }]
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Fill screen with numbered lines
    for (let i = 1; i <= targetHeight - 2; i++) {
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: [`echo "Line ${String(i).padStart(2, '0')}"`, { key: 'enter' }]
        }
      });
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Add a special marker at the bottom
    await client.callTool({
      name: 'mcpretentious-type',
      arguments: {
        terminalId: testTerminalId,
        input: [`echo "BOTTOM-ROW-MARKER"`, { key: 'enter' }]
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Get screenshot
    const screenshotResult = await client.callTool({
      name: 'mcpretentious-screenshot',
      arguments: {
        terminalId: testTerminalId,
        layers: ['text']
      }
    });
    
    const screenshot = JSON.parse(screenshotResult.content[0].text);
    
    console.log(`Screenshot has ${screenshot.text.length} lines`);
    console.log(`Terminal height: ${screenshot.terminal.height}`);
    
    // Check if we captured the bottom row
    const hasBottomMarker = screenshot.text.some(line => 
      line.includes('BOTTOM-ROW-MARKER')
    );
    
    assert.ok(hasBottomMarker, 'Should capture bottom row with marker');
    
    // Check that we have enough lines
    assert.ok(screenshot.text.length >= targetHeight, 
      `Should capture at least ${targetHeight} lines`);
    
    console.log('✓ Full height captured including bottom row!');
  });
});