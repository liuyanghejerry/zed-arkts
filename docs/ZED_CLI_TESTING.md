# Zed CLI Testing Guide
# Zed 命令行测试指南

## Overview / 概述

This document explains how to test the Zed extension using the real Zed editor CLI and log analysis, as opposed to simulation.

本文档说明如何使用真实的 Zed 编辑器 CLI 和日志分析来测试扩展，而不是模拟。

## Testing Approach / 测试方法

### Real Zed CLI Testing / 真实 Zed CLI 测试

**Script**: `scripts/test-zed-real.sh`

**How it works:**
- Launches actual Zed editor with test file
- Monitors Zed's log files in real-time
- Detects extension loading and LSP startup
- Extracts LSP messages from logs
- Requires Zed to be installed

**工作原理**：
- 启动真实的 Zed 编辑器并打开测试文件
- 实时监控 Zed 的日志文件
- 检测扩展加载和 LSP 启动
- 从日志中提取 LSP 消息
- 需要安装 Zed

**Usage:**
```bash
./scripts/test-zed-real.sh [project_dir] [results_file]
```

**Log Locations:**
- Linux: `~/.local/share/zed/logs/Zed.log`
- macOS: `~/Library/Logs/Zed/Zed.log`

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

The E2E test script (`e2e-automated-test.sh`) requires Zed to be installed and uses real Zed CLI testing.

E2E 测试脚本（`e2e-automated-test.sh`）需要安装 Zed，并使用真实的 Zed CLI 测试。

```bash
# Step 5 in E2E test - requires Zed
./scripts/test-zed-real.sh
```

## Advantages / 优势

### Real Zed CLI Testing / 真实 Zed CLI 测试
- ✅ Tests actual Zed integration
- ✅ Validates real-world behavior
- ✅ Detects Zed-specific issues
- ✅ Reads actual Zed logs
- ✅ Verifies extension loading in production environment

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
