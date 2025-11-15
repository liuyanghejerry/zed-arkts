#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { logger } from './lib/logger.js';
import { parse } from './lib/data-parser.js';
import { listHelperPaths } from './lib/lib-expander.js'

// ETS language server path, passed by Rust extension process through environment variable
const etsLangServerPath = process.env.ETS_LANG_SERVER;

async function main() {
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
  process.stdin.on('data', (data) => parse(data, async (message) => {
    // This special ets request is required in document: https://github.com/ohosvscode/arkTS/tree/next/packages/language-server
    // When this goes wrong, ETS UI decorators and functions will be type of any
    if (message.method === 'initialize') {
      const { initializationOptions } = message.params;

      const ohos = await listHelperPaths(initializationOptions.tsdk, initializationOptions.ohosSdkPath);

      const etsSpecialRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'ets/waitForEtsConfigurationChangedRequested',
        params: {
          typescript: {
            tsdk: initializationOptions.tsdk,
          },
          ohos: ohos,
          // typescript: initializationOptions.typescript,
          // ohos: initializationOptions.ohos,
          // debug: initializationOptions.debug,
        },
      };
      // const generalInitRequest = {
      //   ...message,
      //   params: {
      //     ...message.params,
      //     initializationOptions: {
      //       ...message.params.initializationOptions,
      //       typescript: {
      //         tsdk: initializationOptions.tsdk,
      //       },
      //       ohos: ohos,
      //     },
      //   },
      // };
      const generalInitRequest = message;
      generalInitRequest.params.initializationOptions.typescript = {
        tsdk: initializationOptions.tsdk,
      };
      generalInitRequest.params.initializationOptions.ohos = ohos;
      
      logger.info(JSON.stringify(generalInitRequest));
      logger.info(JSON.stringify(etsSpecialRequest));
      
      serverProcess.send(generalInitRequest);
      serverProcess.send(etsSpecialRequest);
      return;
    }
    // Send message to language server via IPC
    serverProcess.send(message);
  }));

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
