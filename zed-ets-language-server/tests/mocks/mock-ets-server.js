#!/usr/bin/env node

/**
 * Mock ETS Language Server for testing
 * This simulates the behavior of the actual ETS language server
 * for formatting requests.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test fixtures
const fixturesDir = join(__dirname, '../fixtures');

process.on('message', (message) => {
  // Handle ets/formatDocument requests
  if (message.method === 'ets/formatDocument') {
    const uri = message.params.textDocument.uri;
    
    // Simulate realistic formatting by returning TextEdit that formats the content
    // For testing, we'll simulate formatting unformatted.ets to formatted.ets
    let formattedContent;
    
    try {
      // In a real scenario, the server would format based on the actual file content
      // For testing, we return a predefined formatted version
      if (uri.includes('unformatted')) {
        formattedContent = readFileSync(join(fixturesDir, 'formatted.ets'), 'utf8');
      } else {
        // For other files, simulate basic formatting
        formattedContent = `// Formatted by mock ETS server
@Entry
@Component
struct Test {
  @State value: string = 'test'
  
  build() {
    Column() {
      Text(this.value)
    }
  }
}
`;
      }
      
      // Count lines in the formatted content to calculate proper end position
      const lines = formattedContent.split('\n');
      const lastLineIndex = lines.length - 1;
      const lastLineLength = lines[lastLineIndex].length;
      
      const response = {
        jsonrpc: message.jsonrpc,
        id: message.id,
        result: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: lastLineIndex, character: lastLineLength }
            },
            newText: formattedContent
          }
        ]
      };
      
      process.send(response);
    } catch (error) {
      // Return error response if something goes wrong
      const errorResponse = {
        jsonrpc: message.jsonrpc,
        id: message.id,
        error: {
          code: -32603,
          message: `Formatting error: ${error.message}`
        }
      };
      process.send(errorResponse);
    }
  }
  
  // Handle initialize request
  else if (message.method === 'initialize') {
    const response = {
      jsonrpc: message.jsonrpc,
      id: message.id,
      result: {
        capabilities: {
          textDocumentSync: 1,
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true
        }
      }
    };
    
    process.send(response);
  }
  
  // Handle shutdown request
  else if (message.method === 'shutdown') {
    const response = {
      jsonrpc: message.jsonrpc,
      id: message.id,
      result: null
    };
    
    process.send(response);
  }
  
  // Handle exit notification
  else if (message.method === 'exit') {
    process.exit(0);
  }
});

// Keep the process alive
process.stdin.resume();
