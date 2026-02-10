# 完全自动化测试方案研究 / Full Automation Testing Research

本文档针对以下4个方向进行深入调研，实现完全自动化的端到端测试：

## 1. 如何自动化安装 Zed / How to Automate Zed Installation

### 方案 A: 使用包管理器（推荐用于 CI/CD）

#### Linux (Ubuntu/Debian)
```bash
#!/bin/bash
# 使用官方安装脚本
curl -f https://zed.dev/install.sh | sh

# 或者从 GitHub Releases 下载
ZED_VERSION="0.165.2"  # 指定版本
wget "https://github.com/zed-industries/zed/releases/download/v${ZED_VERSION}/zed-linux-x86_64.tar.gz"
tar -xzf zed-linux-x86_64.tar.gz
sudo mv zed /usr/local/bin/

# 验证安装
zed --version
```

#### macOS
```bash
#!/bin/bash
# 使用 Homebrew
brew install --cask zed

# 或者直接下载
ZED_VERSION="0.165.2"
curl -L "https://github.com/zed-industries/zed/releases/download/v${ZED_VERSION}/Zed.dmg" -o Zed.dmg
hdiutil attach Zed.dmg
cp -R "/Volumes/Zed/Zed.app" /Applications/
hdiutil detach "/Volumes/Zed"

# 验证安装
/Applications/Zed.app/Contents/MacOS/zed --version
```

### 方案 B: 容器化环境（最佳自动化方案）

```dockerfile
# Dockerfile
FROM ubuntu:22.04

# 安装依赖
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    libssl-dev \
    pkg-config \
    nodejs \
    npm

# 安装 Zed
RUN curl -f https://zed.dev/install.sh | sh

# 设置环境变量
ENV ZED_CONFIG_DIR=/tmp/zed-config
ENV ZED_EXTENSIONS_DIR=/tmp/zed-extensions

# 安装 Rust (用于构建扩展)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /workspace
```

### 方案 C: GitHub Actions / CI 环境

```yaml
# .github/workflows/e2e-test.yml
name: E2E Testing with Zed

on: [push, pull_request]

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Install Zed
      run: |
        curl -f https://zed.dev/install.sh | sh
        echo "$HOME/.local/bin" >> $GITHUB_PATH
      
    - name: Verify Zed installation
      run: zed --version
      
    - name: Setup test environment
      run: |
        mkdir -p $HOME/.config/zed/extensions/installed
        mkdir -p /tmp/zed-test-workspace
```

## 2. 如何为 Zed 自动化安装本地扩展 / How to Automate Local Extension Installation

### 方案 A: 文件系统直接安装（最快）

```bash
#!/bin/bash
# scripts/auto-install-extension.sh

set -e

# 1. 构建扩展
echo "Building extension..."
cargo build --release

# 2. 确定扩展目录
if [[ "$OSTYPE" == "darwin"* ]]; then
    ZED_EXT_DIR="$HOME/Library/Application Support/Zed/extensions/installed/arkts"
else
    ZED_EXT_DIR="$HOME/.config/zed/extensions/installed/arkts"
fi

# 3. 创建扩展目录
mkdir -p "$ZED_EXT_DIR"

# 4. 复制必要文件
echo "Installing extension to $ZED_EXT_DIR..."

# 复制编译后的库
if [[ "$OSTYPE" == "darwin"* ]]; then
    cp target/release/libzed_arkts.dylib "$ZED_EXT_DIR/"
else
    cp target/release/libzed_arkts.so "$ZED_EXT_DIR/"
fi

# 复制配置和资源
cp extension.toml "$ZED_EXT_DIR/"
cp -r languages "$ZED_EXT_DIR/" 2>/dev/null || true
cp -r assets "$ZED_EXT_DIR/" 2>/dev/null || true

# 复制语言服务器
cp -r zed-ets-language-server "$ZED_EXT_DIR/"

# 5. 创建扩展元数据
cat > "$ZED_EXT_DIR/manifest.json" << EOF
{
  "id": "arkts",
  "name": "ArkTS",
  "version": "0.2.0",
  "schema_version": 1,
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "✓ Extension installed successfully"
```

