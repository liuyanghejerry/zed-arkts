import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
let fixtureDirectory;
let sdkRoot;
let hmsSdkRoot;
let serverProcess;
let stdoutBuffer = Buffer.alloc(0);
const responses = [];

function encodeLspMessage(message) {
  const body = Buffer.from(JSON.stringify(message));
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),
    body,
  ]);
}

function collectLspMessages(chunk) {
  stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);

  while (true) {
    const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const header = stdoutBuffer.subarray(0, headerEnd).toString('ascii');
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) return;

    const bodyStart = headerEnd + 4;
    const bodyLength = Number(lengthMatch[1]);
    if (stdoutBuffer.length < bodyStart + bodyLength) return;

    const body = stdoutBuffer.subarray(bodyStart, bodyStart + bodyLength);
    responses.push(JSON.parse(body.toString('utf8')));
    stdoutBuffer = stdoutBuffer.subarray(bodyStart + bodyLength);
  }
}

async function waitForResponse(predicate, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const response = responses.find(predicate);
    if (response) return response;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for LSP response');
}

beforeAll(async () => {
  fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-deveco-'));
  sdkRoot = path.join(fixtureDirectory, 'Contents', 'sdk', 'default', 'openharmony');
  await fs.mkdir(path.join(sdkRoot, 'ets', 'api'), { recursive: true });
  await fs.mkdir(path.join(sdkRoot, 'ets', 'kits'), { recursive: true });
  await fs.mkdir(path.join(sdkRoot, 'ets', 'component'), { recursive: true });
  await fs.mkdir(path.join(sdkRoot, 'ets', 'build-tools', 'ets-loader', 'declarations'), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(sdkRoot, 'ets', 'build-tools', 'ets-loader', 'tsconfig.json'),
    '{}\n',
  );
  await fs.writeFile(
    path.join(sdkRoot, 'ets', 'kits', '@kit.AbilityKit.d.ts'),
    'export declare class UIAbility {}\n',
  );
  hmsSdkRoot = path.join(fixtureDirectory, 'Contents', 'sdk', 'default', 'hms');
  await fs.mkdir(path.join(hmsSdkRoot, 'ets', 'api'), { recursive: true });
  await fs.mkdir(path.join(hmsSdkRoot, 'ets', 'kits'), { recursive: true });
  await fs.writeFile(
    path.join(hmsSdkRoot, 'ets', 'kits', '@kit.TestHmsKit.d.ts'),
    'export declare const hmsApi: string;\n',
  );
  const placeholderSiblingHms = path.join(fixtureDirectory, 'hms');
  await fs.mkdir(path.join(placeholderSiblingHms, 'ets', 'api'), { recursive: true });
  await fs.mkdir(path.join(placeholderSiblingHms, 'ets', 'kits'), { recursive: true });

  const wrapperPath = path.join(testDirectory, '..', '..', 'index.js');
  const mockServerPath = path.join(testDirectory, '..', 'mocks', 'mock-ets-server.js');
  const tsdk = path.join(testDirectory, '..', '..', 'node_modules', 'ohos-typescript', 'lib');
  const env = { ...process.env };
  delete env.ZED_ETS_OHOS_SDK_PATH;
  delete env.OHOS_SDK_PATH;
  delete env.HARMONYOS_SDK_HOME;
  delete env.OPENHARMONY_SDK_HOME;
  delete env.DEVECO_SDK_HOME;
  delete env.ZED_ETS_HMS_SDK_PATH;
  delete env.HMS_SDK_PATH;
  Object.assign(env, {
    ETS_LANG_SERVER: mockServerPath,
    ZED_ETS_TSDK: tsdk,
    DEVECO_STUDIO_HOME: fixtureDirectory,
    TMPDIR: fixtureDirectory,
  });

  serverProcess = spawn(process.execPath, [wrapperPath], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', collectLspMessages);
});

afterAll(async () => {
  serverProcess?.kill();
  await fs.rm(fixtureDirectory, { recursive: true, force: true });
});

describe('SDK initialization', () => {
  it('injects the DevEco OpenHarmony SDK into ArkTS initialization', async () => {
    serverProcess.stdin.write(
      encodeLspMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          processId: process.pid,
          rootUri: 'file:///tmp/harmony-project',
          capabilities: {},
          initializationOptions: {},
        },
      }),
    );

    const response = await waitForResponse((message) => message.id === 1);
    const initializationOptions = response.result.receivedInitializationOptions;

    expect(initializationOptions.ohos.sdkPath).toBe(sdkRoot);
    expect(initializationOptions.ets.sdkPath).toBe(sdkRoot);
    expect(initializationOptions.ohos.baseUrl).toBe(path.join(sdkRoot, 'ets'));
    expect(initializationOptions.ets.hmsPath).toBe(hmsSdkRoot);
    expect(initializationOptions.ohos.hmsSdkPath).toBe(hmsSdkRoot);
    expect(initializationOptions.ohos.paths['*']).toContain(
      path.join(hmsSdkRoot, 'ets', 'kits', '*'),
    );
  });

  it('does not infer an HMS SDK from the placeholder OpenHarmony SDK', async () => {
    serverProcess.stdin.write(
      encodeLspMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          processId: process.pid,
          rootUri: 'file:///tmp/harmony-project',
          capabilities: {},
          initializationOptions: {
            ohosSdkPath: path.join(fixtureDirectory, 'invalid-openharmony'),
          },
        },
      }),
    );

    const response = await waitForResponse((message) => message.id === 2);
    const initializationOptions = response.result.receivedInitializationOptions;

    expect(initializationOptions.ets.sdkPath).toBe(
      path.join(fixtureDirectory, 'zed-ets-empty-ohos-sdk'),
    );
    expect(initializationOptions.ets.hmsPath).toBeUndefined();
  });
});
