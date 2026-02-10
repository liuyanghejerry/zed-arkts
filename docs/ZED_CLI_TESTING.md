# Zed CLI Testing Guide
# Zed 命令行测试指南

## Overview / 概述

This document explains how to test the Zed extension using the real Zed editor CLI and log analysis, as opposed to simulation.

本文档说明如何使用真实的 Zed 编辑器 CLI 和日志分析来测试扩展，而不是模拟。

## Testing Approaches / 测试方法

### 1. Real Zed CLI Testing (Preferred) / 真实 Zed CLI 测试（推荐）

**Script**: `scripts/test-zed-real.sh`

**How it works:**
- Launches actual Zed editor with test file
- Monitors Zed's log files in real-time
- Detects extension loading and LSP startup
- Extracts LSP messages from logs
- Falls back to simulation if Zed is unavailable

**工作原理**：
- 启动真实的 Zed 编辑器并打开测试文件
- 实时监控 Zed 的日志文件
- 检测扩展加载和 LSP 启动
- 从日志中提取 LSP 消息
- 如果 Zed 不可用，回退到模拟模式

**Usage:**
```bash
./scripts/test-zed-real.sh [project_dir] [results_file]
```

**Log Locations:**
- Linux: `~/.local/share/zed/logs/Zed.log`
- macOS: `~/Library/Logs/Zed/Zed.log`

### 2. Simulated Integration Testing / 模拟集成测试

**Script**: `scripts/test-zed-integration.sh`

