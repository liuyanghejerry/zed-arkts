// 中文注释:测试多字节 UTF-8 的 LSP 处理
const 问候语 = '你好,世界';
sayHello(问候语);

function sayHello(消息: string): string {
  return `【提示】${消息}`;
}
