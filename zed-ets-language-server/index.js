#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ETS language server path, passed by Rust extension process through environment variable
const etsLangServerPath = process.env.ETS_LANG_SERVER;

function createSimpleLogger() {
  if (process.env.ZED_ETS_LANG_SERVER_LOG !== 'true') {
    const noop = (_msg) => {};
    return {
      info: noop,
      success: noop,
      error: noop,
      warn: noop,
      section: noop,
      data: noop,
      close: noop,
    };
  }
  // Create log file write stream
  const logFilePath = path.join(__dirname, 'arkts-lsw.log');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'w+' });

  // Function to get current timestamp
  const getTimestamp = () => {
    const now = new Date();
    return now.toISOString().slice(0, 19).replace('T', ' ');
  };

  // Logging utility
  const logger = {
    info: (msg) => {
      const timestamp = getTimestamp();
      const logMsg = `[${timestamp}] ℹ ${msg}\n`;
      logStream.write(logMsg);
    },
    success: (msg) => {
      const timestamp = getTimestamp();
      const logMsg = `[${timestamp}] ✓ ${msg}\n`;
      logStream.write(logMsg);
    },
    error: (msg) => {
      const timestamp = getTimestamp();
      const logMsg = `[${timestamp}] ✗ ${msg}\n`;
      logStream.write(logMsg);
      process.stderr.write(logMsg);
    },
    warn: (msg) => {
      const timestamp = getTimestamp();
      const logMsg = `[${timestamp}] ⚠ ${msg}\n`;
      logStream.write(logMsg);
    },
    section: (msg) => {
      const timestamp = getTimestamp();
      const logMsg = `\n[${timestamp}] ${msg}\n\n`;
      logStream.write(logMsg);
    },
    data: (label, data) => {
      const timestamp = getTimestamp();
      const logMsg = `[${timestamp}]   ${label}: ${JSON.stringify(data, null, 2)}\n`;
      logStream.write(logMsg);
    },
    // Add method to close log stream
    close: () => {
      logStream.end();
    },
  };

  return logger;
}

async function main() {
  const logger = createSimpleLogger();
  logger.section('🚀 ETS Language Server Wrapper');

  // Check if language server exists
  const serverExists = fs.existsSync(etsLangServerPath);

  if (!serverExists) {
    logger.error(`Language server does not exist, please build the language server first ${etsLangServerPath}`);
    return;
  }

  logger.success(`Language server path: ${etsLangServerPath}`);

  // Start language server
  logger.section('🔌 Starting Language Server');

  const serverProcess = spawn('node', [etsLangServerPath, '--node-ipc', '--server-mode'], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env },
  });

  // Listen to server process error and exit events
  serverProcess.on('error', (error) => {
    logger.error(`Language server process error: ${error.message}`);
  });

  serverProcess.on('exit', (code, signal) => {
    logger.info(`Language server process exited, exit code: ${code}, signal: ${signal}`);
  });

  // Set up forwarding of serverProcess IPC messages to process.stdout
  serverProcess.on('message', (message) => {
    // Convert IPC message to standard LSP format and send to stdout
    const messageStr = JSON.stringify(message);
    const headers = `Content-Length: ${Buffer.byteLength(messageStr)}\r\n\r\n`;
    process.stdout.write(headers + messageStr);
  });

  // Set up forwarding of process.stdin to serverProcess IPC
  let stdinBuffer = '';
  process.stdin.on('data', (data) => {
    stdinBuffer += data.toString();

    while (true) {
      // Find Content-Length header
      const lengthMatch = stdinBuffer.match(/Content-Length: (\d+)\r\n/);
      if (!lengthMatch) break;

      const contentLength = Number.parseInt(lengthMatch[1]);
      const headerEnd = stdinBuffer.indexOf('\r\n\r\n');

      if (headerEnd === -1) break;

      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (stdinBuffer.length < messageEnd) break;

      // Extract message
      const messageJson = stdinBuffer.substring(messageStart, messageEnd);
      stdinBuffer = stdinBuffer.substring(messageEnd);

      try {
        const message = JSON.parse(messageJson);
        // Send message to language server via IPC
        serverProcess.send(message);
      } catch (error) {
        logger.error(`Failed to parse message from stdin: ${error.message}, ${messageJson}`);
      }
    }
  });

  // Error handling
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal, shutting down language server...');
    serverProcess.kill();
    logger.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('Received SIGINT signal, shutting down language server...');
    serverProcess.kill();
    logger.close();
    process.exit(0);
  });

  logger.success('Language server wrapper started, beginning message forwarding');
}

// Error handling
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  console.error(error);
  logger.close(); // Close log stream
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error(`Unhandled Promise rejection: ${reason}`);
  console.error(reason);
  logger.close(); // Close log stream
  process.exit(1);
});

// Run main function
main();