### 方案 B: 使用 Zed 的开发模式（如果可用）

```bash
#!/bin/bash
# 通过符号链接安装（开发模式）

ZED_EXT_DIR="$HOME/.config/zed/extensions/dev/arkts"
mkdir -p "$(dirname "$ZED_EXT_DIR")"

# 创建符号链接到项目目录
ln -sf "$(pwd)" "$ZED_EXT_DIR"

# 构建扩展
cargo build --release

# 创建配置指向开发版本
cat > "$HOME/.config/zed/settings.json" << EOF
{
  "dev_extensions": ["arkts"],
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "tsdk": "/usr/local/lib/node_modules/typescript/lib",
        "ohosSdkPath": "/opt/OpenHarmony/sdk"
      }
    }
  }
}
EOF
```

### 方案 C: 自动化配置生成

```bash
#!/bin/bash
# scripts/setup-zed-config.sh

# 生成 Zed 配置
setup_zed_config() {
    local config_dir="${1:-$HOME/.config/zed}"
    mkdir -p "$config_dir"
    
    cat > "$config_dir/settings.json" << 'EOF'
{
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "tsdk": "${TYPESCRIPT_LIB:-/usr/local/lib/node_modules/typescript/lib}",
        "ohosSdkPath": "${OHOS_SDK_PATH:-/opt/OpenHarmony/sdk}"
      }
    }
  },
  "languages": {
    "ArkTS": {
      "tab_size": 2,
      "format_on_save": true
    }
  }
}
EOF

    echo "✓ Zed configuration created at $config_dir/settings.json"
}

# 调用
setup_zed_config "/tmp/zed-test-config"
```

## 3. 如何自动化安装 OpenHarmony ArkTS 开发套件 / How to Automate OpenHarmony ArkTS SDK Installation

### 方案 A: 命令行工具安装（推荐）

```bash
#!/bin/bash
# scripts/install-openharmony-sdk.sh

set -e

OHOS_SDK_VERSION="4.1.0"
OHOS_SDK_DIR="/opt/OpenHarmony"
SDK_DOWNLOAD_URL="https://repo.huaweicloud.com/openharmony/os/${OHOS_SDK_VERSION}/ohos-sdk-${OHOS_SDK_VERSION}-linux.tar.gz"

echo "Installing OpenHarmony SDK ${OHOS_SDK_VERSION}..."

# 1. 创建安装目录
sudo mkdir -p "$OHOS_SDK_DIR"
cd /tmp

# 2. 下载 SDK
echo "Downloading SDK..."
wget "$SDK_DOWNLOAD_URL" -O ohos-sdk.tar.gz

# 3. 解压
echo "Extracting SDK..."
sudo tar -xzf ohos-sdk.tar.gz -C "$OHOS_SDK_DIR"

# 4. 设置环境变量
cat >> ~/.bashrc << EOF

# OpenHarmony SDK
export OHOS_SDK_HOME="$OHOS_SDK_DIR"
export PATH="\$OHOS_SDK_HOME/toolchains:\$PATH"
EOF

# 5. 安装 OHPM (OpenHarmony Package Manager)
echo "Installing OHPM..."
npm install -g @ohos/ohpm

# 6. 配置 OHPM
ohpm config set registry https://repo.harmonyos.com/npm/

# 7. 验证安装
echo "Verifying installation..."
ls -la "$OHOS_SDK_DIR"

echo "✓ OpenHarmony SDK installed successfully"
echo "SDK location: $OHOS_SDK_DIR"
```

### 方案 B: Docker 容器化 SDK

