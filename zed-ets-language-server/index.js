#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logger } from './lib/logger.js';
import { parse } from './lib/data-parser.js';
import { listHelperPaths } from './lib/lib-expander.js'

// ETS language server path, passed by Rust extension process through environment variable
const etsLangServerPath = process.env.ETS_LANG_SERVER;

// The extension installs ohos-typescript next to @arkts/language-server, so a
// usable tsdk can be derived from the server path when settings don't name one:
// <work dir>/node_modules/@arkts/language-server/bin/ets-language-server.js
// <work dir>/node_modules/ohos-typescript/lib
// @arkts/language-server v1.3+ refuses to initialize unless ets.sdkPath points at
// a directory containing ets/build-tools/ets-loader/tsconfig.json (v1.2 accepted
// any value). Provide a minimal skeleton so the server starts without a real SDK;
// ArkUI typings degrade but TypeScript-level features keep working.
function ensurePlaceholderSdk() {
  const sdkDir = path.join(os.tmpdir(), 'zed-ets-empty-ohos-sdk');
  const etsLoaderDir = path.join(sdkDir, 'ets', 'build-tools', 'ets-loader');
  try {
    fs.mkdirSync(path.join(etsLoaderDir, 'declarations'), { recursive: true });
    fs.mkdirSync(path.join(sdkDir, 'ets', 'component'), { recursive: true });
    const tsconfigPath = path.join(etsLoaderDir, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      fs.writeFileSync(tsconfigPath, '{}\n');
    }
  } catch (error) {
    logger.error(`Failed to prepare placeholder SDK dir ${sdkDir}: ${error.message}`);
  }
  return sdkDir;
}

