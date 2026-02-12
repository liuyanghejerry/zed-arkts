import { logger } from './logger.js';

let stdinBuffer = '';

export function parse(data, callback) {
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
      callback(message);
    } catch (error) {
      logger.error(`Error parsing message: ${error.message} ${error.stack} ${messageJson}`);
    }
  }
}

export function clearBuffer() {
  stdinBuffer = '';
}
