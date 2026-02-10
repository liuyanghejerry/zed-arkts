#!/bin/bash
# 自动化测试 LSP 并读取解析结果（无需 Zed GUI）
# Automated LSP testing and result reading (no Zed GUI required)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="${1:-$(pwd)/test-fixtures/arkts-sample-project}"
RESULTS_FILE="${2:-/tmp/lsp-test-results.json}"

echo -e "${YELLOW}Automated LSP Testing${NC}"
echo "Project: $PROJECT_DIR"
echo "Results: $RESULTS_FILE"
echo ""

# 检查项目是否存在
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}✗ Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi

# 进入语言服务器目录
cd zed-ets-language-server

# 确保依赖已安装
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# 验证语言服务器是否安装
ETS_SERVER_PATH="node_modules/@arkts/language-server/bin/ets-language-server.js"
if [ ! -f "$ETS_SERVER_PATH" ]; then
    echo -e "${RED}✗ Language server not found at $ETS_SERVER_PATH${NC}"
    echo "Please run: npm install"
    exit 1
fi

# 设置环境变量
export ETS_LANG_SERVER="$(pwd)/$ETS_SERVER_PATH"
echo "Language server: $ETS_LANG_SERVER"

# 设置 OHOS SDK 路径（如果未设置）
if [ -z "$OHOS_SDK_PATH" ]; then
    export OHOS_SDK_PATH="/tmp/mock-openharmony-sdk"
    echo "Using default OHOS_SDK_PATH: $OHOS_SDK_PATH"
    
    # 如果 mock SDK 不存在，创建它
    if [ ! -d "$OHOS_SDK_PATH" ]; then
        echo "Creating mock OpenHarmony SDK..."
        ../scripts/install-mock-ohos-sdk.sh "$OHOS_SDK_PATH"
    fi
fi

# 设置 TypeScript 路径（如果未设置）
if [ -z "$TSDK" ]; then
    # 尝试查找 TypeScript
    if [ -d "/usr/local/lib/node_modules/typescript/lib" ]; then
        export TSDK="/usr/local/lib/node_modules/typescript/lib"
    elif [ -d "node_modules/typescript/lib" ]; then
        export TSDK="$(pwd)/node_modules/typescript/lib"
    else
        # 安装 TypeScript 作为开发依赖
        echo "Installing TypeScript..."
        npm install --no-save typescript
        export TSDK="$(pwd)/node_modules/typescript/lib"
    fi
    echo "Using TSDK: $TSDK"
fi

# 创建测试脚本
cat > /tmp/lsp-automated-test.mjs << 'EOJS'
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const projectDir = process.argv[2];
const resultsFile = process.argv[3] || '/tmp/lsp-test-results.json';

const results = {
  timestamp: new Date().toISOString(),
  projectDir,
  tests: {
    initialize: { status: 'pending', data: null },
    definition: { status: 'pending', data: null },
    references: { status: 'pending', data: null },
    completion: { status: 'pending', data: null }
  },
  diagnostics: [],
  summary: {
    total: 4,
    passed: 0,
    failed: 0,
    pending: 4
  }
};

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

function updateResults(test, status, data) {
  // Only update if the test hasn't been updated yet (prevent duplicates)
  if (results.tests[test].status === 'pending') {
    results.tests[test].status = status;
    results.tests[test].data = data;
    results.summary.pending--;
    if (status === 'passed') {
      results.summary.passed++;
    } else if (status === 'failed') {
      results.summary.failed++;
    }
  }
}

console.log('Starting LSP server...');

const server = spawn('node', ['index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    ETS_LANG_SERVER: process.env.ETS_LANG_SERVER
  }
});

let outputBuffer = '';

server.stdout.on('data', (data) => {
  outputBuffer += data.toString();
  const messages = parseLSPMessages(Buffer.from(outputBuffer));
  
  messages.forEach(msg => {
    // Initialize response
    if (msg.id === 1 && msg.result) {
      console.log('✓ Initialize response received');
      if (msg.result.capabilities) {
        updateResults('initialize', 'passed', {
          capabilities: msg.result.capabilities
        });
      } else {
        updateResults('initialize', 'failed', { error: 'No capabilities' });
      }
    }
    
    // Definition response
    if (msg.id === 2) {
      console.log('✓ Definition response received');
      if (msg.result) {
        updateResults('definition', 'passed', msg.result);
      } else if (msg.error) {
        updateResults('definition', 'failed', msg.error);
      }
    }
    
    // References response
    if (msg.id === 3) {
      console.log('✓ References response received');
      if (msg.result) {
        updateResults('references', 'passed', msg.result);
      } else if (msg.error) {
        updateResults('references', 'failed', msg.error);
      }
    }
    
    // Completion response
    if (msg.id === 4) {
      console.log('✓ Completion response received');
      if (msg.result) {
        updateResults('completion', 'passed', msg.result);
      } else if (msg.error) {
        updateResults('completion', 'failed', msg.error);
      }
    }
    
    // Diagnostics
    if (msg.method === 'textDocument/publishDiagnostics') {
      console.log('✓ Diagnostics received');
      results.diagnostics.push(msg.params);
    }
  });
});

