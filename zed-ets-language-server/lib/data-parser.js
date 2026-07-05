import { logger } from './logger.js';

let stdinBuffer = Buffer.alloc(0);

export function parse(data, callback) {
  // LSP Content-Length is measured in bytes, not characters, so all parsing
  // must operate on a Buffer. Convert string input to a Buffer if necessary
  // (happens when stdin.setEncoding('utf8') is used, which yields strings).
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

    // Content-Length counts bytes, so compare against the buffer's byte length.
    if (stdinBuffer.length < messageEnd) break;

    const messageJson = stdinBuffer.subarray(messageStart, messageEnd).toString('utf8');
    stdinBuffer = stdinBuffer.subarray(messageEnd);

    try {
      const message = JSON.parse(messageJson);
      callback(message);
    } catch (error) {
      logger.error(`Error parsing message: ${error.message} ${error.stack} ${messageJson}`);
      // Clear buffer on parse error to prevent corruption from leftover data
      stdinBuffer = Buffer.alloc(0);
    }
  }
}

export function clearBuffer() {
  stdinBuffer = Buffer.alloc(0);
}
