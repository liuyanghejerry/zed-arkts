# Automated Testing Guide for Zed LSP Extensions

This document provides a comprehensive guide for setting up and running automated tests for LSP (Language Server Protocol) in Zed language extensions, specifically for the ArkTS extension.

## Overview

The testing strategy covers:
- **Unit tests** - Testing individual modules
- **Protocol tests** - Validating LSP message format and handling
- **Integration tests** - Testing complete LSP lifecycle
- **End-to-end tests** - Testing in real Zed environment

## Quick Start

### Run All Tests

```bash
./scripts/run-lsp-tests.sh
```

This script will:
1. Check environment (Rust, Node.js)
2. Build the Rust extension
3. Install Node.js dependencies
4. Run unit tests
5. Verify LSP server startup

### Run Unit Tests Only

```bash
cd zed-ets-language-server
npm test
```

### Run Integration Tests

```bash
cd zed-ets-language-server
npm run test:integration
```

## Architecture

### Component Stack

```
┌─────────────────┐
│   Zed Editor    │  ← Editor UI
│   (Rust)        │
└────────┬────────┘
         │ stdio (LSP JSON-RPC)
         ↓
┌────────────────┐
│ Node.js Wrapper│  ← Our wrapper (index.js)
│  (index.js)    │     - Parses LSP messages
└────────┬───────┘     - Forwards to language server
         │ IPC
         ↓
┌────────────────┐
│ ETS LSP Server │  ← Actual language server
│ (@arkts/...)   │
└────────────────┘
```

## Testing Approach

### 1. Unit Testing

Tests for individual modules in isolation.

**Example: Testing Data Parser**

```javascript
// lib/data-parser.test.js
import { describe, it, expect } from 'vitest';
import { DataParser } from './data-parser.js';

describe('DataParser', () => {
  it('should parse LSP message with Content-Length header', () => {
    const message = { jsonrpc: '2.0', method: 'test' };
    const json = JSON.stringify(message);
    const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
    
    const parser = new DataParser();
    const result = parser.parse(Buffer.from(data));
    
    expect(result).toEqual([message]);
  });
});
```

### 2. Protocol Testing

Validates LSP message format compliance.

**Example: Testing LSP Initialize**

```javascript
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    processId: null,
    rootUri: 'file:///path/to/project',
    capabilities: {}
  }
};

// Expected response structure
{
  jsonrpc: '2.0',
  id: 1,
  result: {
    capabilities: {
      textDocumentSync: 2,
      completionProvider: {},
      definitionProvider: true,
      referencesProvider: true
    }
  }
}
```

### 3. Integration Testing

Tests the complete LSP server lifecycle.

**Example: Server Lifecycle Test**

```javascript
// tests/integration/lsp-server.test.js
import { spawn } from 'child_process';

describe('LSP Server Integration', () => {
  let serverProcess;

  beforeAll(() => {
    serverProcess = spawn('node', ['index.js']);
  });

  afterAll(() => {
    serverProcess.kill();
  });

  it('should complete initialize sequence', async () => {
    // 1. Send initialize
    await sendRequest({ method: 'initialize', ... });
    
    // 2. Send initialized notification
    await sendNotification({ method: 'initialized' });
    
    // 3. Server should be ready
    expect(serverProcess.killed).toBe(false);
  });
});
```

### 4. Feature Testing

Tests specific LSP features.

**Example: Go to Definition**

```javascript
it('should find definition', async () => {
  const request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: 'file:///test.ets' },
      position: { line: 10, character: 5 }
    }
  };
  
  const response = await sendRequest(request);
  
  expect(response.result).toBeDefined();
  expect(response.result.uri).toContain('.ets');
});
```

## Sample Project

### Structure

A sample ArkTS project is provided for testing:

```
test-fixtures/arkts-sample-project/
├── oh-package.json5
├── src/
│   ├── main.ets
│   ├── components/
│   │   └── HelloWorld.ets
│   └── pages/
│       ├── Index.ets
│       └── HelloWorld.ets
└── README.md
```

### Test Cases

The sample project supports testing:

1. **Go to Definition**
   - Click on `HelloWorld` in `main.ets` → jump to `components/HelloWorld.ets`