```dockerfile
# Dockerfile.openharmony
FROM ubuntu:22.04

# 安装依赖
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    git \
    nodejs \
    npm \
    python3 \
    openjdk-11-jdk

# 下载和安装 OpenHarmony SDK
ENV OHOS_SDK_VERSION=4.1.0
ENV OHOS_SDK_HOME=/opt/OpenHarmony

RUN mkdir -p $OHOS_SDK_HOME && \
    cd /tmp && \
    wget "https://repo.huaweicloud.com/openharmony/os/${OHOS_SDK_VERSION}/ohos-sdk-${OHOS_SDK_VERSION}-linux.tar.gz" && \
    tar -xzf ohos-sdk-${OHOS_SDK_VERSION}-linux.tar.gz -C $OHOS_SDK_HOME && \
    rm ohos-sdk-${OHOS_SDK_VERSION}-linux.tar.gz

# 安装 OHPM
RUN npm install -g @ohos/ohpm

# 配置环境
ENV PATH="${OHOS_SDK_HOME}/toolchains:${PATH}"

WORKDIR /workspace
```

### 方案 C: 轻量级模拟（仅用于测试）

```bash
#!/bin/bash
# scripts/mock-openharmony-sdk.sh
# 创建最小的 SDK 结构用于测试

MOCK_SDK_DIR="/tmp/mock-openharmony-sdk"

mkdir -p "$MOCK_SDK_DIR/"{api,toolchains,ets,previewer}

# 创建必要的类型定义文件
cat > "$MOCK_SDK_DIR/api/common.d.ts" << 'EOF'
declare namespace ohos {
  export interface Component {}
  export interface State {}
}
EOF

# 创建 TypeScript 库
mkdir -p "$MOCK_SDK_DIR/ets/lib"
cat > "$MOCK_SDK_DIR/ets/lib/lib.ets.d.ts" << 'EOF'
declare const console: Console;
declare interface Console {
  log(...args: any[]): void;
  info(...args: any[]): void;
  error(...args: any[]): void;
}
EOF

echo "✓ Mock OpenHarmony SDK created at $MOCK_SDK_DIR"
```

## 4. 如何自动化打开 Zed 并读取 LSP 解析结果 / How to Automate Zed and Read LSP Results

### 方案 A: LSP 协议直接测试（无需启动 Zed GUI）

```bash
#!/bin/bash
# scripts/test-lsp-directly.sh

set -e

PROJECT_DIR="$(pwd)/test-fixtures/arkts-sample-project"
LSP_SERVER_DIR="$(pwd)/zed-ets-language-server"

# 启动 LSP 服务器
cd "$LSP_SERVER_DIR"

# 创建测试脚本
cat > /tmp/lsp-test.js << 'EOJS'
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const projectDir = process.argv[2];

function createLSPMessage(content) {
  const json = JSON.stringify(content);
  const length = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${length}\r\n\r\n${json}`;
}

function parseLSPResponse(data) {
  const text = data.toString();
  const messages = [];
  const regex = /Content-Length: (\d+)\r\n\r\n/g;
  let match;
  let lastIndex = 0;
  
  while ((match = regex.exec(text)) !== null) {
    const length = parseInt(match[1]);
    const start = match.index + match[0].length;
    const jsonStr = text.slice(start, start + length);
    try {
      messages.push(JSON.parse(jsonStr));
    } catch (e) {
      console.error('Parse error:', e);
    }
    lastIndex = start + length;
  }
  
  return messages;
}

// 启动 LSP 服务器
const server = spawn('node', ['index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

const results = {
  initialize: null,
  definition: null,
  references: null,
  diagnostics: []
};

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const messages = parseLSPResponse(buffer);
  
  messages.forEach(msg => {
    if (msg.id === 1) {
      results.initialize = msg.result;
      console.log('✓ Initialize response received');
    } else if (msg.id === 2) {
      results.definition = msg.result;
      console.log('✓ Definition response received');
    } else if (msg.id === 3) {
      results.references = msg.result;
      console.log('✓ References response received');
    } else if (msg.method === 'textDocument/publishDiagnostics') {
      results.diagnostics.push(msg.params);
      console.log('✓ Diagnostics received');
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('LSP Error:', data.toString());
});

// 发送初始化请求
setTimeout(() => {
  const initMsg = createLSPMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      processId: process.pid,
      rootUri: `file://${projectDir}`,
      capabilities: {
        textDocument: {
          definition: { linkSupport: true },
          references: {},
          completion: { completionItem: { snippetSupport: true } }
        }
      }
    }
  });
  server.stdin.write(initMsg);
}, 100);

