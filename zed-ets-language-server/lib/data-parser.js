import { logger } from './logger';

let stdinBuffer = Buffer.alloc(0);

export function parse(data, callback) {
  stdinBuffer = Buffer.concat([stdinBuffer, data]);

  while (true) {
    // Find Content-Length header
    const headerStart = stdinBuffer.indexOf('Content-Length: ');
    if (headerStart === -1) break;

    const valueStart = headerStart + 'Content-Length: '.length;
    const valueEnd = stdinBuffer.indexOf('\r\n', valueStart);
    if (valueEnd === -1) break;

    const contentLengthStr = stdinBuffer.subarray(valueStart, valueEnd).toString();
    const contentLength = Number.parseInt(contentLengthStr, 10);
    if (isNaN(contentLength) || contentLength <= 0) break;

    const headerEnd = stdinBuffer.indexOf('\r\n\r\n', valueEnd);
    if (headerEnd === -1) break;

    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;

    if (stdinBuffer.length < messageEnd) break;

    // Extract message
    const messageJson = stdinBuffer.subarray(messageStart, messageEnd).toString();
    stdinBuffer = stdinBuffer.subarray(messageEnd);

    try {
      const message = JSON.parse(messageJson);
      callback(message);
    } catch (error) {
      logger.error(`Error parsing message: ${error.message} ${error.stack}`);
    }
  }
}

export function clearBuffer() {
  stdinBuffer = Buffer.alloc(0);
}