2. **Find References**
   - Find references to `HelloWorld` component
   - Should find usages in `main.ets` and `pages/HelloWorld.ets`

3. **Syntax Highlighting**
   - Verify `.ets` files are highlighted correctly
   - Decorators like `@Component`, `@State` should be recognized

4. **Completion**
   - Type `@` should suggest decorators
   - Type `this.` should suggest component properties

## Automation Scripts

### Install Extension

```bash
./scripts/install-extension.sh
```

Automatically builds and installs the extension to Zed.

### Test LSP Features

```bash
./scripts/test-lsp-features.sh
```

Tests LSP protocol messages against the sample project.

### Run All Tests

```bash
./scripts/run-lsp-tests.sh
```

Comprehensive test suite including build, unit tests, and server verification.

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/ci.yml`) includes:

```yaml
jobs:
  build:
    # Builds Rust extension
    
  test-lsp:
    # Tests LSP server
    steps:
      - Setup Node.js
      - Install dependencies
      - Run unit tests
      - Run integration tests
      - Verify server startup
```

## Manual Testing in Zed

### 1. Install Extension

```bash
cargo build --release
# Then install via Zed's extension manager
```

### 2. Configure LSP

Edit Zed's `settings.json`:

```json
{
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "tsdk": "/path/to/typescript/lib",
        "ohosSdkPath": "/path/to/OpenHarmony/sdk"
      }
    }
  }
}
```

### 3. Test Features

Open `test-fixtures/arkts-sample-project` in Zed:

- [ ] Files are recognized as ArkTS
- [ ] Syntax highlighting works
- [ ] Go to Definition works
- [ ] Find References works
- [ ] Hover shows type information
- [ ] Diagnostics appear for errors

## Best Practices

### 1. Test Isolation

```javascript
beforeEach(() => {
  // Create fresh test environment
  tempDir = createTempDir();
});

afterEach(() => {
  // Clean up
  removeTempDir(tempDir);
});
```

### 2. Mock External Dependencies

```javascript
import { vi } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}));
```

### 3. Test Edge Cases

- Empty files
- Large files (>1MB)
- Unicode characters
- Invalid LSP messages
- Concurrent requests
- Timeout scenarios

### 4. Snapshot Testing

```javascript
it('should match completion snapshot', async () => {
  const result = await getCompletions('test.ets', 5, 10);
  expect(result).toMatchSnapshot();
});
```

### 5. Performance Testing

```javascript
it('should handle large files efficiently', async () => {
  const largeContent = 'x'.repeat(1000000);
  const startTime = Date.now();
  
  await processFile(largeContent);
  
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(1000);
});
```

## Debugging

### Enable Verbose Logging

```javascript
process.env.DEBUG = 'lsp:*';
```

### Inspect LSP Messages

```bash
node index.js 2>&1 | tee lsp.log
```

### Use LSP Inspector

```bash
npm install -g @vscode/lsp-inspector
lsp-inspector --stdio -- node index.js
```

## Common Issues

### Issue: Server doesn't start

**Solution**: Check Node.js version (requires >= 22.12.0)

```bash
node --version
```

### Issue: Tests timeout

**Solution**: Increase timeout in test configuration

```javascript
it('slow test', async () => {
  // ...
}, { timeout: 10000 }); // 10 seconds
```

### Issue: LSP messages not parsed

**Solution**: Verify Content-Length header format

```
Content-Length: 123\r\n
\r\n
{"jsonrpc":"2.0",...}
```

## Resources

- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [Zed Extension API](https://github.com/zed-industries/zed)
- [Vitest Documentation](https://vitest.dev/)
- [JSON-RPC 2.0](https://www.jsonrpc.org/specification)

## Contributing

When adding new LSP features:

1. Write tests first (TDD approach)
2. Add unit tests for new modules
3. Add integration tests for LSP requests
4. Update CI/CD workflow if needed
5. Document in this guide

## Summary

This testing framework provides:

✅ **Automated unit tests** with Vitest  
✅ **LSP protocol compliance tests**  
✅ **Integration tests** for server lifecycle  
✅ **Sample project** for manual testing  
✅ **CI/CD integration** with GitHub Actions  
✅ **Helper scripts** for common tasks  

By following this guide, you can ensure the quality and reliability of the ArkTS extension for Zed.
