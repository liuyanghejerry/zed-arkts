import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, '../../index.js');
const mockServerPath = join(__dirname, '../mocks/mock-ets-server.js');
const bundledTsdk = join(__dirname, '../../node_modules/ohos-typescript/lib');

// Hermetic env: never inherit ambient tsdk/sdk settings from the shell.
function baseEnv(overrides = {}) {
  return {
    ...process.env,
    ETS_LANG_SERVER: mockServerPath,
    TSDK: '',
    ZED_ETS_TSDK: '',
    OHOS_SDK_PATH: '',
    ZED_ETS_OHOS_SDK_PATH: '',
    ...overrides,
  };
}

/**
 * 创建 LSP 消息
 */
function createLSPMessage(content) {
  const contentLength = Buffer.byteLength(JSON.stringify(content));
  return `Content-Length: ${contentLength}\r\n\r\n${JSON.stringify(content)}`;
}

/**
 * 解析 LSP 响应
 */
function parseLSPResponse(data) {
  const text = data.toString();
  const match = text.match(/Content-Length: (\d+)\r\n\r\n(.*)/s);
  if (!match) return null;

  try {
    return JSON.parse(match[2]);
  } catch (e) {
    return null;
  }
}

/**
 * 等待特定响应
 */
function waitForResponse(responses, predicate, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      const response = responses.find(predicate);
      if (response) {
        clearInterval(checkInterval);
        resolve(response);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for response'));
      }
    }, 50);
  });
}

function startWrapper(env) {
  const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });

  const responses = [];
  serverProcess.stdout.on('data', (data) => {
    const response = parseLSPResponse(data);
    if (response) {
      responses.push(response);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`LSP Server Error: ${data}`);
  });

  return { serverProcess, responses };
}

function initializeMessage(id) {
  return createLSPMessage({
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      processId: null,
      rootUri: null,
      capabilities: {},
    },
  });
}

describe('LSP Server Integration Tests', () => {
  let serverProcess;
  let responses = [];
  let messageId = 1;

  beforeAll(() => {
    ({ serverProcess, responses } = startWrapper(baseEnv()));
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should respond to initialize request', async () => {
    serverProcess.stdin.write(initializeMessage(messageId));
    const initResponse = await waitForResponse(responses, (r) => r.id === messageId);
    messageId++;

    expect(initResponse.result).toBeDefined();
    expect(initResponse.result.capabilities).toBeDefined();
  });

  it('should auto-detect the bundled tsdk when none is configured', async () => {
    serverProcess.stdin.write(initializeMessage(messageId));
    const initResponse = await waitForResponse(responses, (r) => r.id === messageId);
    messageId++;

    expect(initResponse.result.initializationOptions.typescript.tsdk).toBe(bundledTsdk);
  });

  it('should accept initialized notification', async () => {
    serverProcess.stdin.write(createLSPMessage({
      jsonrpc: '2.0',
      method: 'initialized',
      params: {},
    }));

    // 通知不需要响应，只需确保不崩溃
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(serverProcess.exitCode).toBeNull();
  });

  it('should handle shutdown request', async () => {
    serverProcess.stdin.write(createLSPMessage({
      jsonrpc: '2.0',
      id: 99,
      method: 'shutdown',
      params: null,
    }));

    const shutdownResponse = await waitForResponse(responses, (r) => r.id === 99);
    // 某些 LSP 服务器可能返回 null result
    expect(shutdownResponse).toBeDefined();
  });
});

describe('LSP tsdk fallback', () => {
  // A tsdk without lib/typescript.js (e.g. the native TypeScript 7 line)
  // used to hang the real server inside initialize. The wrapper must
  // substitute the bundled ohos-typescript instead of forwarding it.
  it('substitutes a broken TSDK env value with the bundled ohos-typescript', async () => {
    const brokenTsdkDir = mkdtempSync(join(tmpdir(), 'zed-ets-broken-tsdk-'));
    const { serverProcess, responses } = startWrapper(baseEnv({ TSDK: brokenTsdkDir }));

    try {
      serverProcess.stdin.write(initializeMessage(1));
      const initResponse = await waitForResponse(responses, (r) => r.id === 1);

      expect(initResponse.result.initializationOptions.typescript.tsdk).toBe(bundledTsdk);
    } finally {
      serverProcess.kill();
    }
  });

  it('forwards a valid TSDK unchanged', async () => {
    const { serverProcess, responses } = startWrapper(baseEnv({ TSDK: bundledTsdk }));

    try {
      serverProcess.stdin.write(initializeMessage(1));
      const initResponse = await waitForResponse(responses, (r) => r.id === 1);

      expect(initResponse.result.initializationOptions.typescript.tsdk).toBe(bundledTsdk);
    } finally {
      serverProcess.kill();
    }
  });
});

describe('LSP Message Protocol', () => {
  it('should format messages correctly', () => {
    const content = { jsonrpc: '2.0', method: 'test' };
    const message = createLSPMessage(content);

    expect(message).toContain('Content-Length:');
    expect(message).toContain('\r\n\r\n');
    expect(message).toContain(JSON.stringify(content));
  });

  it('should parse responses correctly', () => {
    const mockResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { success: true }
    };
    const data = createLSPMessage(mockResponse);
    const parsed = parseLSPResponse(Buffer.from(data));

    expect(parsed).toEqual(mockResponse);
  });
});
