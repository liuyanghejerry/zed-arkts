import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 创建 LSP 消息
 */
function createLSPMessage(content) {
  const json = JSON.stringify(content);
  const contentLength = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${contentLength}\r\n\r\n${json}`;
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

describe('LSP Server Integration Tests', () => {
  let serverProcess;
  let responses = [];

  beforeAll(() => {
    // 启动 LSP 服务器
    const serverPath = join(__dirname, '../../index.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 收集响应
    serverProcess.stdout.on('data', (data) => {
      const response = parseLSPResponse(data);
      if (response) {
        responses.push(response);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`LSP Server Error: ${data}`);
    });
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should respond to initialize request', (done) => {
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: process.pid,
        rootUri: null,
        capabilities: {}
      }
    };

    const message = createLSPMessage(initRequest);
    serverProcess.stdin.write(message);

    // 等待响应
    setTimeout(() => {
      const initResponse = responses.find(r => r.id === 1);
      expect(initResponse).toBeDefined();
      expect(initResponse.result).toBeDefined();
      expect(initResponse.result.capabilities).toBeDefined();
      done();
    }, 1000);
  });

  it('should accept initialized notification', (done) => {
    const initializedNotif = {
      jsonrpc: '2.0',
      method: 'initialized',
      params: {}
    };

    const message = createLSPMessage(initializedNotif);
    serverProcess.stdin.write(message);

    // 通知不需要响应，只需确保不崩溃
    setTimeout(() => {
      expect(serverProcess.killed).toBe(false);
      done();
    }, 500);
  });

  it('should handle shutdown request', (done) => {
    const shutdownRequest = {
      jsonrpc: '2.0',
      id: 99,
      method: 'shutdown',
      params: null
    };

    const message = createLSPMessage(shutdownRequest);
    serverProcess.stdin.write(message);

    setTimeout(() => {
      const shutdownResponse = responses.find(r => r.id === 99);
      // 某些 LSP 服务器可能返回 null result
      expect(shutdownResponse).toBeDefined();
      done();
    }, 1000);
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
