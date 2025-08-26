/**
 * Test suite for MCPretentious with mocked execution
 * Uses Node's built-in test runner for ESM compatibility
 */

import { test, describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

describe('MCPretentious Tests with Real Server', () => {
  let client;
  let transport;
  let serverProcess;
  
  before(async () => {
    // Create transport that will spawn the server
    transport = new StdioClientTransport({
      command: 'node',
      args: [join(__dirname, '..', 'mcpretentious.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });
    
    // Create client
    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    });
    
    // Connect client
    await client.connect(transport);
    
    // Wait for connection to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
  });
  
  after(async () => {
    // Clean up
    await client?.close();
    await transport?.close();
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  });
  
  describe('Tool Registration', () => {
    it('should have all 8 tools registered', async () => {
      const tools = await client.listTools();
      
      assert.strictEqual(tools.tools.length, 8, 'Should have exactly 8 tools');
      
      const toolNames = tools.tools.map(t => t.name);
      assert.ok(toolNames.includes('mcpretentious-open'), 'Should have mcpretentious-open');
      assert.ok(toolNames.includes('mcpretentious-read'), 'Should have mcpretentious-read');
      assert.ok(toolNames.includes('mcpretentious-screenshot'), 'Should have mcpretentious-screenshot');
      assert.ok(toolNames.includes('mcpretentious-close'), 'Should have mcpretentious-close');
      assert.ok(toolNames.includes('mcpretentious-list'), 'Should have mcpretentious-list');
      assert.ok(toolNames.includes('mcpretentious-type'), 'Should have mcpretentious-type');
      assert.ok(toolNames.includes('mcpretentious-info'), 'Should have mcpretentious-info');
      assert.ok(toolNames.includes('mcpretentious-resize'), 'Should have mcpretentious-resize');
    });
    
    it('should have correct schema for mcpretentious-open', async () => {
      const tools = await client.listTools();
      const openTool = tools.tools.find(t => t.name === 'mcpretentious-open');
      
      assert.ok(openTool, 'mcpretentious-open tool should exist');
      assert.ok(openTool.description.includes('Opens a new terminal window'), 'Should have proper description');
      assert.ok(openTool.inputSchema.properties.columns, 'Should have columns parameter');
      assert.ok(openTool.inputSchema.properties.rows, 'Should have rows parameter');
      assert.strictEqual(openTool.inputSchema.properties.columns.type, 'number', 'Columns should be number');
      assert.strictEqual(openTool.inputSchema.properties.rows.type, 'number', 'Rows should be number');
    });
    
    it('should have correct schema for mcpretentious-read', async () => {
      const tools = await client.listTools();
      const readTool = tools.tools.find(t => t.name === 'mcpretentious-read');
      
      assert.ok(readTool, 'mcpretentious-read tool should exist');
      assert.ok(readTool.inputSchema.properties.terminalId, 'Should have terminalId parameter');
      assert.ok(readTool.inputSchema.properties.lines, 'Should have lines parameter');
      assert.ok(!readTool.inputSchema.properties.visible_only, 'Should not have visible_only parameter anymore');
      assert.deepStrictEqual(readTool.inputSchema.required, ['terminalId'], 'Only terminalId should be required');
    });
    
    it('should have correct schema for mcpretentious-type', async () => {
      const tools = await client.listTools();
      const typeTool = tools.tools.find(t => t.name === 'mcpretentious-type');
      
      assert.ok(typeTool, 'mcpretentious-type tool should exist');
      assert.ok(typeTool.inputSchema.properties.terminalId, 'Should have terminalId parameter');
      assert.ok(typeTool.inputSchema.properties.input, 'Should have input parameter');
      assert.deepStrictEqual(typeTool.inputSchema.required, ['terminalId', 'input'], 'Both parameters should be required');
      
      // Check that description includes supported keys
      assert.ok(typeTool.description.includes('ctrl-c'), 'Description should list supported keys');
      assert.ok(typeTool.description.includes('enter'), 'Description should list supported keys');
      assert.ok(typeTool.description.includes('escape'), 'Description should list supported keys');
    });
    
    it('should have correct schema for mcpretentious-close', async () => {
      const tools = await client.listTools();
      const closeTool = tools.tools.find(t => t.name === 'mcpretentious-close');
      
      assert.ok(closeTool, 'mcpretentious-close tool should exist');
      assert.ok(closeTool.inputSchema.properties.terminalId, 'Should have terminalId parameter');
      assert.deepStrictEqual(closeTool.inputSchema.required, ['terminalId'], 'terminalId should be required');
    });
    
    it('should have correct schema for mcpretentious-list', async () => {
      const tools = await client.listTools();
      const listTool = tools.tools.find(t => t.name === 'mcpretentious-list');
      
      assert.ok(listTool, 'mcpretentious-list tool should exist');
      assert.deepStrictEqual(listTool.inputSchema.properties, {}, 'Should have no parameters');
    });
  });
  
  describe('Input Validation', () => {
    it('should handle non-existent terminal ID', async () => {
      const result = await client.callTool({
        name: 'mcpretentious-read',
        arguments: {
          terminalId: 'non-existent-terminal-id'
        }
      });
      
      assert.ok(result.content[0].text.includes('Terminal not found'), 'Should return error for non-existent terminal');
    });
    
    it('should reject out-of-range ASCII codes', async () => {
      try {
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: 'mock-session-uuid-1',
            input: [256] // Out of range
          }
        });
        assert.fail('Should have thrown an error for out-of-range ASCII code');
      } catch (error) {
        assert.ok(error.message.includes('less than or equal to 255') || error.message.includes('Invalid'), 'Should reject ASCII code > 255');
      }
    });
    
    it('should reject negative ASCII codes', async () => {
      try {
        await client.callTool({
          name: 'mcpretentious-type',
          arguments: {
            terminalId: 'mock-session-uuid-1',
            input: [-1] // Negative
          }
        });
        assert.fail('Should have thrown an error for negative ASCII code');
      } catch (error) {
        assert.ok(error.message.includes('greater than or equal to 0') || error.message.includes('Invalid'), 'Should reject negative ASCII codes');
      }
    });
    
    it('should reject unknown special keys', async () => {
      const result = await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: 'mock-session-uuid-1',
          input: [{ key: 'nonexistent-key' }]
        }
      });
      
      assert.ok(result.content[0].text.includes('Unknown key'), 'Should reject unknown special keys');
      assert.ok(result.content[0].text.includes('Available keys'), 'Should list available keys');
    });
    
    it('should handle empty input array', async () => {
      const result = await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: 'mock-session-uuid-1',
          input: []
        }
      });
      
      assert.ok(result.content[0].text.includes('Empty sequence'), 'Should handle empty input gracefully');
    });
    
    it('should handle non-existent terminal ID in close', async () => {
      const result = await client.callTool({
        name: 'mcpretentious-close',
        arguments: {
          terminalId: 'non-existent-uuid'
        }
      });
      
      assert.ok(result.content[0].text.includes('Terminal not found'), 'Should handle non-existent terminal');
    });
  });
  
  describe('Terminal Operations (Mock)', () => {
    it('should handle list operation', async () => {
      const result = await client.callTool({
        name: 'mcpretentious-list',
        arguments: {}
      });
      
      // The list tool now returns JSON array
      const text = result.content[0].text;
      assert.ok(text.startsWith('[') || text.includes('No active terminal sessions'), 'Should return JSON array or no sessions message');
    });
    
    it('should accept valid terminal ID format', async () => {
      const result = await client.callTool({
        name: 'mcpretentious-read',
        arguments: {
          terminalId: 'mock-session-uuid-2'
        }
      });
      
      // Won't find the terminal, but should accept the format
      assert.ok(
        result.content[0].text.includes('not found') || 
        result.content[0].text.includes('output'),
        'Should process valid ID format'
      );
    });
    
    it('should accept mixed input types', async () => {
      const result = await client.callTool({
        name: 'mcpretentious-type',
        arguments: {
          terminalId: 'mock-session-uuid-1',
          input: [
            'text',
            65,
            { key: 'enter' }
          ]
        }
      });
      
      // Check that it processes the input (even if terminal doesn't exist)
      assert.ok(
        result.content[0].text.includes('Sent sequence of 3 items') ||
        result.content[0].text.includes('not found'),
        'Should accept mixed input types'
      );
    });
  });
});