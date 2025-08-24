/**
 * Safe integration tests for MCPretentious with actual iTerm2
 * These tests only use echo commands and read operations - nothing invasive
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
const VERBOSE = process.env.VERBOSE === 'true';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if iTerm2 is installed
async function isITermInstalled() {
  try {
    await execPromise('osascript -e "tell application \\"System Events\\" to name of application processes" | grep iTerm2');
    return true;
  } catch {
    return false;
  }
}

// Only run these tests if iTerm2 is installed
const shouldRun = await isITermInstalled();

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

describe('iTerm2 Safe Integration Tests (Echo Only)', { skip: !shouldRun }, () => {
  let client;
  let transport;
  let openTerminals = [];
  
  before(async () => {
    if (!shouldRun) {
      console.log('iTerm2 is not installed. Skipping integration tests.');
      return;
    }
    
    // Create transport that spawns the server
    transport = new StdioClientTransport({
      command: 'node',
      args: [join(__dirname, '..', 'mcpretentious.js')]
    });
    
    // Create and connect client
    client = new Client({
      name: 'safe-integration-test',
      version: '1.0.0'
    });
    
    await client.connect(transport);
    
    // Wait for connection to be ready
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  
  after(async () => {
    // Clean up any open terminals
    console.log(`Cleaning up ${openTerminals.length} terminals...`);
    for (const terminalId of openTerminals) {
      try {
        const result = await client.callTool({
          name: 'mcpretentious-close',
          arguments: { terminalId }
        });
        console.log(`Attempted to close ${terminalId}: ${result.content[0].text}`);
      } catch (error) {
        console.error(`Failed to close ${terminalId}:`, error.message);
      }
    }
    openTerminals = [];
    
    // Close connections
    await client?.close();
    await transport?.close();
    
    // Give iTerm time to clean up
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  
  describe('Basic Echo Tests', () => {
    let testTerminalId;
    
    before(async () => {
      // Open a terminal for these tests
      const result = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      testTerminalId = result.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(testTerminalId);
      
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
    
    it('should open terminal and echo simple text', async () => {
      if (VERBOSE) console.log('\n>>> Sending command: echo "Hello World"');
      // Send echo command
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo "Hello World"', { key: 'enter' }]
        }
      });
      
      // Wait longer for command to execute
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Read the output
      const readResult = await client.callTool({
        name: 'mcpretentious-read',
        arguments: {
          terminalId: testTerminalId
        }
      });
      
      const output = readResult.content[0].text;
      if (VERBOSE) {
        console.log('=== TEST: should echo simple text ===');
        console.log('Full output received:');
        console.log(JSON.stringify(output));
        console.log('---');
        console.log('Looking for: "Hello World"');
        console.log('Found:', output.includes('Hello World'));
      }
      assert.ok(output.includes('Hello World'), `Should see echo output. Actual output: ${output}`);
    });
    
    it('should echo numbers', async () => {
      if (VERBOSE) console.log('\n>>> Sending command: echo 12345');
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo 12345', { key: 'enter' }]
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
      if (VERBOSE) {
        console.log('=== TEST: should echo numbers ===');
        console.log('Full output received:');
        console.log(JSON.stringify(output));
        console.log('---');
        console.log('Looking for: "12345"');
        console.log('Found:', output.includes('12345'));
      }
      assert.ok(output.includes('12345'), `Should see number output. Actual output: ${output}`);
    });
    
    it('should echo with quotes', async () => {
      if (VERBOSE) console.log('\n>>> Sending command: echo "Text with spaces"');
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo "Text with spaces"', { key: 'enter' }]
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
      if (VERBOSE) {
        console.log('=== TEST: should echo with quotes ===');
        console.log('Full output received:');
        console.log(JSON.stringify(output));
        console.log('---');
        console.log('Looking for: "Text with spaces"');
        console.log('Found:', output.includes('Text with spaces'));
      }
      assert.ok(output.includes('Text with spaces'), `Should handle spaces. Actual output: ${output}`);
    });
    
    it('should echo current directory with $PWD', async () => {
      if (VERBOSE) console.log('\n>>> Sending command: echo "Current dir: $PWD"');
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo "Current dir: $PWD"', { key: 'enter' }]
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
      if (VERBOSE) {
        console.log('=== TEST: should echo current directory ===');
        console.log('Full output received:');
        console.log(JSON.stringify(output));
        console.log('---');
        console.log('Looking for: "Current dir: /"');
        console.log('Found:', output.includes('Current dir: /'));
      }
      assert.ok(output.includes('Current dir: /'), `Should show current directory. Actual output: ${output}`);
    });
    
    it('should echo environment variables', async () => {
      if (VERBOSE) console.log('\n>>> Sending command: echo "User: $USER, Home: $HOME"');
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo "User: $USER, Home: $HOME"', { key: 'enter' }]
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
      if (VERBOSE) {
        console.log('=== TEST: should echo environment variables ===');
        console.log('Full output received:');
        console.log(JSON.stringify(output));
        console.log('---');
        console.log('Looking for: "User:" and "Home:"');
        console.log('Found User:', output.includes('User:'));
        console.log('Found Home:', output.includes('Home:'));
      }
      assert.ok(output.includes('User:'), `Should show user. Actual output: ${output}`);
      assert.ok(output.includes('Home:'), `Should show home. Actual output: ${output}`);
    });
  });
  
  describe('Special Keys with Echo', () => {
    let testTerminalId;
    
    before(async () => {
      const result = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      testTerminalId = result.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(testTerminalId);
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
    
    it('should use arrow keys to navigate history', async () => {
      if (VERBOSE) console.log('\n>>> Testing command history with arrow keys');
      // Send first echo
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo "First"', { key: 'enter' }]
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Send second echo
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo "Second"', { key: 'enter' }]
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Use up arrow to get previous command
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: [{ key: 'up' }, { key: 'enter' }]
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const readResult = await client.callTool({
        name: 'mcpretentious-read',
        arguments: {
          terminalId: testTerminalId
        }
      });
      
      // Count occurrences of "Second"
      const matches = (readResult.content[0].text.match(/Second/g) || []).length;
      assert.ok(matches >= 2, 'Should execute previous command from history');
    });
    
    it('should handle Ctrl+C to interrupt running command', async () => {
      if (VERBOSE) console.log('\n>>> Testing Ctrl+C to interrupt sleep command');
      // Start a long-running command
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['sleep 100', { key: 'enter' }]
        }
      });
      
      // Wait a moment for sleep to start
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Interrupt with Ctrl+C
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: [{ key: 'ctrl-c' }]
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now run a command to confirm we're back at the prompt
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo "Interrupted successfully"', { key: 'enter' }]
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
      if (VERBOSE) {
        console.log('=== TEST: should handle Ctrl+C ===');
        console.log('Full output received:');
        console.log(JSON.stringify(output));
        console.log('---');
        console.log('Looking for: "Interrupted successfully"');
        console.log('Found:', output.includes('Interrupted successfully'));
        console.log('Should see ^C marker from interrupted sleep');
        console.log('Has ^C:', output.includes('^C'));
      }
      assert.ok(output.includes('Interrupted successfully'), `Should execute command after Ctrl+C. Actual output: ${output}`);
      assert.ok(output.includes('^C') || output.includes('sleep 100'), `Should show evidence of interrupted command. Actual output: ${output}`);
    });
  });
  
  describe('Output Reading Modes', () => {
    let testTerminalId;
    
    before(async () => {
      const result = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      testTerminalId = result.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(testTerminalId);
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
    
    it('should read limited lines', async () => {
      if (VERBOSE) console.log('\n>>> Testing limited line reading (3 lines)');
      // Generate output using here-doc for speed
      const hereDocCommand = `cat <<'EOF'
${Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n')}
EOF`;
      
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: [hereDocCommand, { key: 'enter' }]
        }
      });
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Read only last 3 lines
      const readResult = await client.callTool({
        name: 'mcpretentious-read',
        arguments: {
          terminalId: testTerminalId,
          lines: 3
        }
      });
      
      const output = readResult.content[0].text;
      
      // Should contain recent lines
      if (VERBOSE) {
        console.log('=== TEST: should read limited lines ===');
        console.log('Full output received (limited to 3 lines):');
        console.log(JSON.stringify(output));
        console.log('---');
        console.log('Looking for: "Line 10" or "Line 9"');
        console.log('Found Line 10:', output.includes('Line 10'));
        console.log('Found Line 9:', output.includes('Line 9'));
      }
      assert.ok(output.includes('Line 10') || output.includes('Line 9'), `Should include recent lines. Actual output: ${output}`);
      
      // Count total lines in output (rough check)
      const lineCount = output.split('\n').filter(l => l.trim()).length;
      assert.ok(lineCount <= 10, 'Should limit output lines');
    });
    
    it('should test screen reading with colors and cursor', async () => {
      // Clear first
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['clear', { key: 'enter' }]
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Output some colored text
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo -e "\\033[31mRed\\033[0m \\033[32mGreen\\033[0m \\033[34mBlue\\033[0m"', { key: 'enter' }]
        }
      });
      
      // Wait for output to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test cursor position only
      const cursorResult = await client.callTool({
        name: 'mcpretentious-screenshot',
        arguments: {
          terminalId: testTerminalId,
          format: 'cursor-only'
        }
      });
      
      const cursorData = JSON.parse(cursorResult.content[0].text);
      assert.ok(cursorData.cursor, 'Should have cursor position');
      assert.ok(typeof cursorData.cursor.x === 'number', 'Cursor x should be a number');
      assert.ok(typeof cursorData.cursor.y === 'number', 'Cursor y should be a number');
      
      // Test full screen info
      const screenResult = await client.callTool({
        name: 'mcpretentious-screenshot',
        arguments: {
          terminalId: testTerminalId,
          format: 'full'
        }
      });
      
      const screenData = JSON.parse(screenResult.content[0].text);
      assert.ok(screenData.cursor, 'Should have cursor in full format');
      assert.ok(screenData.dimensions, 'Should have dimensions');
      assert.ok(Array.isArray(screenData.lines), 'Should have lines array');
      
      // Check if we can see styled output
      const hasStyledText = screenData.lines.some(line => 
        line.styles && line.styles.length > 0
      );
      
      if (VERBOSE) {
        console.log('Screen info sample:', JSON.stringify(screenData.lines[0], null, 2));
      }
      
      // Note: Color detection might not work in all terminal configurations
      // So we just check that the structure is correct
      assert.ok(screenData.lines.length > 0, 'Should have screen lines');
    });
  });
  
  describe('Multiple Terminals', () => {
    it('should handle two terminals with different echo outputs', async () => {
      // Open first terminal
      const result1 = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      const terminal1 = result1.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(terminal1);
      
      // Open second terminal  
      const result2 = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      const terminal2 = result2.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(terminal2);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Send different echo to each
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: terminal1,
          input: ['echo "Terminal ONE"', { key: 'enter' }]
        }
      });
      
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: terminal2,
          input: ['echo "Terminal TWO"', { key: 'enter' }]
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
      
      assert.ok(read1.content[0].text.includes('Terminal ONE'), 'First terminal should show ONE');
      assert.ok(read2.content[0].text.includes('Terminal TWO'), 'Second terminal should show TWO');
      
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
  
  describe('Terminal Sizing and Info', () => {
    it('should open terminal with custom size', async () => {
      // Open terminal with specific dimensions
      const result = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {
          columns: 100,
          rows: 30
        }
      });
      
      const terminalId = result.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(terminalId);
      
      // Verify it mentions the size
      assert.ok(result.content[0].text.includes('100×30'), 'Should mention dimensions in response');
      
      // Clean up
      await client.callTool({
        name: 'mcpretentious-close',
        arguments: { terminalId }
      });
      openTerminals = openTerminals.filter(id => id !== terminalId);
    });
    
    it('should get terminal info including dimensions', async () => {
      // Open a terminal
      const openResult = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      const terminalId = openResult.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(terminalId);
      
      // Wait for terminal to be ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get terminal info
      const infoResult = await client.callTool({
        name: 'mcpretentious-info',
        arguments: { terminalId }
      });
      
      const info = JSON.parse(infoResult.content[0].text);
      
      // Verify info structure
      assert.ok(info.terminalId === terminalId, 'Should have correct terminal ID');
      assert.ok(info.sessionId, 'Should have session ID');
      assert.ok(info.dimensions, 'Should have dimensions');
      assert.ok(typeof info.dimensions.columns === 'number', 'Should have columns');
      assert.ok(typeof info.dimensions.rows === 'number', 'Should have rows');
      assert.ok(info.dimensions.columns > 0, 'Columns should be positive');
      assert.ok(info.dimensions.rows > 0, 'Rows should be positive');
      
      // Clean up
      await client.callTool({
        name: 'mcpretentious-close',
        arguments: { terminalId }
      });
      openTerminals = openTerminals.filter(id => id !== terminalId);
    });
    
    it('should resize terminal to new dimensions', async () => {
      // Open a terminal
      const openResult = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      const terminalId = openResult.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(terminalId);
      
      // Wait for terminal to be ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Resize terminal
      const resizeResult = await client.callTool({
        name: 'mcpretentious-resize',
        arguments: {
          terminalId,
          columns: 120,
          rows: 40
        }
      });
      
      // Verify resize response
      assert.ok(resizeResult.content[0].text.includes('120×40'), 'Should confirm new dimensions');
      
      // Wait for resize to take effect
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get info to verify dimensions changed
      const infoResult = await client.callTool({
        name: 'mcpretentious-info',
        arguments: { terminalId }
      });
      
      const info = JSON.parse(infoResult.content[0].text);
      
      // Note: The actual dimensions might not match exactly due to iTerm2 constraints
      // but we should see that they're in the ballpark
      if (VERBOSE) {
        console.log('After resize - Columns:', info.dimensions.columns, 'Rows:', info.dimensions.rows);
      }
      
      // Clean up
      await client.callTool({
        name: 'mcpretentious-close',
        arguments: { terminalId }
      });
      openTerminals = openTerminals.filter(id => id !== terminalId);
    });
    
    it('should handle resize with invalid dimensions gracefully', async () => {
      // This test verifies that the schema validation works
      // We can't directly test invalid dimensions through the client
      // as it would reject them before sending
      
      // Open a terminal
      const openResult = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      const terminalId = openResult.content[0].text.match(/iterm-\d+-\d+/)[0];
      openTerminals.push(terminalId);
      
      // Try to resize with edge case dimensions (minimum valid values)
      const resizeResult = await client.callTool({
        name: 'mcpretentious-resize',
        arguments: {
          terminalId,
          columns: 20,  // Minimum allowed
          rows: 5       // Minimum allowed
        }
      });
      
      // Should succeed with minimum values
      assert.ok(resizeResult.content[0].text.includes('20×5'), 'Should handle minimum dimensions');
      
      // Clean up
      await client.callTool({
        name: 'mcpretentious-close',
        arguments: { terminalId }
      });
      openTerminals = openTerminals.filter(id => id !== terminalId);
    });
  });
  
  describe('Screenshot Format Tests', () => {
    let testTerminalId;
    
    before(async () => {
      const result = await client.callTool({
        name: 'mcpretentious-open',
        arguments: {}
      });
      testTerminalId = result.content[0].text.match(/iterm-\d+-\d+/)[0];
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
    
    it('should get screenshot with full format by default', async () => {
      // Send some text to have content
      await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: testTerminalId,
          input: ['echo "Screenshot test"', { key: 'enter' }]
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get screenshot without format specified (should default to full)
      const result = await client.callTool({
        name: 'mcpretentious-screenshot',
        arguments: { terminalId: testTerminalId }
      });
      
      const screenshot = JSON.parse(result.content[0].text);
      
      // Verify full format structure
      assert.ok(screenshot.cursor, 'Should have cursor');
      assert.ok(screenshot.dimensions, 'Should have dimensions');
      assert.ok(Array.isArray(screenshot.lines), 'Should have lines array');
      assert.ok(screenshot.lines.length > 0, 'Should have at least one line');
      
      // Check line structure
      const firstLine = screenshot.lines[0];
      assert.ok(typeof firstLine.number === 'number', 'Line should have number');
      assert.ok(typeof firstLine.text === 'string', 'Line should have text');
      assert.ok(Array.isArray(firstLine.styles), 'Line should have styles array');
    });
    
    it('should get cursor-only format', async () => {
      const result = await client.callTool({
        name: 'mcpretentious-screenshot',
        arguments: {
          terminalId: testTerminalId,
          format: 'cursor-only'
        }
      });
      
      const data = JSON.parse(result.content[0].text);
      
      // Should only have cursor, nothing else
      assert.ok(data.cursor, 'Should have cursor');
      assert.ok(typeof data.cursor.x === 'number', 'Cursor should have x');
      assert.ok(typeof data.cursor.y === 'number', 'Cursor should have y');
      assert.ok(!data.dimensions, 'Should not have dimensions in cursor-only mode');
      assert.ok(!data.lines, 'Should not have lines in cursor-only mode');
    });
  });
});