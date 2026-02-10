# Zed ArkTS Extension - Automated Testing Design

## Overview

Complete end-to-end automated testing framework for Zed's ArkTS LSP extension, achieving 100% automation with zero manual steps.

## Architecture

```
┌─────────────────────────────────────────┐
│  E2E Automation (e2e-automated-test.sh) │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┼───────────┬─────────────┐
    │           │           │             │
    ▼           ▼           ▼             ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│  Zed   │ │  SDK   │ │Extension│ │ LSP Testing  │
│Install │ │Install │ │ Install │ │ (Real Zed)   │
└────────┘ └────────┘ └────────┘ └──────────────┘
                                        │
                                        ▼
                           ┌────────────────────────┐
                           │ LSP Protocol Testing   │
                           │ (stdio/JSON-RPC)       │
                           └────────────────────────┘
```

## Key Components

### 1. Zed Installation (`scripts/auto-install-zed.sh`)
- Auto-detects OS (Linux/macOS)
- Uses platform-specific package managers
- Verifies installation

### 2. Extension Installation (`scripts/auto-install-local-extension.sh`)
- Builds extension with Cargo
- Auto-detects extension directory
- Generates manifest and configuration

### 3. SDK Installation (`scripts/install-mock-ohos-sdk.sh`)
- Creates lightweight mock OpenHarmony SDK
- Generates TypeScript/ArkTS type definitions
- No large downloads required

### 4. Integration Testing (`scripts/test-zed-real.sh`)
- **Real Zed CLI only** - no simulation
- Launches actual Zed editor via command line
- Monitors log files for extension activity
- Detects: extension loading, LSP startup, protocol messages
- Requires real Zed installation

### 5. LSP Protocol Testing (`scripts/test-lsp-automated.sh`)
- Direct LSP testing via stdio/JSON-RPC
- Tests: initialize, definition, references, completion
- No GUI required
- Programmatic validation with exit codes

## Design Decisions

### Why Real Zed Only?
- **Authentic testing**: Uses actual Zed editor, not simulation
- **Log analysis**: Monitors real Zed logs for extension behavior
- **CI support**: Uses xvfb in headless CI environments
- **Confidence**: Tests production environment

### Why Direct LSP Testing?
- **Bypass GUI**: No UI automation complexity
- **Protocol-based**: LSP uses stdio JSON-RPC (programmatically testable)
- **Fast**: Direct communication without UI overhead
- **Portable**: Works in any environment

## Usage

### Complete E2E Test
```bash
./scripts/e2e-automated-test.sh
```

### Individual Components
```bash
./scripts/auto-install-zed.sh              # Install Zed
./scripts/install-mock-ohos-sdk.sh         # Install SDK
./scripts/auto-install-local-extension.sh  # Install extension
./scripts/test-zed-real.sh                 # Real Zed integration test
./scripts/test-lsp-automated.sh            # LSP protocol test
```

## CI/CD Integration

GitHub Actions workflow (`.github/workflows/e2e-automated.yml`):
- Uses xvfb for headless Zed
- Runs all automation steps
- Uploads test results as artifacts
- Exit code based validation

## Test Results Format

```json
{
  "summary": {
    "total": 4,
    "passed": 4,
    "failed": 0
  },
  "tests": {
    "initialize": { "status": "passed" },
    "definition": { "status": "passed" },
    "references": { "status": "passed" },
    "completion": { "status": "passed" }
  }
}
```

## Requirements

- Zed editor (required for integration tests)
- Node.js 18+ 
- Rust/Cargo (for building extension)
- xvfb (for CI/headless environments)

## Log Locations

- Linux: `~/.local/share/zed/logs/Zed.log`
- macOS: `~/Library/Logs/Zed/Zed.log`