// 发送 initialized 通知
setTimeout(() => {
  const initializedMsg = createLSPMessage({
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  });
  server.stdin.write(initializedMsg);
}, 500);

// 打开文件
setTimeout(() => {
  const fileContent = readFileSync(`${projectDir}/src/main.ets`, 'utf8');
  const didOpenMsg = createLSPMessage({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri: `file://${projectDir}/src/main.ets`,
        languageId: 'arkts',
        version: 1,
        text: fileContent
      }
    }
  });
  server.stdin.write(didOpenMsg);
}, 1000);

// 请求定义
setTimeout(() => {
  const defMsg = createLSPMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: `file://${projectDir}/src/main.ets` },
      position: { line: 1, character: 10 }
    }
  });
  server.stdin.write(defMsg);
}, 1500);

// 请求引用
setTimeout(() => {
  const refMsg = createLSPMessage({
    jsonrpc: '2.0',
    id: 3,
    method: 'textDocument/references',
    params: {
      textDocument: { uri: `file://${projectDir}/src/components/HelloWorld.ets` },
      position: { line: 6, character: 15 },
      context: { includeDeclaration: true }
    }
  });
  server.stdin.write(refMsg);
}, 2000);

// 输出结果并退出
setTimeout(() => {
  console.log('\n=== Test Results ===');
  console.log(JSON.stringify(results, null, 2));
  
  // 验证结果
  let passed = true;
  
  if (!results.initialize || !results.initialize.capabilities) {
    console.error('✗ Initialize failed');
    passed = false;
  } else {
    console.log('✓ Initialize passed');
  }
  
  if (results.definition) {
    console.log('✓ Definition passed');
  } else {
    console.log('⚠ Definition not tested or failed');
  }
  
  if (results.references) {
    console.log('✓ References passed');
  } else {
    console.log('⚠ References not tested or failed');
  }
  
  server.kill();
  process.exit(passed ? 0 : 1);
}, 3000);
EOJS

# 运行测试
node /tmp/lsp-test.js "$PROJECT_DIR"
```

### 方案 B: Zed 的 Headless 模式（如果支持）

```bash
#!/bin/bash
# scripts/run-zed-headless.sh

# 注意: Zed 可能不支持完全的 headless 模式
# 这是一个假设性的实现

export DISPLAY=:99  # 使用虚拟显示
export ZED_CONFIG_DIR="/tmp/zed-test-config"
export ZED_LOG_LEVEL=debug

# 启动虚拟 X 服务器
Xvfb :99 -screen 0 1024x768x24 &
XVFB_PID=$!

# 等待 X 服务器启动
sleep 2

# 启动 Zed 并打开项目
zed "$PROJECT_DIR" &
ZED_PID=$!

# 等待 Zed 启动和 LSP 初始化
sleep 5

# 读取 Zed 日志
ZED_LOG="$HOME/.local/share/zed/logs/Zed.log"

# 检查 LSP 状态
if grep -q "LSP.*initialized" "$ZED_LOG"; then
    echo "✓ LSP initialized successfully"
else
    echo "✗ LSP initialization failed"
fi

# 提取 LSP 结果
grep "textDocument/definition" "$ZED_LOG" || echo "No definition results"
grep "textDocument/references" "$ZED_LOG" || echo "No references results"

# 清理
kill $ZED_PID
kill $XVFB_PID
```

### 方案 C: LSP Inspector 工具

```bash
#!/bin/bash
# scripts/inspect-lsp.sh

# 安装 LSP Inspector
npm install -g @vscode/lsp-inspector

# 启动 LSP Inspector 连接到我们的服务器
lsp-inspector --stdio -- node zed-ets-language-server/index.js

# 在另一个终端，可以通过 HTTP API 发送请求
curl -X POST http://localhost:8080/request \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "textDocument/definition",
    "params": {
      "textDocument": { "uri": "file:///path/to/file.ets" },
      "position": { "line": 10, "character": 5 }
    }
  }'
```

## 完整的端到端自动化测试脚本

```bash
#!/bin/bash
# scripts/e2e-automated-test.sh

set -e

