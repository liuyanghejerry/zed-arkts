#!/usr/bin/env node

/**
 * Mock ETS Language Server for testing
 * This simulates the behavior of the actual ETS language server
 * for formatting requests.
 */

process.on('message', (message) => {
  // Handle ets/formatDocument requests
  if (message.method === 'ets/formatDocument') {
    // Simulate formatting response with TextEdit array
    const response = {
      jsonrpc: message.jsonrpc,
      id: message.id,
      result: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
          },
          newText: '// Formatted by mock ETS server\n'
        }
      ]
    };
    
    process.send(response);
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
