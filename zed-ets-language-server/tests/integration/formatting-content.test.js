import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
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
function waitForResponse(responses, predicate, timeout = 3000) {
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

/**
 * 应用 TextEdit 到文本内容
 */
function applyTextEdits(originalText, textEdits) {
  if (!textEdits || textEdits.length === 0) {
    return originalText;
  }

  // 将文本分割成行
  const lines = originalText.split('\n');
  
  // 按照逆序应用编辑（从后往前），避免位置偏移问题
  const sortedEdits = [...textEdits].sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });

  for (const edit of sortedEdits) {
    const { range, newText } = edit;
    const { start, end } = range;

    // 提取需要替换的部分
    const startLine = lines[start.line] || '';
    const endLine = lines[end.line] || '';
    
    const before = startLine.substring(0, start.character);
    const after = endLine.substring(end.character);
    
    // 删除被替换的行
    lines.splice(start.line, end.line - start.line + 1);
    
    // 插入新文本
    const newLines = (before + newText + after).split('\n');
    lines.splice(start.line, 0, ...newLines);
  }

  return lines.join('\n');
}

describe('Code Formatting Content Validation Tests', () => {
  let serverProcess;
  let responses = [];
  let messageId = 1;
  const fixturesDir = join(__dirname, '../fixtures');

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

  it('should format unformatted code correctly', async () => {
    const unformattedContent = readFileSync(
      join(fixturesDir, 'unformatted.ets'),
      'utf8'
    );
    const expectedFormattedContent = readFileSync(
      join(fixturesDir, 'formatted.ets'),
      'utf8'
    );

    const currentId = messageId++;
    const formattingRequest = {
      jsonrpc: '2.0',
      id: currentId,
      method: 'textDocument/formatting',
      params: {
        textDocument: {
          uri: 'file:///unformatted.ets'
        },
        options: {
          tabSize: 2,
          insertSpaces: true
        }
      }
    };

    const message = createLSPMessage(formattingRequest);
    serverProcess.stdin.write(message);

    // 等待格式化响应
    const response = await waitForResponse(
      responses,
      r => r.id === currentId
    );

    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result)).toBe(true);
    expect(response.result.length).toBeGreaterThan(0);

    // 验证 TextEdit 结构
    const textEdit = response.result[0];
    expect(textEdit).toHaveProperty('range');
    expect(textEdit).toHaveProperty('newText');
    expect(textEdit.range).toHaveProperty('start');
    expect(textEdit.range).toHaveProperty('end');

    // 应用 TextEdit 并验证结果
    const formattedContent = applyTextEdits(unformattedContent, response.result);
    
    // 验证格式化后的内容与预期一致
    expect(formattedContent.trim()).toBe(expectedFormattedContent.trim());
  });

  it('should return proper TextEdit for formatting', async () => {
    const currentId = messageId++;
    const formattingRequest = {
      jsonrpc: '2.0',
      id: currentId,
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

    const response = await waitForResponse(
      responses,
      r => r.id === currentId
    );

    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result)).toBe(true);

    // 验证返回的 TextEdit 包含有效的格式化内容
    const textEdit = response.result[0];
    expect(textEdit.newText).toBeDefined();
    expect(textEdit.newText.length).toBeGreaterThan(0);
    
    // 验证格式化内容包含正确的结构
    expect(textEdit.newText).toContain('@Entry');
    expect(textEdit.newText).toContain('@Component');
    expect(textEdit.newText).toContain('struct');
  });

  it('should preserve indentation with insertSpaces option', async () => {
    const currentId = messageId++;
    const formattingRequest = {
      jsonrpc: '2.0',
      id: currentId,
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

    const response = await waitForResponse(
      responses,
      r => r.id === currentId
    );

    expect(response).toBeDefined();
    const textEdit = response.result[0];
    
    // 验证使用空格缩进（2个空格）
    const lines = textEdit.newText.split('\n');
    const indentedLines = lines.filter(line => line.startsWith('  '));
    expect(indentedLines.length).toBeGreaterThan(0);
    
    // 验证使用了空格而不是制表符
    expect(textEdit.newText).not.toContain('\t');
  });

  it('should format with different tab sizes', async () => {
    const currentId = messageId++;
    const formattingRequest = {
      jsonrpc: '2.0',
      id: currentId,
      method: 'textDocument/formatting',
      params: {
        textDocument: {
          uri: 'file:///test.ets'
        },
        options: {
          tabSize: 4,
          insertSpaces: true
        }
      }
    };

    const message = createLSPMessage(formattingRequest);
    serverProcess.stdin.write(message);

    const response = await waitForResponse(
      responses,
      r => r.id === currentId
    );

    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
    
    const textEdit = response.result[0];
    expect(textEdit.newText).toBeDefined();
    expect(textEdit.newText.length).toBeGreaterThan(0);
  });

  it('should handle range formatting and return proper content', async () => {
    const currentId = messageId++;
    const rangeFormattingRequest = {
      jsonrpc: '2.0',
      id: currentId,
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

    const response = await waitForResponse(
      responses,
      r => r.id === currentId
    );

    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
    
    const textEdit = response.result[0];
    expect(textEdit.newText).toBeDefined();
    expect(textEdit.range).toBeDefined();
  });

  it('should return formatted content that is syntactically valid', async () => {
    const currentId = messageId++;
    const formattingRequest = {
      jsonrpc: '2.0',
      id: currentId,
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

    const response = await waitForResponse(
      responses,
      r => r.id === currentId
    );

    expect(response).toBeDefined();
    const textEdit = response.result[0];
    const formattedCode = textEdit.newText;
    
    // 验证格式化后的代码包含必要的ArkTS元素
    expect(formattedCode).toContain('@Entry');
    expect(formattedCode).toContain('@Component');
    expect(formattedCode).toContain('struct');
    expect(formattedCode).toContain('build()');
    
    // 验证代码结构完整（有开始和结束的大括号）
    const openBraces = (formattedCode.match(/{/g) || []).length;
    const closeBraces = (formattedCode.match(/}/g) || []).length;
    expect(openBraces).toBe(closeBraces);
  });

  it('should handle multiple consecutive formatting requests with correct results', async () => {
    const results = [];
    
    for (let i = 0; i < 3; i++) {
      const currentId = messageId++;
      const formattingRequest = {
        jsonrpc: '2.0',
        id: currentId,
        method: 'textDocument/formatting',
        params: {
          textDocument: {
            uri: `file:///test${i}.ets`
          },
          options: {
            tabSize: 2,
            insertSpaces: true
          }
        }
      };

      const message = createLSPMessage(formattingRequest);
      serverProcess.stdin.write(message);

      const response = await waitForResponse(
        responses,
        r => r.id === currentId
      );

      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      
      const textEdit = response.result[0];
      expect(textEdit.newText).toBeDefined();
      results.push(textEdit.newText);
    }

    // 验证所有格式化结果都是有效的
    results.forEach(formattedContent => {
      expect(formattedContent.length).toBeGreaterThan(0);
      expect(formattedContent).toContain('struct');
    });
  });
});

describe('Formatting TextEdit Application', () => {
  it('should correctly apply TextEdit to replace entire document', () => {
    const originalText = 'Line 1\nLine 2\nLine 3';
    const textEdit = {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 6 }
      },
      newText: 'New Line 1\nNew Line 2\nNew Line 3'
    };

    const result = applyTextEdits(originalText, [textEdit]);
    expect(result).toBe('New Line 1\nNew Line 2\nNew Line 3');
  });

  it('should correctly apply TextEdit to replace partial content', () => {
    const originalText = 'Hello World\nTest Line';
    const textEdit = {
      range: {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 11 }
      },
      newText: 'ArkTS'
    };

    const result = applyTextEdits(originalText, [textEdit]);
    expect(result).toBe('Hello ArkTS\nTest Line');
  });

  it('should handle multiple TextEdits', () => {
    const originalText = 'Line 1\nLine 2\nLine 3';
    const textEdits = [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 6 }
        },
        newText: 'First'
      },
      {
        range: {
          start: { line: 2, character: 0 },
          end: { line: 2, character: 6 }
        },
        newText: 'Third'
      }
    ];

    const result = applyTextEdits(originalText, textEdits);
    expect(result).toContain('First');
    expect(result).toContain('Third');
  });
});
