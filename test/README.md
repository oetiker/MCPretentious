# MCPretentious Test Suite

This directory contains automated tests for the MCPretentious server using the Model Context Protocol SDK and Node.js's built-in test runner.

## Overview

The test suite validates the MCPretentious server functionality using the MCP SDK's testing capabilities. It uses Node's built-in test runner (available in Node.js 18+) which provides native ESM support without additional configuration.

## Test Files

- `test-with-mock.mjs` - Unit tests that validate protocol implementation without iTerm2:
  - Tool registration and schemas
  - Input validation
  - Error handling
  - Terminal operations (with mocked AppleScript)

- `iterm-safe-integration.test.mjs` - Integration tests that actually interact with iTerm2:
  - Opens real iTerm2 windows
  - Executes echo commands
  - Tests special key sequences
  - Validates output reading modes
  - Uses only safe, non-invasive commands

## Running Tests

### Prerequisites
- Node.js 18 or higher
- npm dependencies installed (`npm install`)
- iTerm2 installed (optional, for actual terminal operations)

### Commands

```bash
# Run unit tests (no iTerm2 required)
npm test

# Run integration tests (requires iTerm2)
npm run test:integration  

# Watch mode for development
npm run test:watch

# Run all test files
npm run test:all
```

## Test Coverage

The test suite covers:

### 1. Tool Registration (6 tests)
- Verifies all 5 tools are registered
- Validates input schemas for each tool
- Checks tool descriptions and required parameters
- Ensures proper Zod schema definitions

### 2. Input Validation (6 tests)
- Invalid terminal ID formats
- Out-of-range ASCII codes (0-255)
- Unknown special keys
- Empty input sequences
- Malformed data structures
- Schema validation via Zod

### 3. Terminal Operations (3 tests)
- Listing terminals
- Processing valid terminal IDs
- Handling mixed input types (text, ASCII, special keys)

## Implementation Details

### MCP SDK Features Used

1. **Client/Server Communication**
   - `StdioClientTransport` for spawning and communicating with the server
   - `Client` class for making tool calls
   - Proper connection and cleanup handling

2. **Tool Testing**
   - `listTools()` to verify registration
   - `callTool()` to test execution
   - Schema validation through the SDK

3. **Error Handling**
   - Zod schema validation at the SDK level
   - Custom error messages for business logic
   - Proper error propagation

### Test Architecture

The tests spawn the actual MCP server as a subprocess and communicate with it via stdio transport. This ensures:
- Real server behavior is tested
- Tool registration works correctly
- Input validation functions as expected
- AppleScript generation is validated (though execution is mocked on systems without iTerm2)

## CI/CD Integration

The test suite is integrated with GitHub Actions:
- Runs on macOS runners (latest and version 13)
- Tests with Node.js 18.x, 20.x, and 22.x
- Automatically installs iTerm2 if not present
- Validates on each push and pull request

## Writing New Tests

When adding new features:

1. Add test cases to `test-with-mock.mjs`
2. Follow the existing pattern using Node's test runner
3. Use descriptive test names and assertions
4. Ensure tests work both with and without iTerm2

Example test structure:
```javascript
it('should do something specific', async () => {
  const result = await client.callTool({
    name: 'tool-name',
    arguments: { /* args */ }
  });
  
  assert.ok(result.content[0].text.includes('expected'), 'Description');
});
```

## Troubleshooting

### Test Timeout
- Default timeout is sufficient for most tests
- Long-running operations may need adjustment

### Connection Issues
- Ensure the server starts correctly
- Check that stdio transport is properly configured
- Verify Node.js version is 18+

### iTerm2 Not Found
- Tests will still run with mocked AppleScript
- Install iTerm2 for full integration testing: `brew install --cask iterm2`

## Test Results

The test suite validates:
- ✅ All 5 tools are properly registered
- ✅ Input schemas match specifications
- ✅ Invalid inputs are rejected with appropriate errors
- ✅ Terminal ID validation works correctly
- ✅ Special key mappings are accurate
- ✅ ASCII code ranges are enforced
- ✅ Mixed input sequences are handled
- ✅ Error messages are informative

## Future Improvements

- Add performance benchmarks
- Test concurrent terminal operations
- Validate AppleScript generation in more detail
- Add integration tests with actual iTerm2 when available
- Test edge cases for terminal state management