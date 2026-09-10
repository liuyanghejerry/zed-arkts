import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENVIRONMENT_VARIABLES = [
  'ZED_ETS_OHOS_SDK_PATH',
  'OHOS_SDK_PATH',
  'HARMONYOS_SDK_HOME',
  'OPENHARMONY_SDK_HOME',
  'DEVECO_SDK_HOME',
];

const REQUIRED_SDK_ENTRIES = [
  { relativePath: path.join('ets', 'kits'), type: 'directory' },
  { relativePath: path.join('ets', 'api'), type: 'directory' },
  {
    relativePath: path.join('ets', 'build-tools', 'ets-loader', 'tsconfig.json'),
    type: 'file',
  },
];

const REQUIRED_HMS_ENTRIES = [
  { relativePath: path.join('ets', 'kits'), type: 'directory' },
  { relativePath: path.join('ets', 'api'), type: 'directory' },
];

function hasRequiredEntries(candidate, entries) {
  try {
    return entries.every(({ relativePath, type }) => {
      const entryPath = path.join(candidate, relativePath);
      const stats = fs.statSync(entryPath);
      const accessMode = type === 'directory'
        ? fs.constants.R_OK | fs.constants.X_OK
        : fs.constants.R_OK;
      fs.accessSync(entryPath, accessMode);
      return type === 'directory' ? stats.isDirectory() : stats.isFile();
    });
  } catch {
    return false;
  }
}

function isValidOhosSdkPath(candidate) {
  return hasRequiredEntries(candidate, REQUIRED_SDK_ENTRIES);
}

function isValidHmsSdkPath(candidate) {
  return hasRequiredEntries(candidate, REQUIRED_HMS_ENTRIES);
}

function expandHome(candidate, homeDirectory) {
  return candidate.startsWith('~/')
    ? path.join(homeDirectory, candidate.slice(2))
    : candidate;
}

function normalizeCandidate(candidate, homeDirectory = os.homedir()) {
  if (!candidate) return undefined;

  const expanded = expandHome(candidate, homeDirectory);
  const normalized = path.resolve(expanded);
  const possibleRoots = [
    normalized,
    path.join(normalized, 'openharmony'),
    path.join(normalized, 'default', 'openharmony'),
  ];

  try {
    const versionDirectories = fs
      .readdirSync(normalized, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'default')
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    for (const versionDirectory of versionDirectories) {
      possibleRoots.push(path.join(normalized, versionDirectory, 'openharmony'));
      possibleRoots.push(path.join(normalized, versionDirectory));
    }
  } catch {
    // Missing or unreadable candidates are ignored during discovery.
  }

  return possibleRoots.find(isValidOhosSdkPath);
}

function defaultCandidates(platform, homeDirectory, env) {
  const candidates = [];
  const studioHome = env.DEVECO_STUDIO_HOME || env.DEVECO_HOME;
  if (studioHome) {
    candidates.push(path.join(studioHome, 'sdk'));
    candidates.push(path.join(studioHome, 'Contents', 'sdk'));
  }

  if (platform === 'darwin') {
    candidates.push(path.join(homeDirectory, 'Library', 'OpenHarmony', 'Sdk'));
    candidates.push(path.join(homeDirectory, 'Library', 'Huawei', 'Sdk'));
    candidates.push('/Applications/DevEco-Studio.app/Contents/sdk');
    candidates.push(path.join(homeDirectory, 'Applications', 'DevEco-Studio.app', 'Contents', 'sdk'));
  } else if (platform === 'win32') {
    if (env.ProgramFiles) {
      candidates.push(path.join(env.ProgramFiles, 'Huawei', 'DevEco Studio', 'sdk'));
    }
    if (env.LOCALAPPDATA) {
      candidates.push(path.join(env.LOCALAPPDATA, 'Huawei', 'DevEcoStudio', 'sdk'));
    }
  } else {
    candidates.push('/opt/DevEco-Studio/sdk');
    candidates.push(path.join(homeDirectory, 'DevEco-Studio', 'sdk'));
  }

  return candidates;
}

export function resolveOhosSdkPath({
  configuredPath,
  env = process.env,
  platform = process.platform,
  homeDirectory = os.homedir(),
  candidates,
} = {}) {
  if (configuredPath) {
    const resolved = normalizeCandidate(configuredPath, homeDirectory);
    if (!resolved) {
      throw new Error(
        `Invalid HarmonyOS SDK path: ${configuredPath}. Expected ets/kits, ets/api, and ets/build-tools/ets-loader/tsconfig.json.`,
      );
    }
    return { path: resolved, source: 'settings' };
  }

  for (const variableName of ENVIRONMENT_VARIABLES) {
    const resolved = normalizeCandidate(env[variableName], homeDirectory);
    if (resolved) {
      return { path: resolved, source: variableName };
    }
  }

  const searchCandidates = candidates ?? defaultCandidates(platform, homeDirectory, env);
  for (const candidate of searchCandidates) {
    const resolved = normalizeCandidate(candidate, homeDirectory);
    if (resolved) {
      return { path: resolved, source: 'auto-detected' };
    }
  }

  return undefined;
}

export function resolveHmsSdkPath({
  configuredPath,
  ohosSdkPath,
  env = process.env,
  homeDirectory = os.homedir(),
} = {}) {
  const candidates = configuredPath
    ? [configuredPath, path.join(configuredPath, 'hms'), path.join(configuredPath, 'default', 'hms')]
    : [
        env.ZED_ETS_HMS_SDK_PATH,
        env.HMS_SDK_PATH,
        ohosSdkPath && path.join(path.dirname(ohosSdkPath), 'hms'),
      ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = path.resolve(expandHome(candidate, homeDirectory));
    if (isValidHmsSdkPath(normalized)) {
      return {
        path: normalized,
        source: configuredPath ? 'settings' : 'auto-detected',
      };
    }
  }

  if (configuredPath) {
    throw new Error(
      `Invalid HMS SDK path: ${configuredPath}. Expected ets/kits and ets/api.`,
    );
  }

  return undefined;
}

export { isValidHmsSdkPath, isValidOhosSdkPath };
