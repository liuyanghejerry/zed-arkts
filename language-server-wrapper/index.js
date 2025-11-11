#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
// ETS语言服务器路径，由Rust扩展进程通过环境变量传递
const etsLangServer = path.resolve(process.env.ETS_LANG_SERVER);

// 创建日志文件写入流
const logFilePath = path.join(__dirname, 'arkts-lsw.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'w+' });

// 获取当前时间戳的函数
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace('T', ' ');
};

// 日志工具
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
  // 添加关闭日志流的方法
  close: () => {
    logStream.end();
  }
};
// 主函数 - 简化版本，只做转发
async function main() {
  logger.section('🚀 ArkTS Language Server Wrapper');

  // 检查语言服务器是否存在
  const serverExists = fs.existsSync(etsLangServer);

  if (!serverExists) {
    logger.error(`语言服务器不存在，请先构建语言服务器 ${etsLangServer}`);
    return;
  }

  logger.success(`语言服务器路径: ${etsLangServer}`);

  // 启动语言服务器
  logger.section('🔌 启动语言服务器');

  const serverProcess = spawn('node', [etsLangServer, '--node-ipc', '--server-mode'], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env },
  });

  // 监听服务器进程的错误和退出事件
  serverProcess.on('error', (error) => {
    logger.error(`语言服务器进程错误: ${error.message}`);
  });

  serverProcess.on('exit', (code, signal) => {
    logger.info(`语言服务器进程退出，退出码: ${code}, 信号: ${signal}`);
  });

  // 设置 serverProcess.stdout 到 process.stdout 的转发
  serverProcess.stdout.on('data', (data) => {
    logger.data(data);
  });

  // 设置 serverProcess.stderr 到 process.stderr 的转发
  serverProcess.stderr.on('data', (data) => {
    logger.error(data);
  });

  // 设置 serverProcess IPC 消息到 process.stdout 的转发
  serverProcess.on('message', (message) => {
    // 将 IPC 消息转换为标准的 LSP 格式并发送到 stdout
    logger.data('接收语言服务器消息', message);
    const messageStr = JSON.stringify(message);
    const headers = `Content-Length: ${Buffer.byteLength(messageStr)}\r\n\r\n`;
    process.stdout.write(headers + messageStr);
  });

  // 设置 process.stdin 到 serverProcess IPC 的转发
  let stdinBuffer = Buffer.alloc(0);
  process.stdin.on('data', (data) => {
    stdinBuffer = Buffer.concat([stdinBuffer, data]);

    while (true) {
      const bufferAsString = stdinBuffer.toString('utf8');
      const lengthMatch = bufferAsString.match(/Content-Length: (\d+)\r\n/);
      if (!lengthMatch) break;

      const contentLength = Number.parseInt(lengthMatch[1]);
      const headerEnd = bufferAsString.indexOf('\r\n\r\n');

      if (headerEnd === -1) break;

      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (stdinBuffer.length < messageEnd) break;

      // 提取消息
      const messageBuffer = stdinBuffer.slice(messageStart, messageEnd);
      stdinBuffer = stdinBuffer.slice(messageEnd);

      try {
        const message = JSON.parse(messageBuffer.toString('utf8'));

        // 通过 IPC 发送消息到语言服务器
        serverProcess.send(message);
        logger.data('发送消息到语言服务器', message);
      } catch (error) {
        logger.error(`解析来自 stdin 的消息失败: ${error.message}, ${messageBuffer.toString('utf8')}`);
      }
    }
  });

  // 错误处理
  process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM 信号，正在关闭语言服务器...');
    serverProcess.kill();
    logger.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('收到 SIGINT 信号，正在关闭语言服务器...');
    serverProcess.kill();
    logger.close();
    process.exit(0);
  });

  logger.success('语言服务器包装器已启动，开始转发消息');
}

// 错误处理
process.on('uncaughtException', (error) => {
  logger.error(`未捕获的异常: ${error.message}`);
  console.error(error);
  logger.close(); // 关闭日志流
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error(`未处理的 Promise 拒绝: ${reason}`);
  console.error(reason);
  logger.close(); // 关闭日志流
  process.exit(1);
});

// 运行主函数
main();
