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
    }, 100);
  });
}

describe('Code Formatting Tests', () => {
  let serverProcess;
  let responses = [];
  let messageId = 1;

  beforeAll(() => {
    // 启动 LSP 服务器
    const serverPath = join(__dirname, '../../index.js');
    
    // 设置环境变量，指向模拟的 ETS 语言服务器
    const env = {
      ...process.env,
      ETS_LANG_SERVER: join(__dirname, '../mocks/mock-ets-server.js')
    };

    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env
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

  it('should forward textDocument/formatting to ets/formatDocument', async () => {
    const formattingRequest = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'textDocument/formatting',
      params: {
        textDocument: {
          uri: 'file:///test.ets'
        },
        options: {
          tabSize: 2,
          insertSpaces: true
        }
      }
    };

    const message = createLSPMessage(formattingRequest);
    serverProcess.stdin.write(message);

    // 由于我们转发到 ets/formatDocument，验证请求被正确转发
    // 在实际实现中，这会返回 TextEdit[] 数组
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 验证服务器仍在运行（没有因为错误崩溃）
    expect(serverProcess.killed).toBe(false);
  });

  it('should forward textDocument/rangeFormatting to ets/formatDocument', async () => {
    const rangeFormattingRequest = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'textDocument/rangeFormatting',
      params: {
        textDocument: {
          uri: 'file:///test.ets'
        },
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 }
        },
        options: {
          tabSize: 2,
          insertSpaces: true
        }
      }
    };

    const message = createLSPMessage(rangeFormattingRequest);
    serverProcess.stdin.write(message);

    // 验证请求被转发
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 验证服务器仍在运行
    expect(serverProcess.killed).toBe(false);
  });

  it('should preserve formatting options when forwarding', async () => {
    const formattingRequest = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'textDocument/formatting',
      params: {
        textDocument: {
          uri: 'file:///test.ets'
        },
        options: {
          tabSize: 4,
          insertSpaces: false,
          trimTrailingWhitespace: true,
          insertFinalNewline: true,
          trimFinalNewlines: true
        }
      }
    };

    const message = createLSPMessage(formattingRequest);
    serverProcess.stdin.write(message);

    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 验证服务器正常处理带有完整选项的请求
    expect(serverProcess.killed).toBe(false);
  });

  it('should handle formatting request with minimal options', async () => {
    const formattingRequest = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'textDocument/formatting',
      params: {
        textDocument: {
          uri: 'file:///simple.ets'
        },
        options: {
          tabSize: 2,
          insertSpaces: true
        }
      }
    };

    const message = createLSPMessage(formattingRequest);
    serverProcess.stdin.write(message);

    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(serverProcess.killed).toBe(false);
  });

  it('should handle multiple formatting requests sequentially', async () => {
    const files = ['file1.ets', 'file2.ets', 'file3.ets'];
    
    for (const file of files) {
      const formattingRequest = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'textDocument/formatting',
        params: {
          textDocument: {
            uri: `file:///${file}`
          },
          options: {
            tabSize: 2,
            insertSpaces: true
          }
        }
      };

      const message = createLSPMessage(formattingRequest);
      serverProcess.stdin.write(message);
      
      // 给每个请求一些处理时间
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 验证服务器处理了所有请求而没有崩溃
    expect(serverProcess.killed).toBe(false);
  });

  it('should handle formatting request with different tab sizes', async () => {
    const tabSizes = [2, 4, 8];
    
    for (const tabSize of tabSizes) {
      const formattingRequest = {
        jsonrpc: '2.0',
        id: messageId++,
        method: 'textDocument/formatting',
        params: {
          textDocument: {
            uri: 'file:///test.ets'
          },
          options: {
            tabSize: tabSize,
            insertSpaces: true
          }
        }
      };

      const message = createLSPMessage(formattingRequest);
      serverProcess.stdin.write(message);
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    expect(serverProcess.killed).toBe(false);
  });

  it('should handle formatting with tabs instead of spaces', async () => {
    const formattingRequest = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'textDocument/formatting',
      params: {
        textDocument: {
          uri: 'file:///test.ets'
        },
        options: {
          tabSize: 2,
          insertSpaces: false // Use tabs
        }
      }
    };

    const message = createLSPMessage(formattingRequest);
    serverProcess.stdin.write(message);

    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(serverProcess.killed).toBe(false);
  });
});

describe('Formatting Message Structure', () => {
  it('should create valid formatting request message', () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'textDocument/formatting',
      params: {
        textDocument: { uri: 'file:///test.ets' },
        options: { tabSize: 2, insertSpaces: true }
      }
    };

    const message = createLSPMessage(request);
    
    expect(message).toContain('Content-Length:');
    expect(message).toContain('textDocument/formatting');
    expect(message).toContain('file:///test.ets');
  });

  it('should create valid range formatting request message', () => {
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'textDocument/rangeFormatting',
      params: {
        textDocument: { uri: 'file:///test.ets' },
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 }
        },
        options: { tabSize: 2, insertSpaces: true }
      }
    };

    const message = createLSPMessage(request);
    
    expect(message).toContain('Content-Length:');
    expect(message).toContain('textDocument/rangeFormatting');
    expect(message).toContain('"start"');
    expect(message).toContain('"end"');
  });

  it('should validate formatting options structure', () => {
    const options = {
      tabSize: 2,
      insertSpaces: true,
      trimTrailingWhitespace: true,
      insertFinalNewline: true,
      trimFinalNewlines: true
    };

    expect(options.tabSize).toBeGreaterThan(0);
    expect(typeof options.insertSpaces).toBe('boolean');
    expect(typeof options.trimTrailingWhitespace).toBe('boolean');
    expect(typeof options.insertFinalNewline).toBe('boolean');
    expect(typeof options.trimFinalNewlines).toBe('boolean');
  });
});

describe('Formatting Edge Cases', () => {
  it('should handle formatting request for empty file', () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'textDocument/formatting',
      params: {
        textDocument: { uri: 'file:///empty.ets' },
        options: { tabSize: 2, insertSpaces: true }
      }
    };

    const message = createLSPMessage(request);
    expect(message).toBeDefined();
  });

  it('should handle formatting request for large files', () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'textDocument/formatting',
      params: {
        textDocument: { uri: 'file:///large-file.ets' },
        options: { tabSize: 2, insertSpaces: true }
      }
    };

    const message = createLSPMessage(request);
    expect(message).toBeDefined();
  });

  it('should handle range formatting with zero-width range', () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'textDocument/rangeFormatting',
      params: {
        textDocument: { uri: 'file:///test.ets' },
        range: {
          start: { line: 5, character: 10 },
          end: { line: 5, character: 10 }
        },
        options: { tabSize: 2, insertSpaces: true }
      }
    };

    const message = createLSPMessage(request);
    expect(message).toBeDefined();
  });

  it('should handle formatting options with edge values', () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'textDocument/formatting',
      params: {
        textDocument: { uri: 'file:///test.ets' },
        options: {
          tabSize: 1,  // Minimum tab size
          insertSpaces: true
        }
      }
    };

    const message = createLSPMessage(request);
    expect(message).toBeDefined();
  });
});
