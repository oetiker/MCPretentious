#!/usr/bin/env node

/**
 * MCPretentious Test Runner
 * 
 * Runs integration tests to verify MCPretentious can control iTerm2
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');

// Set environment variable for verbose output
if (verbose) {
  process.env.VERBOSE = 'true';
}

// Run the integration tests
const testFile = join(__dirname, 'test', 'integration.test.mjs');
const nodeArgs = ['--test', testFile];

console.log('Running MCPretentious integration tests...');
console.log('This will open and close iTerm2 windows to test functionality.\n');

const testProcess = spawn('node', nodeArgs, {
  stdio: 'inherit',
  env: process.env
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All tests passed! MCPretentious is working correctly.');
  } else {
    console.log('\n❌ Some tests failed. Please check the output above.');
    process.exit(code);
  }
});

testProcess.on('error', (err) => {
  console.error('Failed to run tests:', err);
  process.exit(1);
});