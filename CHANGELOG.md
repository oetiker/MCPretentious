# Changelog

All notable changes to MCPretentious will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed
- Fixed GitHub Actions release workflow delimiter issue when extracting release notes
- Simplified release workflow to use Perl consistently instead of mixing with awk
- Added LATEST-CHANGES markers to README for automatic release notes updates
- Fixed release notes extraction to handle empty sections properly
- Fixed release workflow to wait for test runs to start and complete (was failing when tests hadn't started yet)
- Fixed GHADELIMITER issue by using random delimiter generated with openssl

## [0.1.0] - 2025-08-24

Initial Release