**How it works:**
- Simulates how Zed launches the extension wrapper
- Tests LSP communication through the extension
- Validates capabilities without requiring Zed GUI
- Always available (doesn't need Zed installed)

**工作原理**：
- 模拟 Zed 如何启动扩展包装器
- 通过扩展测试 LSP 通信
- 验证功能而无需 Zed GUI
- 始终可用（无需安装 Zed）

**Usage:**
```bash
./scripts/test-zed-integration.sh [project_dir] [results_file]
```

## Zed CLI Commands / Zed 命令行命令

Common Zed CLI commands that can be used for testing:

常用的可用于测试的 Zed CLI 命令：

```bash
# Check version
zed --version

# Open file
zed path/to/file.ets

# Open file and wait for close (if supported)
zed --wait path/to/file.ets

# Open in new window (if supported)
zed --new path/to/file.ets
```

## What Gets Tested / 测试内容

### Real Zed CLI Test / 真实 Zed CLI 测试

1. **Zed Launch** ✓
   - Verifies Zed can be started
   - 验证 Zed 可以启动

2. **Extension Loading** ✓
   - Monitors logs for extension load messages
   - Detects: "arkts extension", "loading arkts", etc.
   - 监控日志中的扩展加载消息
   - 检测："arkts extension"、"loading arkts" 等

3. **LSP Server Start** ✓
   - Monitors logs for LSP startup
   - Detects: "language server", "lsp start", etc.
   - 监控日志中的 LSP 启动
   - 检测："language server"、"lsp start" 等

4. **LSP Messages** ✓
   - Extracts LSP protocol messages from logs
   - 从日志中提取 LSP 协议消息

### Simulation Test / 模拟测试

1. **Extension Start** ✓
   - Verifies wrapper starts correctly
   - 验证包装器正确启动

2. **LSP Communication** ✓
   - Tests message passing through extension
   - 测试通过扩展传递消息

3. **Capabilities** ✓
   - Validates LSP capabilities exposure
   - 验证 LSP 功能暴露

## Log Analysis / 日志分析

### What to Look For / 查找什么

When analyzing Zed logs, look for:

分析 Zed 日志时，查找：

```
Extension-related:
- "extension arkts loaded"
- "loading extension: arkts"
- "arkts extension initialized"

LSP-related:
- "language server started"
- "LSP initialize request"
- "LSP response received"
- JSON-RPC messages
```

### Example Log Patterns / 日志模式示例

```log
[INFO] Loading extension: arkts from ~/.config/zed/extensions/installed/arkts
[INFO] Extension arkts loaded successfully
[DEBUG] Starting language server for arkts
[DEBUG] LSP initialize: {"processId":12345,...}
[DEBUG] LSP response: {"result":{"capabilities":{...}}}
```

## Integration with E2E Tests / 集成到 E2E 测试

The E2E test script (`e2e-automated-test.sh`) automatically:
1. Checks if Zed is available
2. Uses real Zed CLI test if available
3. Falls back to simulation if Zed is not installed

E2E 测试脚本（`e2e-automated-test.sh`）会自动：
1. 检查 Zed 是否可用
2. 如果可用，使用真实的 Zed CLI 测试
3. 如果 Zed 未安装，回退到模拟模式

```bash
# Step 5 in E2E test
if command -v zed &> /dev/null; then
    # Use real Zed
    ./scripts/test-zed-real.sh
else
    # Use simulation
    ./scripts/test-zed-integration.sh
fi
```

## Advantages / 优势

### Real Zed CLI Testing / 真实 Zed CLI 测试
- ✅ Tests actual Zed integration
- ✅ Validates real-world behavior
- ✅ Detects Zed-specific issues
- ✅ Reads actual Zed logs

### Simulation Testing / 模拟测试
- ✅ Works in CI/CD environments
- ✅ Doesn't require GUI
- ✅ Faster execution
- ✅ More predictable results

## Troubleshooting / 故障排除

### Zed Not Starting / Zed 无法启动

If Zed fails to start:
```bash
# Check if Zed is in PATH
which zed

# Try running manually
zed --version

# Check logs
tail -f ~/.local/share/zed/logs/Zed.log
```

### No Logs Generated / 未生成日志

If no logs are found:
```bash
# Verify log directory
ls -la ~/.local/share/zed/logs/

# Try different log location
ls -la ~/.config/zed/logs/

# Check if Zed is actually running
ps aux | grep zed
```

### Extension Not Loading / 扩展未加载

If extension doesn't load:
```bash
# Verify extension installation
ls -la ~/.config/zed/extensions/installed/arkts/

# Check extension files
ls -la ~/.config/zed/extensions/installed/arkts/zed-ets-language-server/

# Reinstall extension
./scripts/auto-install-local-extension.sh
```

## CI/CD Considerations / CI/CD 注意事项

In CI/CD environments:
- Zed GUI is typically not available
- Test automatically falls back to simulation
- Real Zed testing can be enabled in environments with display support
- Consider running real Zed tests on developer machines

在 CI/CD 环境中：
- 通常没有 Zed GUI
- 测试自动回退到模拟模式
- 可以在支持显示的环境中启用真实 Zed 测试
- 考虑在开发人员机器上运行真实 Zed 测试

## Best Practices / 最佳实践

1. **Local Development** / 本地开发
   - Use real Zed CLI testing for comprehensive validation
   - 使用真实 Zed CLI 测试进行全面验证

2. **CI/CD** / 持续集成
   - Rely on simulation for consistent results
   - 依靠模拟获得一致的结果

3. **Both** / 两者都用
   - Run both tests when possible for maximum coverage
   - 尽可能运行两种测试以获得最大覆盖率

## Example Output / 输出示例

### Real Zed Test / 真实 Zed 测试
```json
{
  "timestamp": "2024-02-10T03:30:00Z",
  "zedCLI": {
    "launched": true,
    "extensionLoaded": true,
    "lspStarted": true,
    "lspMessages": ["initialize", "initialized"]
  },
  "summary": {
    "total": 3,
    "passed": 3,
    "failed": 0
  }
}
```

### Simulation Test / 模拟测试
```json
{
  "timestamp": "2024-02-10T03:30:00Z",
  "integration": {
    "extensionStart": { "status": "passed" },
    "lspCommunication": { "status": "passed" },
    "capabilities": { "status": "passed" }
  },
  "summary": {
    "total": 3,
    "passed": 3,
    "failed": 0
  }
}
```
