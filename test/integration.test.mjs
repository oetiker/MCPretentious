/**
 * Multi-backend integration tests for MCPretentious
 * These tests detect available terminal backends and run tests for each
 */

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { platform } from 'node:os';

const execPromise = promisify(exec);
const VERBOSE = process.env.VERBOSE === 'true';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to extract terminal ID from response
function extractTerminalId(responseText) {
  // Match terminal ID format in response text
  // Format: "Backend terminal opened with ID: backend:sessionId"
  const match = responseText.match(/ID:\s*([\w:-]+)/);
  return match ? match[1] : null;
}

// Check which backends are available
async function getAvailableBackends() {
  const backends = [];
  
  // Check for iTerm2 (macOS only)
  if (platform() === 'darwin') {
    try {
      execSync('osascript -e \'tell application "System Events" to name of application processes\' | grep -q iTerm', {
        stdio: 'ignore'
      });
      // Make sure iTerm2 is running
      execSync('open -a iTerm', { stdio: 'ignore' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      backends.push('iterm');
      if (VERBOSE) console.log('✓ iTerm2 backend available');
    } catch {
      if (VERBOSE) console.log('✗ iTerm2 backend not available');
    }
  }
  
  // Check for tmux
  try {
    execSync('which tmux', { stdio: 'ignore' });
    // Check if tmux server is running or can be started
    try {
      // First ensure no stale server is running
      try {
        execSync('tmux kill-server 2>/dev/null', { stdio: 'ignore' });
      } catch {}
      
      // Try to start a fresh server with a test session
      execSync('tmux new-session -d -s test-check 2>/dev/null', { 
        stdio: 'ignore'
      });
      execSync('tmux kill-session -t test-check 2>/dev/null', { 
        stdio: 'ignore'
      });
      backends.push('tmux');
      if (VERBOSE) console.log('✓ tmux backend available');
    } catch (error) {
      if (VERBOSE) console.log('✗ tmux backend not available:', error.message);
    }
  } catch {
    if (VERBOSE) console.log('✗ tmux backend not available (not installed)');
  }
  
  return backends;
}

// Get list of available backends
const availableBackends = await getAvailableBackends();

if (availableBackends.length === 0) {
  console.log('No terminal backends available. Skipping integration tests.');
  console.log('Install iTerm2 (macOS) or tmux to run integration tests.');
  process.exit(0);
}

console.log(`Running integration tests for backends: ${availableBackends.join(', ')}`);

// Disable focus reporting before tests start to prevent ^[[O and ^[[I when focus changes
// Write directly to /dev/tty to bypass test runner's output capture
import { openSync, writeSync, closeSync } from 'fs';
try {
  const tty = openSync('/dev/tty', 'w');
  writeSync(tty, '\x1b[?1004l');
  closeSync(tty);
} catch (e) {
  // If we can't open /dev/tty, try stdout as fallback
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?1004l');
  }
}

// Run tests for each available backend
for (const backend of availableBackends) {
  describe(`Integration Tests - ${backend} backend`, () => {
    let client;
    let transport;
    let openTerminals = [];
    
    before(async () => {
      // Set the backend environment variable
      process.env.MCP_TERMINAL_BACKEND = backend;
      
      // Create transport that spawns the server with the backend env var
      transport = new StdioClientTransport({
        command: 'node',
        args: [join(__dirname, '..', 'mcpretentious.js')],
        env: {
          ...process.env,
          MCP_TERMINAL_BACKEND: backend
        }
      });
      
      // Create and connect client
      client = new Client({
        name: `integration-test-${backend}`,
        version: '1.0.0'
      });
      
      await client.connect(transport);
      
      // Wait for connection to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log(`\n--- Testing with ${backend} backend ---`);
    });
    
    after(async () => {
      // Clean up any open terminals
      if (openTerminals.length > 0) {
        console.log(`[${backend}] Cleaning up ${openTerminals.length} terminals...`);
      }
      for (const terminalId of openTerminals) {
        try {
          await client.callTool({
            name: 'mcpretentious-close',
            arguments: { terminalId }
          });
          if (VERBOSE) console.log(`[${backend}] Closed ${terminalId}`);
        } catch (error) {
          if (VERBOSE) console.error(`[${backend}] Failed to close ${terminalId}:`, error.message);
        }
      }
      openTerminals = [];
      
      // Close connections
      await client?.close();
      await transport?.close();
      
      // Give backend time to clean up
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Clean up environment
      delete process.env.MCP_TERMINAL_BACKEND;
    });
    
    describe('Basic Operations', () => {
      let testTerminalId;
      
      before(async () => {
        // Open a terminal for these tests
        const result = await client.callTool({
          name: 'mcpretentious-open',
          arguments: {}
        });
        
        // Debug: log the actual response
        if (VERBOSE || backend === 'tmux') {
          console.log(`[${backend}] Open response:`, result.content[0].text);
        }
        
        testTerminalId = extractTerminalId(result.content[0].text);
        
        if (!testTerminalId) {
          throw new Error(`Failed to extract terminal ID from response: ${result.content[0].text}`);
        }
        
        openTerminals.push(testTerminalId);
        
        // Verify it's using the correct backend
        assert.ok(testTerminalId.startsWith(`${backend}:`), 
          `Terminal ID should start with ${backend}:, got ${testTerminalId}`);
        
        // Wait for terminal to be ready
        await new Promise(resolve => setTimeout(resolve, 300));
      });
      
      after(async () => {
        // Close this suite's terminal
        if (testTerminalId) {
          try {
            await client.callTool({
              name: 'mcpretentious-close',
              arguments: { terminalId: testTerminalId }
            });
            openTerminals = openTerminals.filter(id => id !== testTerminalId);
          } catch (error) {
            console.error(`Failed to close terminal ${testTerminalId}:`, error.message);
          }
        }
      });
      
      it('should open terminal and echo text', async () => {
        // Send echo command
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: testTerminalId,
            input: [`echo "Testing ${backend} backend"`, { key: 'enter' }]
          }
        });
        
        // Wait for command to execute
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Read the output
        const readResult = await client.callTool({
          name: 'mcpretentious-read',
          arguments: {
            terminalId: testTerminalId
          }
        });
        
        const output = readResult.content[0].text;
        assert.ok(output.includes(`Testing ${backend} backend`), 
          `Should see echo output for ${backend}. Actual output: ${output}`);
      });
      
      it('should handle special keys', async () => {
        // Test Ctrl+C to clear any pending input
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: testTerminalId,
            input: [{ key: 'ctrl-c' }]
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now send a command
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: testTerminalId,
            input: ['echo "After interrupt"', { key: 'enter' }]
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const readResult = await client.callTool({
          name: 'mcpretentious-read',
          arguments: {
            terminalId: testTerminalId,
            lines: 10
          }
        });
        
        const output = readResult.content[0].text;
        assert.ok(output.includes('After interrupt'), 
          `Should execute command after Ctrl+C for ${backend}`);
      });
      
      it('should get terminal info', async () => {
        const infoResult = await client.callTool({
          name: 'mcpretentious-info',
          arguments: { terminalId: testTerminalId }
        });
        
        const info = JSON.parse(infoResult.content[0].text);
        
        // Verify info structure
        assert.ok(info.terminalId === testTerminalId, 
          `Should have correct terminal ID for ${backend}`);
        // Backend names are capitalized in the API response
        const expectedBackendName = backend === 'iterm' ? 'iTerm2' : 'TMux';
        assert.ok(info.backend === expectedBackendName, 
          `Should report correct backend: expected ${expectedBackendName}, got ${info.backend}`);
        assert.ok(info.sessionId, 'Should have session ID');
        assert.ok(info.dimensions, 'Should have dimensions');
        assert.ok(typeof info.dimensions.columns === 'number', 'Should have columns');
        assert.ok(typeof info.dimensions.rows === 'number', 'Should have rows');
      });
      
      it('should list terminals', async () => {
        const listResult = await client.callTool({
          name: 'mcpretentious-list',
          arguments: {}
        });
        
        const sessions = JSON.parse(listResult.content[0].text);
        
        // Should find our test terminal
        const ourSession = sessions.find(s => s.terminalId === testTerminalId);
        assert.ok(ourSession, `Should find our terminal in the list for ${backend}`);
        // Backend names are capitalized in the API response
        const expectedBackendName = backend === 'iterm' ? 'iTerm2' : 'TMux';
        assert.ok(ourSession.backend === expectedBackendName, 
          `Listed terminal should have correct backend: expected ${expectedBackendName}, got ${ourSession.backend}`);
      });
    });
    
    describe('Screenshot', () => {
      let testTerminalId;
      
      before(async () => {
        const result = await client.callTool({
          name: 'mcpretentious-open',
          arguments: {}
        });
        testTerminalId = extractTerminalId(result.content[0].text);
        openTerminals.push(testTerminalId);
        await new Promise(resolve => setTimeout(resolve, 300));
      });
      
      after(async () => {
        if (testTerminalId) {
          try {
            await client.callTool({
              name: 'mcpretentious-close',
              arguments: { terminalId: testTerminalId }
            });
            openTerminals = openTerminals.filter(id => id !== testTerminalId);
          } catch (error) {
            console.error(`Failed to close terminal ${testTerminalId}:`, error.message);
          }
        }
      });
      
      it('should capture screenshot', async () => {
        // Add some content
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: testTerminalId,
            input: [`echo "Screenshot test for ${backend}"`, { key: 'enter' }]
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Get screenshot
        const result = await client.callTool({
          name: 'mcpretentious-screenshot',
          arguments: { 
            terminalId: testTerminalId,
            layers: ['text', 'cursor']
          }
        });
        
        const screenshot = JSON.parse(result.content[0].text);
        
        // Verify screenshot structure
        assert.ok(screenshot.terminal, `Should have terminal info for ${backend}`);
        assert.ok(screenshot.viewport, `Should have viewport info for ${backend}`);
        assert.ok(screenshot.cursor, `Should have cursor info for ${backend}`);
        assert.ok(Array.isArray(screenshot.text), `Should have text array for ${backend}`);
        assert.ok(screenshot.text.length > 0, `Should have screen content for ${backend}`);
        
        // Check if our text is visible
        const fullText = screenshot.text.join('\n');
        assert.ok(fullText.includes('Screenshot test') || fullText.includes(backend), 
          `Should capture our test text for ${backend}`);
      });
    });
    
    describe('Mouse Support', () => {
      let testTerminalId;
      
      before(async () => {
        // Open a terminal for mouse tests
        const result = await client.callTool({
          name: 'mcpretentious-open',
          arguments: {}
        });
        testTerminalId = extractTerminalId(result.content[0].text);
        openTerminals.push(testTerminalId);
        
        // Wait for terminal to be ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear terminal and prepare for mouse tests
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: testTerminalId,
            input: ['clear', { key: 'enter' }]
          }
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      after(async () => {
        if (testTerminalId) {
          try {
            await client.callTool({
              name: 'mcpretentious-close',
              arguments: { terminalId: testTerminalId }
            });
            openTerminals = openTerminals.filter(id => id !== testTerminalId);
          } catch (error) {
            console.error(`Failed to close terminal ${testTerminalId}:`, error.message);
          }
        }
      });
      
      it('should send mouse click events', async () => {
        // Send a left click at position (10, 5)
        const clickResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 10,
            y: 5,
            button: 'left'
          }
        });
        
        assert.ok(clickResult.content[0].text.includes('Mouse press: left at (10, 5)'),
          `Should confirm left mouse press for ${backend}`);
        
        // Send release
        const releaseResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'release',
            x: 10,
            y: 5,
            button: 'left'
          }
        });
        
        assert.ok(releaseResult.content[0].text.includes('Mouse release: left at (10, 5)'),
          `Should confirm left mouse release for ${backend}`);
      });
      
      it('should send mouse drag events', async () => {
        // Start drag
        await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 5,
            y: 5,
            button: 'left'
          }
        });
        
        // Drag motion
        const dragResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'drag',
            x: 15,
            y: 10,
            button: 'left'
          }
        });
        
        assert.ok(dragResult.content[0].text.includes('Mouse drag: left at (15, 10)'),
          `Should confirm mouse drag for ${backend}`);
        
        // End drag
        await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'release',
            x: 15,
            y: 10,
            button: 'left'
          }
        });
      });
      
      it('should send mouse scroll events', async () => {
        // Scroll up
        const scrollUpResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 20,
            y: 10,
            button: 'scrollUp'
          }
        });
        
        assert.ok(scrollUpResult.content[0].text.includes('scrollUp at (20, 10)'),
          `Should confirm scroll up for ${backend}`);
        
        // Scroll down
        const scrollDownResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 20,
            y: 10,
            button: 'scrollDown'
          }
        });
        
        assert.ok(scrollDownResult.content[0].text.includes('scrollDown at (20, 10)'),
          `Should confirm scroll down for ${backend}`);
      });
      
      it('should handle mouse events with modifiers', async () => {
        // Click with shift modifier
        const shiftClickResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 10,
            y: 5,
            button: 'left',
            modifiers: { shift: true }
          }
        });
        
        assert.ok(shiftClickResult.content[0].text.includes('with Shift'),
          `Should indicate shift modifier for ${backend}`);
        
        // Release with shift
        await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'release',
            x: 10,
            y: 5,
            button: 'left',
            modifiers: { shift: true }
          }
        });
        
        // Click with multiple modifiers
        const multiModResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 10,
            y: 5,
            button: 'right',
            modifiers: { ctrl: true, alt: true }
          }
        });
        
        assert.ok(multiModResult.content[0].text.includes('Ctrl') && 
                  multiModResult.content[0].text.includes('Alt'),
          `Should indicate multiple modifiers for ${backend}`);
        
        // Release
        await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'release',
            x: 10,
            y: 5,
            button: 'right',
            modifiers: { ctrl: true, alt: true }
          }
        });
      });
      
      it('should handle different mouse buttons', async () => {
        // Middle button click
        const middleResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 15,
            y: 8,
            button: 'middle'
          }
        });
        
        assert.ok(middleResult.content[0].text.includes('middle'),
          `Should handle middle button for ${backend}`);
        
        await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'release',
            x: 15,
            y: 8,
            button: 'middle'
          }
        });
        
        // Right button click
        const rightResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 25,
            y: 12,
            button: 'right'
          }
        });
        
        assert.ok(rightResult.content[0].text.includes('right'),
          `Should handle right button for ${backend}`);
        
        await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'release',
            x: 25,
            y: 12,
            button: 'right'
          }
        });
      });
      
      it('should handle direct button codes', async () => {
        // Use direct button code (button-3 for example)
        const buttonCodeResult = await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'press',
            x: 30,
            y: 15,
            button: 'button-3'
          }
        });
        
        assert.ok(buttonCodeResult.content[0].text.includes('button 3'),
          `Should handle direct button codes for ${backend}`);
        
        await client.callTool({
          name: 'mcpretentious-mouse',
          arguments: {
            terminalId: testTerminalId,
            event: 'release',
            x: 30,
            y: 15,
            button: 'button-3'
          }
        });
      });
    });
    
    describe('Multiple Terminals', () => {
      it('should handle multiple terminals', async () => {
        // Open first terminal
        const result1 = await client.callTool({
          name: 'mcpretentious-open',
          arguments: {}
        });
        const terminal1 = extractTerminalId(result1.content[0].text);
        openTerminals.push(terminal1);
        
        // Open second terminal  
        const result2 = await client.callTool({
          name: 'mcpretentious-open',
          arguments: {}
        });
        const terminal2 = extractTerminalId(result2.content[0].text);
        openTerminals.push(terminal2);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Both should be using the same backend
        assert.ok(terminal1.startsWith(`${backend}:`), 
          `First terminal should use ${backend}`);
        assert.ok(terminal2.startsWith(`${backend}:`), 
          `Second terminal should use ${backend}`);
        
        // Send different echo to each
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: terminal1,
            input: [`echo "Terminal ONE ${backend}"`, { key: 'enter' }]
          }
        });
        
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: terminal2,
            input: [`echo "Terminal TWO ${backend}"`, { key: 'enter' }]
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Read from each
        const read1 = await client.callTool({
          name: 'mcpretentious-read',
          arguments: {
            terminalId: terminal1,
            lines: 5
          }
        });
        
        const read2 = await client.callTool({
          name: 'mcpretentious-read',
          arguments: {
            terminalId: terminal2,
            lines: 5
          }
        });
        
        assert.ok(read1.content[0].text.includes('Terminal ONE'), 
          `First terminal should show ONE for ${backend}`);
        assert.ok(read2.content[0].text.includes('Terminal TWO'), 
          `Second terminal should show TWO for ${backend}`);
        
        // Clean up
        await client.callTool({
          name: 'mcpretentious-close',
          arguments: { terminalId: terminal1 }
        });
        await client.callTool({
          name: 'mcpretentious-close',
          arguments: { terminalId: terminal2 }
        });
        
        openTerminals = openTerminals.filter(id => id !== terminal1 && id !== terminal2);
      });
    });
    
    if (backend === 'iterm') {
      describe('iTerm2-specific features', () => {
        it('should resize terminal', async () => {
          // Open a terminal
          const openResult = await client.callTool({
            name: 'mcpretentious-open',
            arguments: {}
          });
          const terminalId = extractTerminalId(openResult.content[0].text);
          openTerminals.push(terminalId);
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Resize terminal
          const resizeResult = await client.callTool({
            name: 'mcpretentious-resize',
            arguments: {
              terminalId,
              columns: 100,
              rows: 30
            }
          });
          
          assert.ok(resizeResult.content[0].text.includes('100×30'), 
            'Should confirm new dimensions for iTerm2');
          
          // Clean up
          await client.callTool({
            name: 'mcpretentious-close',
            arguments: { terminalId }
          });
          openTerminals = openTerminals.filter(id => id !== terminalId);
        });
      });
    }
    
    if (backend === 'tmux') {
      describe('tmux-specific features', () => {
        it('should work with tmux session naming', async () => {
          // Open a terminal - tmux uses session names
          const openResult = await client.callTool({
            name: 'mcpretentious-open',
            arguments: {}
          });
          const terminalId = extractTerminalId(openResult.content[0].text);
          openTerminals.push(terminalId);
          
          // Terminal ID should include tmux session name format
          assert.ok(terminalId.startsWith('tmux:'), 
            'Terminal ID should indicate tmux backend');
          
          // The session part should follow tmux naming conventions
          const sessionName = terminalId.split(':')[1];
          assert.ok(/^mcp-[a-f0-9]{8}$/.test(sessionName), 
            `tmux session name should follow pattern: ${sessionName}`);
          
          // Clean up
          await client.callTool({
            name: 'mcpretentious-close',
            arguments: { terminalId }
          });
          openTerminals = openTerminals.filter(id => id !== terminalId);
        });
      });
    }
  });
}

console.log('\n✅ Multi-backend integration tests completed');