# Zed ArkTS Extension - 自动化测试指南

本文档介绍如何为 Zed 的 ArkTS 语言扩展设置和运行自动化测试，特别是针对 LSP（Language Server Protocol）的测试。

## 目录

1. [测试架构概览](#测试架构概览)
2. [现有测试](#现有测试)
3. [LSP 协议测试](#lsp-协议测试)
4. [集成测试方法](#集成测试方法)
5. [自动化测试流程](#自动化测试流程)
6. [最佳实践](#最佳实践)

## 测试架构概览

### 组件架构

```
┌─────────────────┐
│   Zed Editor    │
│   (Rust)        │
└────────┬────────┘
         │ stdio (LSP JSON-RPC)
         │
┌────────▼────────┐
│  Node.js Wrapper│
│  (index.js)     │
└────────┬────────┘
         │ IPC
         │
┌────────▼────────┐
│ ETS LSP Server  │
│ (@arkts/...)    │
└─────────────────┘
```

### 测试层次

1. **单元测试** - 测试独立模块（数据解析、路径展开等）
2. **协议测试** - 验证 LSP 消息格式和处理
3. **集成测试** - 测试完整的 LSP 生命周期
4. **端到端测试** - 在真实 Zed 环境中测试

## 现有测试

### 运行测试

```bash
cd zed-ets-language-server
npm install
npm test
```

### 测试文件

#### 1. `lib/data-parser.test.js`

测试 LSP 消息解析器，验证：
- Content-Length 头部解析
- JSON-RPC 消息提取
- 多消息处理
- Unicode/Emoji 字符支持
- 错误处理

**示例测试:**
```javascript
it('should parse single message', () => {
  const message = { jsonrpc: '2.0', method: 'test' };
  const data = `Content-Length: ${Buffer.byteLength(JSON.stringify(message))}\r\n\r\n${JSON.stringify(message)}`;
  const parser = new DataParser();
  const result = parser.parse(Buffer.from(data));
  expect(result).toEqual([message]);
});
```

#### 2. `lib/lib-expander.test.js`

测试 TypeScript 库展开功能：
- 文件模式匹配
- 递归目录搜索
- 路径过滤

## LSP 协议测试

### LSP 消息格式

所有 LSP 消息都遵循以下格式：

```
Content-Length: <字节数>\r\n
\r\n
<JSON-RPC 内容>
```

### 测试 LSP 请求/响应

#### 初始化序列

```javascript
// 1. Initialize Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "processId": null,
    "rootUri": "file:///path/to/project",
    "capabilities": {}
  }
}

// 2. Initialize Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "capabilities": {
      "textDocumentSync": 1,
      "completionProvider": {},
      "definitionProvider": true
    }
  }
}

// 3. Initialized Notification
{
  "jsonrpc": "2.0",
  "method": "initialized",
  "params": {}
}
```

#### 补全测试

```javascript
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "textDocument/completion",
  "params": {
    "textDocument": { "uri": "file:///test.ets" },
    "position": { "line": 5, "character": 10 }
  }
}
```

#### 定义跳转测试

```javascript
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "textDocument/definition",
  "params": {
    "textDocument": { "uri": "file:///test.ets" },
    "position": { "line": 10, "character": 5 }
  }
}
```

## 集成测试方法

### 方法 1: Mock LSP Server

创建一个模拟的语言服务器来测试扩展行为：

```javascript
// tests/integration/mock-lsp-server.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';

describe('LSP Integration', () => {
  let serverProcess;

  beforeEach(() => {
    // 启动语言服务器
    serverProcess = spawn('node', ['index.js']);
  });

  afterEach(() => {
    // 清理
    serverProcess.kill();
  });

  it('should handle initialize request', (done) => {
    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: null, rootUri: null, capabilities: {} }
    };

    serverProcess.stdin.write(createLSPMessage(initMessage));

    serverProcess.stdout.on('data', (data) => {
      const response = parseLSPResponse(data);
      expect(response.result.capabilities).toBeDefined();
      done();
    });
  });
});
```

### 方法 2: 测试特定 LSP 功能

```javascript
// tests/lsp-features/completion.test.js
describe('Completion', () => {
  it('should provide completions for ArkTS keywords', async () => {
    const server = await startServer();
    await server.initialize();
    
    const result = await server.sendRequest('textDocument/completion', {
      textDocument: { uri: 'file:///test.ets' },
      position: { line: 0, character: 0 }
    });
    
    expect(result.items).toContainEqual(
      expect.objectContaining({ label: '@Component' })
    );
    
    await server.shutdown();
  });
});
```

### 方法 3: 快照测试

```javascript
describe('LSP Responses', () => {
  it('should match completion snapshot', async () => {
    const result = await getCompletions('test.ets', 5, 10);
    expect(result).toMatchSnapshot();
  });
});
```

## 自动化测试流程

### 样板项目结构

创建一个标准的 ArkTS 测试项目：

```
test-fixtures/
├── arkts-sample-project/
│   ├── oh-package.json5
│   ├── src/
│   │   ├── main.ets
│   │   ├── components/
│   │   │   └── HelloWorld.ets
│   │   └── pages/
│   │       └── Index.ets
│   └── test/
│       └── assertions.ets
```

### 测试脚本

```bash
#!/bin/bash
# scripts/run-lsp-tests.sh

set -e

echo "Setting up test environment..."

# 1. 构建扩展
cargo build --release

# 2. 安装 Node.js 依赖
cd zed-ets-language-server
npm install

# 3. 运行单元测试
echo "Running unit tests..."
npm test

# 4. 运行集成测试（如果存在）
if [ -d "tests/integration" ]; then
  echo "Running integration tests..."
  npm run test:integration
fi

# 5. 验证 LSP 服务器可以启动
echo "Testing LSP server startup..."
timeout 5s node index.js < /dev/null && echo "LSP server starts successfully" || true

echo "All tests passed!"
```

### CI/CD 集成

更新 `.github/workflows/ci.yml` 添加 LSP 测试：

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'

- name: Install Node dependencies
  working-directory: ./zed-ets-language-server
  run: npm ci

- name: Run LSP tests
  working-directory: ./zed-ets-language-server
  run: npm test

- name: Test LSP server startup
  working-directory: ./zed-ets-language-server
  run: timeout 5s node index.js < /dev/null || [ $? -eq 124 ]
```

## Zed 环境中的自动化测试

### 方法: 使用 Zed CLI

虽然 Zed 没有官方的扩展测试框架，但可以通过以下方式测试：

#### 1. 自动安装扩展

```bash
#!/bin/bash
# scripts/install-extension.sh

# 构建扩展
cargo build --release

# 获取扩展目录
ZED_EXTENSIONS_DIR="$HOME/.config/zed/extensions"
mkdir -p "$ZED_EXTENSIONS_DIR/arkts"

# 复制扩展文件
cp -r ./target/release/libzed_arkts.* "$ZED_EXTENSIONS_DIR/arkts/"
cp extension.toml "$ZED_EXTENSIONS_DIR/arkts/"
cp -r languages "$ZED_EXTENSIONS_DIR/arkts/"

echo "Extension installed successfully"
```

#### 2. 配置测试环境

```bash
#!/bin/bash
# scripts/setup-test-env.sh

# 创建临时 Zed 配置
TEST_CONFIG_DIR="/tmp/zed-test-config"
mkdir -p "$TEST_CONFIG_DIR"

cat > "$TEST_CONFIG_DIR/settings.json" << EOF
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
EOF

export ZED_CONFIG_DIR="$TEST_CONFIG_DIR"
```

#### 3. 运行断言测试

```bash
#!/bin/bash
# scripts/test-lsp-features.sh

PROJECT_DIR="./test-fixtures/arkts-sample-project"

# 启动 Zed（如果有 headless 模式）
# 或者直接测试 LSP 服务器

cd zed-ets-language-server

# 模拟 Zed 的 LSP 请求
cat << EOF | node index.js > /tmp/lsp-response.json
Content-Length: 123

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"rootUri":"file://$PROJECT_DIR"}}
EOF

# 验证响应
if grep -q "capabilities" /tmp/lsp-response.json; then
  echo "✓ Initialize successful"
else
  echo "✗ Initialize failed"
  exit 1
fi
```

### 测试检查清单

- [ ] 扩展可以成功加载
- [ ] 语言服务器可以启动
- [ ] 识别 `.ets` 文件
- [ ] 语法高亮正常工作
- [ ] 转到定义功能正常
- [ ] 查找引用功能正常
- [ ] 补全功能正常（如果实现）
- [ ] 诊断信息正常显示

## 最佳实践

### 1. 测试隔离

- 每个测试使用独立的临时目录
- 使用 `beforeEach`/`afterEach` 清理
- Mock 外部依赖（文件系统、网络等）

### 2. 覆盖边界情况

- 空文件
- 大文件
- Unicode 字符
- 无效的 LSP 消息
- 网络超时
- 并发请求

### 3. 性能测试

```javascript
it('should handle large files efficiently', async () => {
  const largeContent = 'x'.repeat(1000000);
  const startTime = Date.now();
  
  await server.sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: 'file:///large.ets',
      text: largeContent
    }
  });
  
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(1000); // 应在 1 秒内完成
});
```

### 4. 错误处理测试

```javascript
it('should handle malformed requests gracefully', async () => {
  const invalidRequest = { method: 'invalid' }; // 缺少 jsonrpc 和 id
  
  await expect(
    server.sendRequest(invalidRequest)
  ).rejects.toThrow();
});
```

### 5. 回归测试

为每个修复的 bug 添加测试用例：

```javascript
// 修复: Issue #123 - 处理带有 emoji 的文件
it('should handle files with emoji characters (Issue #123)', () => {
  const content = '@Component struct Hello { message: string = "👋" }';
  const result = parseContent(content);
  expect(result).toBeDefined();
});
```

## 调试技巧

### 1. 启用详细日志

```javascript
// 在 index.js 中
process.env.DEBUG = 'lsp:*';
```

### 2. 检查 LSP 消息

```bash
# 记录所有 LSP 通信
node index.js 2>&1 | tee lsp.log
```

### 3. 使用 LSP Inspector

安装并使用 LSP 检查工具：

```bash
npm install -g @vscode/lsp-inspector
lsp-inspector --stdio -- node index.js
```

## 参考资源

- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [Zed Extension API](https://github.com/zed-industries/zed)
- [Vitest Documentation](https://vitest.dev/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

## 总结

本文档提供了一个全面的测试策略，包括：

1. **单元测试** - 使用 Vitest 测试独立模块
2. **协议测试** - 验证 LSP 消息格式
3. **集成测试** - 测试完整的 LSP 生命周期
4. **自动化** - CI/CD 集成和自动化脚本

通过遵循这些最佳实践，可以确保 ArkTS 扩展的质量和可靠性。
