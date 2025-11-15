import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createSimpleLogger() {
  if (process.env.ZED_ETS_LANG_SERVER_LOG !== 'true') {
    const noop = (_msg) => {};
    return {
      info: noop,
      success: noop,
      error: console.error,
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

export const logger = createSimpleLogger();
