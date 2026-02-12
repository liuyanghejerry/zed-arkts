import { logger } from './logger.js';

let stdinBuffer = Buffer.alloc(0);

export function parse(data, callback) {
  // Convert string to Buffer if necessary (happens when stdin.setEncoding('utf8') is used)
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  stdinBuffer = Buffer.concat([stdinBuffer, dataBuffer]);

  while (true) {
    const headerEnd = stdinBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const headerPart = stdinBuffer.subarray(0, headerEnd).toString('utf8');
    const lengthMatch = headerPart.match(/Content-Length: (\d+)/);
    if (!lengthMatch) break;

    const contentLength = Number.parseInt(lengthMatch[1]);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;

    if (stdinBuffer.length < messageEnd) break;

    const messageJson = stdinBuffer.subarray(messageStart, messageEnd).toString('utf8');
    stdinBuffer = stdinBuffer.subarray(messageEnd);

    try {
      const message = JSON.parse(messageJson);
      callback(message);
    } catch (error) {
      logger.error(`Error parsing message: ${error.message}`);
      stdinBuffer = Buffer.alloc(0);
    }
  }
}

export function clearBuffer() {
  stdinBuffer = Buffer.alloc(0);
}
