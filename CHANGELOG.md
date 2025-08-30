# Changelog

All notable changes to MCPretentious will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed
- Fixed missing `setSessionSize` method in tmux backend that prevented terminal resizing

## [1.2.2] - 2025-08-28

### Changed
- **Simplified mouse modifier API** - Modifiers are now top-level boolean properties instead of nested object:
  - Before: `modifiers: { shift: true, alt: true, ctrl: true }`
  - After: `shift: true, alt: true, ctrl: true`
  - Modifiers default to `false` when not specified
  - Cleaner architecture: modifier bit manipulation moved to protocol layer where it belongs
## [1.2.1] - 2025-08-28

### Added
- Comprehensive mouse integration tests covering all event types, buttons, and modifiers

### Changed
- **Refactored internal mouse architecture** for cleaner implementation:
  - Unified mouse protocol handling through single `generateMouseEvent()` function
  - Removed redundant convenience methods (`sendMouseClick`, `sendMouseDrag`, `sendMouseScroll`) from backends
  - Simplified `mouse-sgr-protocol.js` to eliminate duplicate logic
  - All backends now use consistent `sendMouseEvent()` method internally
- **Note**: External MCP API remains unchanged - these are internal improvements only

### Fixed
- Fixed async command execution in tmux mouse methods to prevent "no server running" errors
## [1.2.0] - 2025-08-28

### Changed
- **Redesigned mouse API to align with SGR protocol** - The `mcpretentious-mouse` tool now provides direct control over mouse events:
  - Changed from high-level actions (`click`, `drag`, `scroll`) to protocol-aligned events (`press`, `release`, `drag`)
  - Added support for named buttons (`left`, `middle`, `right`, `scrollUp`, `scrollDown`) and direct button codes (`button-0` through `button-127`)
  - Added keyboard modifier support (Shift, Alt, Ctrl) for all mouse events
  - Comprehensive in-tool documentation of all parameters and valid values
  - Mouse coordinates remain 0-based for developer convenience (converted to 1-based internally for SGR protocol)
## [1.1.1] - 2025-08-28

### Added
- **Mouse support for iTerm2 backend** - Extended mouse functionality to iTerm2
  - Uses the same SGR mouse protocol as tmux backend
  - Full parity with tmux mouse features (click, drag, scroll)
- Shared SGR mouse protocol module (`lib/mouse-sgr-protocol.js`) for code reuse
- Comprehensive unit tests for SGR mouse protocol generation

### Changed
- Refactored mouse implementation to eliminate code duplication between backends
- Both iTerm2 and tmux backends now use shared mouse protocol utilities

### Fixed
- Fixed tmux command escaping to properly handle bracket characters in mouse escape sequences
## [1.1.0] - 2025-08-28

### Added
- **Mouse support for TMux backend** - New `mcpretentious-mouse` tool for sending mouse interactions
  - Mouse click support (left, middle, right buttons) at specific coordinates
  - Mouse drag support from one position to another
  - Mouse scroll support (up/down) with configurable scroll amount
  - Automatic mouse mode activation in tmux when sending mouse events
  - Uses SGR mouse protocol via escape sequences for reliable event delivery
- Comprehensive test suite for mouse functionality (`test/tmux-mouse.test.mjs`)
- `close()` method implementation for TmuxClientSimple for interface compatibility
## [1.0.0] - 2025-08-26

### Added
- **TMux backend support** - MCPretentious now works on Linux, BSD, and headless servers via tmux control mode
- Backend abstraction layer supporting multiple terminal implementations
- Auto-detection of available backends (iTerm2 on macOS, tmux everywhere)
- Command-line options for backend selection (`--backend=auto|iterm|tmux|api`)
- **API mode** (`--backend=api`) - Lets LLM choose backend per session when multiple backends available
- Dynamic tool schema - `backend` parameter only shown to LLM when relevant (API mode with 2+ backends)
- `MCP_TERMINAL_BACKEND` environment variable for default backend selection
- ANSI escape sequence parser for tmux color and style support
- Structured JSON screenshot format for tmux (matching iTerm2 API)
- Cross-platform terminal control with unified API
- Comprehensive error handling when no backends are available
- Help option (`--help`) showing all available CLI arguments

### Changed
- Complete architecture refactor to support multiple backends
- Terminal IDs now use format `{backend}:{sessionId}` (e.g., `iterm:uuid`, `tmux:session-name`)
- Main entry point now initializes backend manager before starting server
- Tool descriptions updated to be backend-agnostic
- Tools now registered after backend initialization for dynamic schemas
- Package description updated to reflect cross-platform support

### Fixed
- iTerm2 closeSession now properly converts windowId to string for protobuf
## [0.2.5] - 2025-08-25


## [0.2.4] - 2025-08-25

### Fixed
- Screenshot dimensions now correctly account for iTerm2's grid_size being 1 less than actual content dimensions (width + 1, height + 1)
## [0.2.3] - 2025-08-25

### Added
- New `getProperty` method in iTerm2Client to query terminal properties directly from iTerm2 API
- Integration tests for wide terminal support (132 columns) and dimension reporting accuracy

### Fixed
- Terminal dimension reporting now uses actual dimensions from iTerm2's `grid_size` property instead of hardcoded 80x24 defaults
## [0.2.2] - 2025-08-25

### Changed
- Terminal IDs now use iTerm2 session UUIDs directly instead of generated IDs
- Terminals persist across MCP restarts (as long as tabs remain open)
- Simplified codebase by removing ID mapping layer

### Fixed
- Fixed terminal discovery after MCP restart - all existing terminals are now accessible
## [0.2.1] - 2025-08-25

### Fixed
- test script to only test current functionality

## [0.2.0] - 2025-08-25

### Added
- New layered screenshot format for `mcpretentious-screenshot` tool with configurable data layers
- Support for viewport limiting with `region` and `aroundCursor` parameters
- Individual style layers (`bold`, `italic`, `underline`) in addition to combined `styles` layer
- Color layers (`fgColors`, `bgColors`) with optimized palette encoding
- Compact mode to skip empty lines and reduce output size
- Token usage reduction of 85-98% compared to previous format

### Changed
- Replaced `format` parameter with `layers` array in screenshot tool
- Changed coordinate naming from `x`/`y` to `left`/`top` for clarity
- Default screenshot output now returns minimal data (text + cursor) instead of full format
- Response structure now includes `terminal`, `viewport`, and relative cursor positions
- Style encoding uses compact single-character representation

### Fixed
- Screenshot output size issue that exceeded 25,000 token MCP limit
## [0.1.5] - 2025-08-25

### Fixed
- Fixed package.json files array to include actual entry points (mcpretentious.js, mcpretentious-test.js)
## [0.1.4] - 2025-08-25

### Changed
- Switched license from ISC to MIT


## [0.1.3] - 2025-08-24

### Fixed
- Fixed release notes extraction to properly capture subsection headers and content
## [0.1.2] - 2025-08-24

### Fixed
- Fixed CHANGELOG extraction in release workflow - was losing content from Unreleased section
## [0.1.1] - 2025-08-24

### Fixed
- Fixed GitHub Actions release workflow delimiter issue when extracting release notes
- Simplified release workflow to use Perl consistently instead of mixing with awk
- Added LATEST-CHANGES markers to README for automatic release notes updates
- Fixed release notes extraction to handle empty sections properly
- Fixed release workflow to wait for test runs to start and complete (was failing when tests hadn't started yet)
- Fixed GHADELIMITER issue by using random delimiter generated with openssl


## [0.1.0] - 2025-08-24

Initial Release