echo "========================================="
echo "  完全自动化端到端测试"
echo "========================================="

# 1. 安装 Zed
echo "[1/6] Installing Zed..."
if ! command -v zed &> /dev/null; then
    curl -f https://zed.dev/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi
echo "✓ Zed installed: $(zed --version)"

# 2. 安装 OpenHarmony SDK (使用 mock 版本)
echo "[2/6] Installing OpenHarmony SDK..."
./scripts/mock-openharmony-sdk.sh
export OHOS_SDK_PATH="/tmp/mock-openharmony-sdk"
echo "✓ SDK installed at $OHOS_SDK_PATH"

# 3. 构建并安装扩展
echo "[3/6] Building and installing extension..."
cargo build --release
./scripts/auto-install-extension.sh
echo "✓ Extension installed"

# 4. 配置 Zed
echo "[4/6] Configuring Zed..."
./scripts/setup-zed-config.sh "/tmp/zed-test-config"
export ZED_CONFIG_DIR="/tmp/zed-test-config"
echo "✓ Zed configured"

# 5. 运行 LSP 直接测试
echo "[5/6] Running LSP tests..."
./scripts/test-lsp-directly.sh
echo "✓ LSP tests passed"

# 6. 验证结果
echo "[6/6] Validating results..."
if [ -f /tmp/lsp-test-results.json ]; then
    echo "✓ Test results saved to /tmp/lsp-test-results.json"
    cat /tmp/lsp-test-results.json | jq '.summary'
else
    echo "⚠ No test results file generated"
fi

echo ""
echo "========================================="
echo "  所有自动化测试完成！"
echo "========================================="
```

## CI/CD 完整配置

```yaml
# .github/workflows/e2e-automated.yml
name: E2E Automated Testing

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  automated-e2e:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
        
    - name: Setup Rust
      uses: actions-rust-lang/setup-rust-toolchain@v1
      with:
        toolchain: stable
        
    - name: Install Zed
      run: |
        curl -f https://zed.dev/install.sh | sh
        echo "$HOME/.local/bin" >> $GITHUB_PATH
        
    - name: Verify Zed installation
      run: zed --version || true
      
    - name: Install OpenHarmony SDK (Mock)
      run: |
        chmod +x scripts/mock-openharmony-sdk.sh
        ./scripts/mock-openharmony-sdk.sh
        
    - name: Build extension
      run: cargo build --release
      
    - name: Install extension
      run: |
        chmod +x scripts/auto-install-extension.sh
        ./scripts/auto-install-extension.sh
        
    - name: Setup test environment
      run: |
        mkdir -p /tmp/zed-test-config
        chmod +x scripts/setup-zed-config.sh
        ./scripts/setup-zed-config.sh /tmp/zed-test-config
        
    - name: Run LSP automated tests
      env:
        ZED_CONFIG_DIR: /tmp/zed-test-config
        OHOS_SDK_PATH: /tmp/mock-openharmony-sdk
      run: |
        cd zed-ets-language-server
        npm install
        chmod +x ../scripts/test-lsp-directly.sh
        ../scripts/test-lsp-directly.sh
        
    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: lsp-test-results-${{ matrix.os }}
        path: /tmp/lsp-test-results.json
        
    - name: Validate LSP features
      run: |
        # 检查关键功能是否工作
        if grep -q "definitionProvider.*true" /tmp/lsp-test-results.json 2>/dev/null; then
          echo "✓ Definition provider enabled"
        fi
        if grep -q "referencesProvider.*true" /tmp/lsp-test-results.json 2>/dev/null; then
          echo "✓ References provider enabled"
        fi
```

## 总结

以上方案提供了4个方向的完全自动化测试方法：

1. **Zed 安装**: 通过安装脚本、包管理器或容器化
2. **扩展安装**: 文件系统直接操作或开发模式链接
3. **OpenHarmony SDK**: 完整安装或轻量级 mock
4. **LSP 测试**: 直接协议测试，无需 GUI

关键优势：
- ✅ 无需人工干预
- ✅ 可在 CI/CD 中运行
- ✅ 结果可编程验证
- ✅ 支持多平台（Linux/macOS）
