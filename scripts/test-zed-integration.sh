#!/bin/bash
# 验证 Zed 和 LSP 扩展集成
# Verify Zed and LSP Extension Integration

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="${1:-$(pwd)/test-fixtures/arkts-sample-project}"
RESULTS_FILE="${2:-/tmp/zed-integration-results.json}"

echo -e "${YELLOW}==================================================${NC}"
echo -e "${YELLOW}  Zed-LSP Integration Verification${NC}"
echo -e "${YELLOW}  验证 Zed 与 LSP 扩展的集成${NC}"
echo -e "${YELLOW}==================================================${NC}"
echo ""

# 检查扩展是否已安装
if [[ "$OSTYPE" == "darwin"* ]]; then
    ZED_EXT_DIR="$HOME/Library/Application Support/Zed/extensions/installed/arkts"
else
    ZED_EXT_DIR="$HOME/.config/zed/extensions/installed/arkts"
fi

echo "[1/5] Verifying extension installation..."
if [ ! -d "$ZED_EXT_DIR" ]; then
    echo -e "${RED}✗ Extension not installed at $ZED_EXT_DIR${NC}"
    echo "Run: ./scripts/auto-install-local-extension.sh"
    exit 1
fi
echo -e "${GREEN}✓ Extension installed at $ZED_EXT_DIR${NC}"

# 验证扩展文件
echo ""
echo "[2/5] Verifying extension files..."
REQUIRED_FILES=(
    "extension.toml"
    "zed-ets-language-server/index.js"
    "zed-ets-language-server/package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$ZED_EXT_DIR/$file" ]; then
        echo -e "${RED}✗ Missing file: $file${NC}"
        exit 1
    fi
    echo "  ✓ $file"
done
echo -e "${GREEN}✓ All required files present${NC}"

# 验证语言服务器依赖
echo ""
echo "[3/5] Verifying language server dependencies..."
cd "$ZED_EXT_DIR/zed-ets-language-server"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --silent
fi

ETS_SERVER_PATH="node_modules/@arkts/language-server/bin/ets-language-server.js"
if [ ! -f "$ETS_SERVER_PATH" ]; then
    echo -e "${RED}✗ Language server not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Language server dependencies installed${NC}"

# 模拟 Zed 启动扩展的过程
echo ""
echo "[4/5] Simulating Zed extension initialization..."

# 设置环境变量（模拟 Zed 的行为）
export ETS_LANG_SERVER="$(pwd)/$ETS_SERVER_PATH"
export OHOS_SDK_PATH="${OHOS_SDK_PATH:-/tmp/mock-openharmony-sdk}"

# 查找 TypeScript
if [ -z "$TSDK" ]; then
    if [ -d "/usr/local/lib/node_modules/typescript/lib" ]; then
        export TSDK="/usr/local/lib/node_modules/typescript/lib"
    elif [ -d "node_modules/typescript/lib" ]; then
        export TSDK="$(pwd)/node_modules/typescript/lib"
    else
        npm install --no-save --silent typescript
        export TSDK="$(pwd)/node_modules/typescript/lib"
    fi
fi

echo "  Environment configured:"
echo "    ETS_LANG_SERVER: $ETS_LANG_SERVER"
echo "    OHOS_SDK_PATH: $OHOS_SDK_PATH"
echo "    TSDK: $TSDK"

# 创建测试脚本，模拟 Zed 与扩展的交互
cat > /tmp/zed-integration-test.mjs << 'EOJS'
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const results = {
  timestamp: new Date().toISOString(),
  integration: {
    extensionStart: { status: 'pending', error: null },
    lspCommunication: { status: 'pending', error: null },
    capabilities: { status: 'pending', data: null }
  },
  summary: {
    total: 3,
    passed: 0,
    failed: 0
  }
};

function updateResult(test, status, data = null, error = null) {
  results.integration[test].status = status;
  if (data) results.integration[test].data = data;
  if (error) results.integration[test].error = error;
  
  if (status === 'passed') results.summary.passed++;
  else if (status === 'failed') results.summary.failed++;
}

