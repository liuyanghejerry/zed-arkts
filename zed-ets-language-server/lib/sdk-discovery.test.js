import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listHelperPaths } from './lib-expander.js';
import { resolveHmsSdkPath, resolveOhosSdkPath } from './sdk-discovery.js';

const temporaryDirectories = [];

async function createSdkRoot(directory, relativePath) {
  const sdkRoot = path.join(directory, relativePath);
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

  return sdkRoot;
}

async function createSdkFixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-sdk-'));
  temporaryDirectories.push(directory);
  const sdkRoot = await createSdkRoot(directory, path.join('sdk', 'default', 'openharmony'));
  return { directory, sdkRoot };
}

async function createHmsSdkRoot(ohosSdkRoot) {
  const hmsSdkRoot = path.join(path.dirname(ohosSdkRoot), 'hms');
  await fs.mkdir(path.join(hmsSdkRoot, 'ets', 'api'), { recursive: true });
  await fs.mkdir(path.join(hmsSdkRoot, 'ets', 'kits'), { recursive: true });
  await fs.writeFile(
    path.join(hmsSdkRoot, 'ets', 'kits', '@kit.TestHmsKit.d.ts'),
    'export declare const hmsApi: string;\n',
  );
  return hmsSdkRoot;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('HarmonyOS SDK discovery', () => {
  it('normalizes a DevEco SDK directory to its OpenHarmony root', async () => {
    const { directory, sdkRoot } = await createSdkFixture();

    const result = resolveOhosSdkPath({
      configuredPath: path.join(directory, 'sdk', 'default'),
      env: {},
      candidates: [],
    });

    expect(result).toEqual({ path: sdkRoot, source: 'settings' });
  });

  it('prefers the explicitly configured SDK over environment values', async () => {
    const configured = await createSdkFixture();
    const fromEnvironment = await createSdkFixture();

    const result = resolveOhosSdkPath({
      configuredPath: configured.sdkRoot,
      env: { ZED_ETS_OHOS_SDK_PATH: fromEnvironment.sdkRoot },
      candidates: [],
    });

    expect(result).toEqual({ path: configured.sdkRoot, source: 'settings' });
  });

  it('expands a configured OpenHarmony SDK path relative to the supplied home', async () => {
    const homeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-tilde-ohos-'));
    temporaryDirectories.push(homeDirectory);
    const sdkRoot = await createSdkRoot(
      homeDirectory,
      path.join('HarmonySdk', 'default', 'openharmony'),
    );

    const result = resolveOhosSdkPath({
      configuredPath: '~/HarmonySdk',
      env: {},
      candidates: [],
      homeDirectory,
    });

    expect(result).toEqual({ path: sdkRoot, source: 'settings' });
  });

  it('discovers the SDK bundled with DevEco Studio', async () => {
    const { directory, sdkRoot } = await createSdkFixture();

    const result = resolveOhosSdkPath({
      env: {},
      candidates: [path.join(directory, 'sdk')],
    });

    expect(result).toEqual({ path: sdkRoot, source: 'auto-detected' });
  });

  it.each([
    ['OpenHarmony', path.join('Library', 'OpenHarmony', 'Sdk')],
    ['Huawei', path.join('Library', 'Huawei', 'Sdk')],
  ])('discovers the macOS %s user SDK directory', async (_vendor, sdkDirectory) => {
    const homeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-home-sdk-'));
    temporaryDirectories.push(homeDirectory);
    const sdkRoot = await createSdkRoot(
      homeDirectory,
      path.join(sdkDirectory, 'default', 'openharmony'),
    );

    const result = resolveOhosSdkPath({
      env: {},
      platform: 'darwin',
      homeDirectory,
    });

    expect(result).toEqual({ path: sdkRoot, source: 'auto-detected' });
  });

  it('selects the newest installed version when no default SDK exists', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-versioned-sdk-'));
    temporaryDirectories.push(directory);
    await createSdkRoot(directory, path.join('sdk', '12', 'openharmony'));
    const newestSdk = await createSdkRoot(directory, path.join('sdk', '24', 'openharmony'));

    const result = resolveOhosSdkPath({
      env: {},
      candidates: [path.join(directory, 'sdk')],
    });

    expect(result).toEqual({ path: newestSdk, source: 'auto-detected' });
  });

  it('rejects a path that does not contain ArkTS SDK declarations', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-invalid-sdk-'));
    temporaryDirectories.push(directory);

    expect(() =>
      resolveOhosSdkPath({
        configuredPath: directory,
        env: {},
        candidates: [],
      }),
    ).toThrow(/ets\/kits.*ets-loader\/tsconfig\.json/);
  });

  it('rejects SDK entries with the wrong file types', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-malformed-sdk-'));
    temporaryDirectories.push(directory);
    const sdkRoot = path.join(directory, 'openharmony');
    await fs.mkdir(path.join(sdkRoot, 'ets', 'api'), { recursive: true });
    await fs.writeFile(path.join(sdkRoot, 'ets', 'kits'), 'not a directory\n');
    await fs.mkdir(path.join(sdkRoot, 'ets', 'build-tools', 'ets-loader', 'tsconfig.json'), {
      recursive: true,
    });

    expect(() =>
      resolveOhosSdkPath({ configuredPath: sdkRoot, env: {}, candidates: [] }),
    ).toThrow(/Invalid HarmonyOS SDK path/);
  });

  it.runIf(process.platform !== 'win32')('rejects SDK directories that cannot be traversed', async () => {
    const { sdkRoot } = await createSdkFixture();
    const apiDirectory = path.join(sdkRoot, 'ets', 'api');
    await fs.chmod(apiDirectory, 0o400);

    expect(() =>
      resolveOhosSdkPath({ configuredPath: sdkRoot, env: {}, candidates: [] }),
    ).toThrow(/Invalid HarmonyOS SDK path/);
  });

  it('discovers a sibling HMS SDK and adds it to module resolution paths', async () => {
    const { directory, sdkRoot } = await createSdkFixture();
    const hmsSdkRoot = await createHmsSdkRoot(sdkRoot);
    const tsdk = path.join(directory, 'typescript', 'lib');
    await fs.mkdir(tsdk, { recursive: true });
    await fs.writeFile(path.join(tsdk, 'lib.es5.d.ts'), 'interface Object {}\n');

    const hmsResult = resolveHmsSdkPath({ ohosSdkPath: sdkRoot, env: {} });
    const helperPaths = await listHelperPaths(tsdk, sdkRoot, hmsResult.path);

    expect(hmsResult).toEqual({ path: hmsSdkRoot, source: 'auto-detected' });
    expect(helperPaths.hmsSdkPath).toBe(hmsSdkRoot);
    expect(helperPaths.paths['*']).toContain(path.join(hmsSdkRoot, 'ets', 'kits', '*'));
    expect(helperPaths.paths['*']).toContain(path.join(hmsSdkRoot, 'ets', 'api', '*'));
  });

  it('expands a configured HMS SDK path relative to the supplied home', async () => {
    const homeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-arkts-tilde-hms-'));
    temporaryDirectories.push(homeDirectory);
    const hmsSdkRoot = path.join(homeDirectory, 'HarmonySdk', 'default', 'hms');
    await fs.mkdir(path.join(hmsSdkRoot, 'ets', 'api'), { recursive: true });
    await fs.mkdir(path.join(hmsSdkRoot, 'ets', 'kits'), { recursive: true });

    const result = resolveHmsSdkPath({
      configuredPath: '~/HarmonySdk/default/hms',
      env: {},
      homeDirectory,
    });

    expect(result).toEqual({ path: hmsSdkRoot, source: 'settings' });
  });

  it('resolves OpenHarmony and HMS kit modules through the generated paths', async () => {
    const typescriptModule = await import('ohos-typescript');
    const ts = typescriptModule.default ?? typescriptModule;
    const { directory, sdkRoot } = await createSdkFixture();
    const hmsSdkRoot = await createHmsSdkRoot(sdkRoot);
    const helperPaths = await listHelperPaths(
      path.join(process.cwd(), 'node_modules', 'ohos-typescript', 'lib'),
      sdkRoot,
      hmsSdkRoot,
    );
    const compilerOptions = {
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      baseUrl: helperPaths.baseUrl,
      paths: helperPaths.paths,
    };
    const containingFile = path.join(directory, 'entry', 'src', 'main', 'ets', 'Probe.ets');

    const abilityKit = ts.resolveModuleName(
      '@kit.AbilityKit',
      containingFile,
      compilerOptions,
      ts.sys,
    ).resolvedModule;
    const hmsKit = ts.resolveModuleName(
      '@kit.TestHmsKit',
      containingFile,
      compilerOptions,
      ts.sys,
    ).resolvedModule;

    expect(abilityKit?.resolvedFileName).toBe(
      path.join(sdkRoot, 'ets', 'kits', '@kit.AbilityKit.d.ts'),
    );
    expect(hmsKit?.resolvedFileName).toBe(
      path.join(hmsSdkRoot, 'ets', 'kits', '@kit.TestHmsKit.d.ts'),
    );
  });
});