function detectTsdk() {
  if (!etsLangServerPath) return undefined;
  // The extension installs ohos-typescript next to @arkts/language-server:
  // <work dir>/node_modules/ohos-typescript/lib
  // <work dir>/node_modules/@arkts/language-server/bin/ets-language-server.js
  // Walk the ancestors of the server path and accept either layout so the
  // detection also works for servers installed at other depths.
  let dir = path.dirname(path.resolve(etsLangServerPath));
  for (let depth = 0; depth < 8; depth++) {
    for (const candidate of [
      path.join(dir, 'ohos-typescript', 'lib'),
      path.join(dir, 'node_modules', 'ohos-typescript', 'lib'),
    ]) {
      if (fs.existsSync(path.join(candidate, 'typescript.js'))) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

// A usable tsdk must contain lib/typescript.js. The native TypeScript 7 line
// ships no compiler API there, and settings inherited from another machine may
// point at a half-installed directory; forwarding such a tsdk makes the server
// hang inside `initialize` without ever answering.
function isValidTsdk(dir) {
  return Boolean(dir) && fs.existsSync(path.join(dir, 'typescript.js'));
}

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

  // Requests injected by this wrapper (not sent by the editor); their responses
  // must not be forwarded to the editor, which never issued them.
  const wrapperRequestIds = new Set();

  // Set up forwarding of serverProcess IPC messages to process.stdout
  serverProcess.on('message', (message) => {
    if (message?.id !== undefined && wrapperRequestIds.delete(message.id)) {
      logger.info(`Swallowed response to wrapper-injected request ${message.id}: ${JSON.stringify(message.result ?? message.error)}`);
      return;
    }
    // Convert IPC message to standard LSP format and send to stdout
    const messageStr = JSON.stringify(message);
    const headers = `Content-Length: ${Buffer.byteLength(messageStr)}\r\n\r\n`;
    process.stdout.write(headers + messageStr);
  });

  // Set up forwarding of process.stdin to serverProcess IPC.
  // No setEncoding here: the parser needs raw bytes because LSP Content-Length
  // counts bytes, not characters.
  process.stdin.on('data', (data) => parse(data, async (message) => {
    // This special ets request is required in document: https://github.com/ohosvscode/arkTS/tree/next/packages/language-server
    // When this goes wrong, ETS UI decorators and functions will be type of any
    if (message.method === 'initialize') {
      message.params = message.params ?? {};
      const initializationOptions = message.params.initializationOptions ?? {};
      message.params.initializationOptions = initializationOptions;

      // Zed only passes initializationOptions when the user configured
      // lsp.arkts-language-server.initialization_options in settings. Fall back to
      // env vars, then auto-detection, so the server starts out of the box.
      if (!initializationOptions.tsdk) {
        initializationOptions.tsdk = process.env.ZED_ETS_TSDK || process.env.TSDK || detectTsdk();
        logger.info(`No tsdk in initializationOptions; falling back to: ${initializationOptions.tsdk}`);
      }

      // A tsdk without lib/typescript.js (native TypeScript 7, stale settings)
      // hangs the server inside initialize. Substitute the ohos-typescript
      // installed next to the language server instead of forwarding it.
      if (!isValidTsdk(initializationOptions.tsdk)) {
        const fallbackTsdk = detectTsdk();
        if (fallbackTsdk) {
          logger.error(`tsdk ${initializationOptions.tsdk} has no lib/typescript.js; falling back to ${fallbackTsdk}`);
          initializationOptions.tsdk = fallbackTsdk;
        }
      }
      if (!initializationOptions.ohosSdkPath) {
        initializationOptions.ohosSdkPath = process.env.ZED_ETS_OHOS_SDK_PATH || process.env.OHOS_SDK_PATH;
      }

      // The server cannot finish `initialize` without a tsdk (it fails loading
      // TypeScript and Zed reports "Failed to start language server").
      if (!initializationOptions.tsdk) {
        logger.error(`No tsdk in LSP settings, env (ZED_ETS_TSDK/TSDK), or next to ${etsLangServerPath}; forwarding initialize as-is, the server will likely fail to start.`);
        serverProcess.send(message);
        return;
      }

      if (!initializationOptions.ohosSdkPath) {
        initializationOptions.ohosSdkPath = ensurePlaceholderSdk();
        logger.error('No ohosSdkPath in LSP settings or env (ZED_ETS_OHOS_SDK_PATH/OHOS_SDK_PATH); using a placeholder SDK skeleton, ArkUI SDK types will be unavailable until lsp.arkts-language-server.initialization_options.ohosSdkPath is set in Zed settings.');
      }

      const ohos = await listHelperPaths(initializationOptions.tsdk, initializationOptions.ohosSdkPath);

      // Send both `ohos` and `ets` keys to stay compatible with
      // @arkts/language-server v1.2.x (uses `ohos`) and v1.3.x+ (uses `ets`).
      const etsSpecialRequest = {
        jsonrpc: '2.0',
        id: `zed-ets-wrapper-${Date.now()}`,
        method: 'ets/waitForEtsConfigurationChangedRequested',
        params: {
          typescript: {
            tsdk: initializationOptions.tsdk,
          },
          ohos: ohos,
          ets: ohos,
        },
      };

      const generalInitRequest = message;
      generalInitRequest.params.initializationOptions.typescript = {
        tsdk: initializationOptions.tsdk,
      };
      generalInitRequest.params.initializationOptions.ohos = ohos;
      generalInitRequest.params.initializationOptions.ets = ohos;
      
      logger.info(JSON.stringify(generalInitRequest));
      logger.info(JSON.stringify(etsSpecialRequest));

      wrapperRequestIds.add(etsSpecialRequest.id);
      serverProcess.send(generalInitRequest);
      serverProcess.send(etsSpecialRequest);
      return;
    }

    // Forward standard formatting requests to custom ets/formatDocument
    if (message.method === 'textDocument/formatting') {
      const etsFormatRequest = {
        jsonrpc: message.jsonrpc,
        id: message.id,
        method: 'ets/formatDocument',
        params: {
          textDocument: message.params.textDocument,
          options: message.params.options,
        },
      };
      
      logger.info(`Forwarding formatting request to ets/formatDocument: ${JSON.stringify(etsFormatRequest)}`);
      serverProcess.send(etsFormatRequest);
      return;
    }

    // Forward range formatting requests to custom ets/formatDocument
    // Note: ets/formatDocument doesn't support range formatting explicitly,
    // so we forward it as a full document format request
    if (message.method === 'textDocument/rangeFormatting') {
      const etsFormatRequest = {
        jsonrpc: message.jsonrpc,
        id: message.id,
        method: 'ets/formatDocument',
        params: {
          textDocument: message.params.textDocument,
          options: message.params.options,
        },
      };
      
      logger.info(`Forwarding range formatting request to ets/formatDocument: ${JSON.stringify(etsFormatRequest)}`);
      serverProcess.send(etsFormatRequest);
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
