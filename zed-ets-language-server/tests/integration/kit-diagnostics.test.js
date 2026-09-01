import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
let fixtureDirectory;
let projectDirectory;
let sourcePath;
let serverProcess;
let languageServerVersion;
let stdoutBuffer = Buffer.alloc(0);
const messages = [];
const waiters = [];

function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  serverProcess.stdin.write(
    Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]),
  );
}

function dispatch(message) {
  messages.push(message);

  if (message.method && message.id !== undefined) {
    let result = null;
    if (message.method === 'workspace/configuration') {
      result = (message.params?.items ?? []).map(() => null);
    } else if (message.method === 'workspace/workspaceFolders') {
      result = [{ uri: pathToFileURL(projectDirectory).href, name: 'project' }];
    }
    send({ jsonrpc: '2.0', id: message.id, result });
  }

  for (let index = waiters.length - 1; index >= 0; index -= 1) {
    if (!waiters[index].predicate(message)) continue;
    const [waiter] = waiters.splice(index, 1);
    clearTimeout(waiter.timer);
    waiter.resolve(message);
  }
}

function collectMessages(chunk) {
  stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
  while (true) {
    const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;
    const header = stdoutBuffer.subarray(0, headerEnd).toString('ascii');
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) throw new Error('LSP response is missing Content-Length');
    const bodyLength = Number(lengthMatch[1]);
    const bodyStart = headerEnd + 4;
    if (stdoutBuffer.length < bodyStart + bodyLength) return;
    const body = stdoutBuffer.subarray(bodyStart, bodyStart + bodyLength);
    stdoutBuffer = stdoutBuffer.subarray(bodyStart + bodyLength);
    dispatch(JSON.parse(body.toString('utf8')));
  }
}

function waitForMessage(predicate, timeout = 30000) {
  const existing = messages.find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for LSP message')), timeout);
    waiters.push({ predicate, resolve, timer });
  });
}

