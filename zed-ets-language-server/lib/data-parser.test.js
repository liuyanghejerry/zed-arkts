import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parse, clearBuffer } from './data-parser.js';

// Mock the logger module
vi.mock('./logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('data-parser', () => {
  beforeEach(() => {
    // Clear buffer before each test
    clearBuffer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear buffer after each test
    clearBuffer();
  });

  describe('parse', () => {
    it('should parse a complete message with Content-Length header', (done) => {
      const message = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const messageJson = JSON.stringify(message);
      const data = Buffer.from(`Content-Length: ${messageJson.length}\r\n\r\n${messageJson}`);
      
      const callback = vi.fn((parsedMessage) => {
        expect(parsedMessage).toEqual(message);
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      });

      parse(data, callback);
    });

    it('should handle multiple messages in one buffer', () => {
      const message1 = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const message2 = { jsonrpc: '2.0', method: 'initialized' };
      
      const messageJson1 = JSON.stringify(message1);
      const messageJson2 = JSON.stringify(message2);
      
      const data = Buffer.from(
        `Content-Length: ${messageJson1.length}\r\n\r\n${messageJson1}` +
        `Content-Length: ${messageJson2.length}\r\n\r\n${messageJson2}`
      );
      
      const callback = vi.fn();
      parse(data, callback);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, message1);
      expect(callback).toHaveBeenNthCalledWith(2, message2);
    });

    it('should handle partial messages across multiple parse calls', (done) => {
      const message = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const messageJson = JSON.stringify(message);
      
      // Split the data into two parts
      const headerPart = `Content-Length: ${messageJson.length}\r\n\r\n`;
      const messagePart = messageJson;
      
      const callback = vi.fn((parsedMessage) => {
        expect(parsedMessage).toEqual(message);
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      });

      // First call with just the header
      parse(Buffer.from(headerPart), callback);
      expect(callback).not.toHaveBeenCalled();
      
      // Second call with the message
      parse(Buffer.from(messagePart), callback);
    });

    it('should handle message with additional headers', (done) => {
      const message = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const messageJson = JSON.stringify(message);
      const data = Buffer.from(
        `Content-Type: application/vscode-jsonrpc; charset=utf-8\r\n` +
        `Content-Length: ${messageJson.length}\r\n\r\n${messageJson}`
      );
      
      const callback = vi.fn((parsedMessage) => {
        expect(parsedMessage).toEqual(message);
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      });

      parse(data, callback);
    });

    it('should ignore incomplete messages and wait for more data', () => {
      const message = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const messageJson = JSON.stringify(message);
      
      // Send header but not the complete message
      const incompleteData = Buffer.from(
        `Content-Length: ${messageJson.length}\r\n\r\n${messageJson.substring(0, 10)}`
      );
      
      const callback = vi.fn();
      parse(incompleteData, callback);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should ignore data without Content-Length header', () => {
      const data = Buffer.from('Some random data without proper headers');
      const callback = vi.fn();
      
      parse(data, callback);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should ignore data with invalid Content-Length', () => {
      const data = Buffer.from('Content-Length: invalid\r\n\r\n{}');
      const callback = vi.fn();
      
      parse(data, callback);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should ignore data with negative Content-Length', () => {
      const data = Buffer.from('Content-Length: -10\r\n\r\n{}');
      const callback = vi.fn();
      
      parse(data, callback);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should ignore data with Content-Length header but no message terminator', () => {
      const data = Buffer.from('Content-Length: 2\r\n');
      const callback = vi.fn();
      
      parse(data, callback);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const invalidJson = '{ invalid json }';
      const data = Buffer.from(`Content-Length: ${invalidJson.length}\r\n\r\n${invalidJson}`);
      
      const { logger } = await import('./logger.js');
      const callback = vi.fn();
      
      parse(data, callback);
      
      expect(callback).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing message:')
      );
    });

    it('should handle empty message content', () => {
      const data = Buffer.from('Content-Length: 0\r\n\r\n');
      const callback = vi.fn();
      
      parse(data, callback);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should preserve buffer state across multiple parse calls', () => {
      const message1 = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const messageJson1 = JSON.stringify(message1);
      
      // First, send partial data
      const partialHeader = 'Content-Length: ';
      parse(Buffer.from(partialHeader), () => {});
      
      // Then send the rest
      const restOfData = `${messageJson1.length}\r\n\r\n${messageJson1}`;
      const callback = vi.fn();
      parse(Buffer.from(restOfData), callback);
      
      expect(callback).toHaveBeenCalledWith(message1);
    });

    it('should handle complex JSON messages with nested objects', (done) => {
      const message = {
        jsonrpc: '2.0',
        method: 'textDocument/completion',
        params: {
          textDocument: { uri: 'file:///test.ets' },
          position: { line: 10, character: 5 },
          context: { triggerKind: 1 }
        },
        id: 2
      };
      
      const messageJson = JSON.stringify(message);
      const data = Buffer.from(`Content-Length: ${messageJson.length}\r\n\r\n${messageJson}`);
      
      const callback = vi.fn((parsedMessage) => {
        expect(parsedMessage).toEqual(message);
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      });

      parse(data, callback);
    });

    it('should handle Unicode characters in messages', (done) => {
      const message = { 
        jsonrpc: '2.0', 
        method: 'textDocument/publishDiagnostics',
        params: {
          uri: 'file:///test.ets',
          diagnostics: [{
            message: '测试消息 with émojis 🚀',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } }
          }]
        }
      };
      
      const messageJson = JSON.stringify(message);
      const data = Buffer.from(`Content-Length: ${messageJson.length}\r\n\r\n${messageJson}`);
      
      const callback = vi.fn((parsedMessage) => {
        expect(parsedMessage).toEqual(message);
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      });

      parse(data, callback);
    });

    describe('UTF-8 byte length handling', () => {
      it('should correctly parse messages with Chinese characters (multi-byte UTF-8)', (done) => {
        // This test specifically targets the bug where Content-Length (bytes) 
        // was incorrectly treated as character count
        const message = {
          jsonrpc: '2.0',
          method: 'textDocument/didOpen',
          params: {
            textDocument: {
              uri: 'file:///test.ets',
              languageId: 'arkts',
              text: '// 简单的ETS示例 - 基础语法演示\nconst APP_NAME: string = \'ETS应用\';'
            }
          }
        };
        
        const messageJson = JSON.stringify(message);
        // Content-Length must be byte length, not character length
        const byteLength = Buffer.byteLength(messageJson, 'utf8');
        const data = Buffer.from(`Content-Length: ${byteLength}\r\n\r\n${messageJson}`);
        
        const callback = vi.fn((parsedMessage) => {
          expect(parsedMessage).toEqual(message);
          expect(callback).toHaveBeenCalledTimes(1);
          done();
        });

        parse(data, callback);
      });

      it('should handle message where char length != byte length followed by another message', () => {
        // Regression test: multiple messages with Chinese content
        // Previously, the second message header would be incorrectly included in the first
        const message1 = {
          jsonrpc: '2.0',
          method: 'textDocument/didOpen',
          params: {
            textDocument: {
              uri: 'file:///测试文件.ets',
              text: 'const 中文变量 = "测试内容包含多字节字符";'
            }
          }
        };
        const message2 = {
          jsonrpc: '2.0',
          method: 'textDocument/publishDiagnostics',
          params: {
            uri: 'file:///测试文件.ets',
            diagnostics: []
          }
        };
        
        const messageJson1 = JSON.stringify(message1);
        const messageJson2 = JSON.stringify(message2);
        const byteLength1 = Buffer.byteLength(messageJson1, 'utf8');
        const byteLength2 = Buffer.byteLength(messageJson2, 'utf8');
        
        const data = Buffer.from(
          `Content-Length: ${byteLength1}\r\n\r\n${messageJson1}` +
          `Content-Length: ${byteLength2}\r\n\r\n${messageJson2}`
        );
        
        const callback = vi.fn();
        parse(data, callback);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenNthCalledWith(1, message1);
        expect(callback).toHaveBeenNthCalledWith(2, message2);
      });

      it('should correctly calculate byte length for emoji characters', (done) => {
        // Emojis are 4 bytes each in UTF-8
        const message = {
          jsonrpc: '2.0',
          method: 'textDocument/didOpen',
          params: {
            textDocument: {
              uri: 'file:///test.ets',
              text: '🚀🎯💻🎉🎊' // 5 emojis = 20 bytes
            }
          }
        };
        
        const messageJson = JSON.stringify(message);
        const byteLength = Buffer.byteLength(messageJson, 'utf8');
        const data = Buffer.from(`Content-Length: ${byteLength}\r\n\r\n${messageJson}`);
        
        const callback = vi.fn((parsedMessage) => {
          expect(parsedMessage).toEqual(message);
          done();
        });

        parse(data, callback);
      });

      it('should verify byte length differs from char length for non-ASCII', () => {
        // This test documents why the Buffer-based fix was necessary
        const text = '中文测试 🚀 émoji';
        const charLength = text.length;
        const byteLength = Buffer.byteLength(text, 'utf8');
        
        // Verify that byte length > char length for non-ASCII
        expect(byteLength).toBeGreaterThan(charLength);
        
        // Create a message with this text
        const message = { jsonrpc: '2.0', method: 'test', params: { text } };
        const messageJson = JSON.stringify(message);
        const data = Buffer.from(`Content-Length: ${Buffer.byteLength(messageJson, 'utf8')}\r\n\r\n${messageJson}`);
        
        const callback = vi.fn();
        parse(data, callback);
        
        expect(callback).toHaveBeenCalledWith(message);
      });

      it('should handle partial message split at multi-byte character boundary', (done) => {
        // Simulate TCP fragmentation that splits in the middle of a multi-byte character
        const message = {
          jsonrpc: '2.0',
          method: 'test',
          params: { text: '测试中文字符' }
        };
        const messageJson = JSON.stringify(message);
        const byteLength = Buffer.byteLength(messageJson, 'utf8');
        const fullData = Buffer.from(`Content-Length: ${byteLength}\r\n\r\n${messageJson}`);
        
        // Split at a position that cuts through a multi-byte character
        const splitPoint = fullData.indexOf('测试') + 3; // Middle of '测' or '试'
        const part1 = fullData.subarray(0, splitPoint);
        const part2 = fullData.subarray(splitPoint);
        
        const callback = vi.fn((parsedMessage) => {
          expect(parsedMessage).toEqual(message);
          done();
        });

        parse(part1, callback);
        expect(callback).not.toHaveBeenCalled();
        
        parse(part2, callback);
      });
    });
  });

  describe('clearBuffer', () => {
    it('should reset the internal buffer to empty', () => {
      // First add some data to the buffer
      const partialData = Buffer.from('Content-Length: 50\r\n');
      parse(partialData, () => {});
      
      // Clear the buffer
      clearBuffer();
      
      // Try to parse again - should not process any data
      const message = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const messageJson = JSON.stringify(message);
      const completeData = Buffer.from(`\r\n\r\n${messageJson}`);
      const callback = vi.fn();
      
      parse(completeData, callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should allow fresh parsing after clearing buffer', (done) => {
      // Add some incomplete data
      const incompleteData = Buffer.from('Content-Length: 10\r\n');
      parse(incompleteData, () => {});
      
      // Clear buffer
      clearBuffer();
      
      // Now send a complete message
      const message = { jsonrpc: '2.0', method: 'initialize', id: 1 };
      const messageJson = JSON.stringify(message);
      const completeData = Buffer.from(`Content-Length: ${messageJson.length}\r\n\r\n${messageJson}`);
      
      const callback = vi.fn((parsedMessage) => {
        expect(parsedMessage).toEqual(message);
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      });
      
      parse(completeData, callback);
    });
  });
});