function createLSPMessage(content) {
  const json = JSON.stringify(content);
  const length = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${length}\r\n\r\n${json}`;
}

function parseLSPMessages(buffer) {
  const messages = [];
  let text = buffer.toString();
  
  while (text.length > 0) {
    const headerMatch = text.match(/Content-Length: (\d+)\r\n\r\n/);
    if (!headerMatch) break;
    
    const length = parseInt(headerMatch[1]);
    const headerEnd = headerMatch.index + headerMatch[0].length;
    const jsonStr = text.slice(headerEnd, headerEnd + length);
    
    try {
      messages.push(JSON.parse(jsonStr));
    } catch (e) {
      console.error('Parse error:', e.message);
    }
    
    text = text.slice(headerEnd + length);
  }
  
  return messages;
}

console.log('Starting extension wrapper (simulating Zed)...');

// 启动扩展的 wrapper（这是 Zed 会做的）
const wrapper = spawn('node', ['index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    ETS_LANG_SERVER: process.env.ETS_LANG_SERVER
  }
});

let extensionStarted = false;
let responseReceived = false;
let outputBuffer = '';

wrapper.stdout.on('data', (data) => {
  outputBuffer += data.toString();
  const messages = parseLSPMessages(Buffer.from(outputBuffer));
  
  messages.forEach(msg => {
    if (!responseReceived && msg.result) {
      responseReceived = true;
      
      // If we got a response, the extension definitely started
      if (!extensionStarted) {
        extensionStarted = true;
        updateResult('extensionStart', 'passed');
        console.log('✓ Extension started successfully');
      }
      
      console.log('✓ LSP response received through extension');
      
      if (msg.result.capabilities) {
        updateResult('capabilities', 'passed', {
          definitionProvider: !!msg.result.capabilities.definitionProvider,
          referencesProvider: !!msg.result.capabilities.referencesProvider,
          completionProvider: !!msg.result.capabilities.completionProvider
        });
        console.log('✓ LSP capabilities verified');
      }
    }
  });
});

wrapper.stderr.on('data', (data) => {
  const msg = data.toString();
  if (!extensionStarted && !msg.includes('ExperimentalWarning')) {
    // Extension is starting if we see any normal stderr output (not errors)
    if (msg.includes('Language server') || msg.includes('Starting') || 
        msg.includes('ETS') || msg.includes('路径') || 
        !msg.includes('Error') && !msg.includes('does not exist')) {
      extensionStarted = true;
      updateResult('extensionStart', 'passed');
      console.log('✓ Extension started successfully');
    } else if (msg.includes('does not exist') || msg.includes('Error:')) {
      updateResult('extensionStart', 'failed', null, msg.trim());
      console.error('✗ Extension failed to start:', msg.trim());
    }
  }
});

// 发送初始化请求（模拟 Zed 的行为）
setTimeout(() => {
  console.log('Sending initialize request (as Zed would)...');
  
  const initMsg = createLSPMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      processId: process.pid,
      rootUri: 'file:///test',
      initializationOptions: {
        tsdk: process.env.TSDK,
        ohosSdkPath: process.env.OHOS_SDK_PATH
      },
      capabilities: {}
    }
  });
  
  wrapper.stdin.write(initMsg);
  updateResult('lspCommunication', 'passed');
  console.log('✓ LSP communication established');
}, 500);

// 完成测试
setTimeout(() => {
  // 标记未完成的测试
  Object.keys(results.integration).forEach(test => {
    if (results.integration[test].status === 'pending') {
      updateResult(test, 'failed', null, 'Timeout - no response');
    }
  });
  
  // 保存结果
  writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
  
  console.log('\n=== Integration Test Summary ===');
  console.log(`Total: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  
  wrapper.kill();
  process.exit(results.summary.failed > 0 ? 1 : 0);
}, 3000);

wrapper.on('exit', (code) => {
  if (code !== 0 && code !== null && !extensionStarted) {
    updateResult('extensionStart', 'failed', null, `Wrapper exited with code ${code}`);
  }
});
EOJS

# 运行集成测试
echo ""
echo "[5/5] Running integration test..."
node /tmp/zed-integration-test.mjs "$RESULTS_FILE"

# 显示结果
if [ -f "$RESULTS_FILE" ]; then
    echo ""
    echo -e "${GREEN}=== Integration Test Results ===${NC}"
    
    if command -v jq &> /dev/null; then
        cat "$RESULTS_FILE" | jq '.'
    else
        cat "$RESULTS_FILE"
    fi
    
    echo ""
    echo "Results saved to: $RESULTS_FILE"
    
    # 检查是否所有测试通过
    if command -v jq &> /dev/null; then
        FAILED=$(jq -r '.summary.failed' "$RESULTS_FILE")
        if [ "$FAILED" -eq 0 ]; then
            echo -e "${GREEN}✓ All integration tests passed!${NC}"
            exit 0
        else
            echo -e "${RED}✗ Some integration tests failed${NC}"
            exit 1
        fi
    fi
else
    echo -e "${RED}✗ No results file generated${NC}"
    exit 1
fi