beforeAll(async () => {
  fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-real-lsp-'));
  projectDirectory = path.join(fixtureDirectory, 'project');
  const sdkDirectory = path.join(fixtureDirectory, 'studio', 'Contents', 'sdk', 'default');
  const ohosSdk = path.join(sdkDirectory, 'openharmony');
  const hmsSdk = path.join(sdkDirectory, 'hms');
  sourcePath = path.join(projectDirectory, 'entry', 'src', 'main', 'ets', 'Probe.ets');

  await Promise.all([
    fs.mkdir(path.dirname(sourcePath), { recursive: true }),
    fs.mkdir(path.join(ohosSdk, 'ets', 'api'), { recursive: true }),
    fs.mkdir(path.join(ohosSdk, 'ets', 'kits'), { recursive: true }),
    fs.mkdir(path.join(ohosSdk, 'ets', 'component'), { recursive: true }),
    fs.mkdir(path.join(ohosSdk, 'ets', 'build-tools', 'ets-loader', 'declarations'), {
      recursive: true,
    }),
    fs.mkdir(path.join(hmsSdk, 'ets', 'api'), { recursive: true }),
    fs.mkdir(path.join(hmsSdk, 'ets', 'kits'), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(ohosSdk, 'ets', 'build-tools', 'ets-loader', 'tsconfig.json'), '{}\n'),
    fs.writeFile(
      path.join(ohosSdk, 'ets', 'kits', '@kit.AbilityKit.d.ts'),
      'export declare class UIAbility {}\n',
    ),
    fs.writeFile(
      path.join(hmsSdk, 'ets', 'kits', '@kit.TestHmsKit.d.ts'),
      'export declare const hmsApi: string;\n',
    ),
    fs.writeFile(
      path.join(projectDirectory, 'build-profile.json5'),
      '{ app: { products: [{ name: "default" }] }, modules: [{ name: "entry", srcPath: "./entry" }] }\n',
    ),
    fs.writeFile(
      path.join(projectDirectory, 'oh-package.json5'),
      '{ name: "probe", version: "1.0.0" }\n',
    ),
    fs.writeFile(
      path.join(projectDirectory, 'entry', 'build-profile.json5'),
      '{ apiType: "stageMode", buildOption: {} }\n',
    ),
    fs.writeFile(
      sourcePath,
      "import { UIAbility } from '@kit.AbilityKit';\n" +
        "import { hmsApi } from '@kit.TestHmsKit';\n" +
        "import { missingApi } from '@kit.DoesNotExist';\n" +
        'export const probe: UIAbility | string = hmsApi;\n' +
        'export const missingProbe = missingApi;\n',
    ),
  ]);

  const wrapperPath = path.join(testDirectory, '..', '..', 'index.js');
  const languageServerPath = path.join(
    testDirectory,
    '..',
    '..',
    'node_modules',
    '@arkts',
    'language-server',
    'bin',
    'ets-language-server.js',
  );
  const languageServerPackage = JSON.parse(
    await fs.readFile(
      path.join(testDirectory, '..', '..', 'node_modules', '@arkts', 'language-server', 'package.json'),
      'utf8',
    ),
  );
  languageServerVersion = languageServerPackage.version;
  const env = { ...process.env };
  for (const variableName of [
    'ZED_ETS_OHOS_SDK_PATH',
    'OHOS_SDK_PATH',
    'HARMONYOS_SDK_HOME',
    'OPENHARMONY_SDK_HOME',
    'DEVECO_SDK_HOME',
    'ZED_ETS_HMS_SDK_PATH',
    'HMS_SDK_PATH',
    'ZED_ETS_TSDK',
    'TSDK',
  ]) {
    delete env[variableName];
  }
  Object.assign(env, {
    ETS_LANG_SERVER: languageServerPath,
    DEVECO_STUDIO_HOME: path.join(fixtureDirectory, 'studio'),
  });
  serverProcess = spawn(process.execPath, [wrapperPath], {
    cwd: projectDirectory,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', collectMessages);
});

afterAll(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    await new Promise((resolve) => {
      const timeout = setTimeout(() => serverProcess.kill('SIGKILL'), 5000);
      serverProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      serverProcess.kill();
    });
  }
  await fs.rm(fixtureDirectory, { recursive: true, force: true });
});

describe('real ArkTS language server Kit diagnostics', () => {
  it('resolves OpenHarmony and HMS Kit modules with language server 1.3.x', async () => {
    expect(languageServerVersion).toMatch(/^1\.3\./);
    const rootUri = pathToFileURL(projectDirectory).href;
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: process.pid,
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: 'project' }],
        capabilities: {
          workspace: { configuration: true, workspaceFolders: true },
          textDocument: { publishDiagnostics: {} },
        },
        initializationOptions: {},
      },
    });
    const initializeResponse = await waitForMessage((message) => message.id === 1);
    expect(initializeResponse.error).toBeUndefined();
    send({ jsonrpc: '2.0', method: 'initialized', params: {} });

    const uri = pathToFileURL(sourcePath).href;
    send({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri,
          languageId: 'ets',
          version: 1,
          text: await fs.readFile(sourcePath, 'utf8'),
        },
      },
    });
    const diagnostics = await waitForMessage(
      (message) =>
        message.method === 'textDocument/publishDiagnostics' &&
        message.params.uri === uri &&
        message.params.diagnostics.some((diagnostic) => Number(diagnostic.code) === 2307),
    );

    const unresolvedModules = diagnostics.params.diagnostics.filter(
      (diagnostic) => Number(diagnostic.code) === 2307,
    );
    expect(unresolvedModules).toHaveLength(1);
    expect(unresolvedModules[0].message).toContain('@kit.DoesNotExist');
    expect(unresolvedModules[0].message).not.toContain('@kit.AbilityKit');
    expect(unresolvedModules[0].message).not.toContain('@kit.TestHmsKit');
  }, 40000);
});