server.stderr.on('data', (data) => {
  const errorMsg = data.toString();
  if (!errorMsg.includes('ExperimentalWarning')) {
    console.error('LSP stderr:', errorMsg);
  }
});

// Test sequence
let testStep = 0;

const runNextTest = () => {
  testStep++;
  
  switch(testStep) {
    case 1:
      // Initialize
      setTimeout(() => {
        console.log('[1/6] Sending initialize request...');
        const initMsg = createLSPMessage({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            processId: process.pid,
            rootUri: `file://${projectDir}`,
            initializationOptions: {
              tsdk: process.env.TSDK || '/usr/local/lib/node_modules/typescript/lib',
              ohosSdkPath: process.env.OHOS_SDK_PATH || '/tmp/mock-openharmony-sdk'
            },
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
        runNextTest();
      }, 100);
      break;
      
    case 2:
      // Initialized notification
      setTimeout(() => {
        console.log('[2/6] Sending initialized notification...');
        const initializedMsg = createLSPMessage({
          jsonrpc: '2.0',
          method: 'initialized',
          params: {}
        });
        server.stdin.write(initializedMsg);
        runNextTest();
      }, 500);
      break;
      
    case 3:
      // Open file
      setTimeout(() => {
        console.log('[3/6] Opening test file...');
        try {
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
        } catch (e) {
          console.error('Failed to read file:', e.message);
        }
        runNextTest();
      }, 1000);
      break;
      
    case 4:
      // Request definition
      setTimeout(() => {
        console.log('[4/6] Requesting definition...');
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
        runNextTest();
      }, 1500);
      break;
      
    case 5:
      // Request references
      setTimeout(() => {
        console.log('[5/6] Requesting references...');
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
        runNextTest();
      }, 2000);
      break;
      
    case 6:
      // Request completion
      setTimeout(() => {
        console.log('[6/6] Requesting completion...');
        const completionMsg = createLSPMessage({
          jsonrpc: '2.0',
          id: 4,
          method: 'textDocument/completion',
          params: {
            textDocument: { uri: `file://${projectDir}/src/main.ets` },
            position: { line: 3, character: 10 }
          }
        });
        server.stdin.write(completionMsg);
        runNextTest();
      }, 2500);
      break;
      
    case 7:
      // Finalize and save results
      setTimeout(() => {
        console.log('\n=== Finalizing results ===');
        
        // Mark pending tests as failed if not completed
        Object.keys(results.tests).forEach(test => {
          if (results.tests[test].status === 'pending') {
            results.tests[test].status = 'timeout';
            results.summary.pending--;
            results.summary.failed++;
          }
        });
        
        // Save results
        writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`\n✓ Results saved to ${resultsFile}`);
        
        // Print summary
        console.log('\n=== Test Summary ===');
        console.log(`Total: ${results.summary.total}`);
        console.log(`Passed: ${results.summary.passed}`);
        console.log(`Failed: ${results.summary.failed}`);
        console.log(`Pending: ${results.summary.pending}`);
        
        // Print individual test results
        console.log('\n=== Individual Results ===');
        Object.keys(results.tests).forEach(test => {
          const status = results.tests[test].status;
          const symbol = status === 'passed' ? '✓' : (status === 'failed' ? '✗' : '⚠');
          console.log(`${symbol} ${test}: ${status}`);
        });
        
        // Exit
        server.kill();
        const exitCode = results.summary.failed > 0 ? 1 : 0;
        process.exit(exitCode);
      }, 3000);
      break;
  }
};

// Start test sequence
runNextTest();

// Handle server exit
server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\nLSP server exited with code ${code}`);
  }
});

EOJS

# 运行测试
echo "Running automated LSP test..."
node /tmp/lsp-automated-test.mjs "$PROJECT_DIR" "$RESULTS_FILE"

# 返回原目录
cd ..

# 显示结果
if [ -f "$RESULTS_FILE" ]; then
    echo ""
    echo -e "${GREEN}=== Test Results ===${NC}"
    
    # 使用 jq 如果可用，否则用 cat
    if command -v jq &> /dev/null; then
        cat "$RESULTS_FILE" | jq '.'
    else
        cat "$RESULTS_FILE"
    fi
    
    echo ""
    echo "Full results saved to: $RESULTS_FILE"
else
    echo -e "${RED}✗ No results file generated${NC}"
    exit 1
fi
