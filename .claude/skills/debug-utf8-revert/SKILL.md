---
name: debug-utf8-revert
description: 调试 UTF-8 处理变更导致 LSP 解析失效的问题。Commit 1083e2d 时 LSP 解析无法正常工作，在 a88ed44d (版本 2.3.3) revert 后 LSP 能够成功，但少数情况下仍有消息解析失败。
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(cat *), Bash(head *), Bash(tail *), Bash(diff *), Bash(ls *), Bash(cd *)
---

# 调试 UTF-8 处理变更导致的 LSP 解析失效

## 问题背景

- **Commit `1083e2d950d55fe3fdc809d81f6da4935bec9ec0`**：LSP 解析无法正常工作
- **Commit `a88ed44d95b09e553cbfa91e31f1204b3ce5c45e` (版本 2.3.3)**：revert 了 UTF-8 处理相关的代码，LSP 能够成功，但少数情况下仍有消息解析失败

需要分析为什么 `1083e2d` 的变更会导致问题，以及为什么 revert 后仍有边缘情况失败。

该 commit 的主要变更：

### 1. data-parser.js 变更

**变更前（使用 Buffer）**：
```javascript
let stdinBuffer = Buffer.alloc(0);
// 使用 Buffer.concat 合并数据
// 使用 buffer.indexOf() 查找分隔符
// 使用 buffer.subarray() 切片
```

**变更后（使用 String）**：
```javascript
let stdinBuffer = '';
// 直接拼接字符串
```

### 2. index.js 变更

**变更前**：
```javascript
// 注释明确说明不要使用 setEncoding('utf8')
// 原因：LSP Content-Length 按字节计算，而非字符
// TCP 数据可能在任意字节边界分割，包括多字节 UTF-8 字符中间
process.stdin.on('data', (data) => parse(data, ...));
```

**变更后**：
```javascript
stdin.setEncoding('utf8');
// stdin.setRawMode(true); // 被注释掉
```

## 调试步骤

### 第一步：对比两个版本的代码

```bash
# 查看变更前的版本
git show a88ed44d^:zed-ets-language-server/lib/data-parser.js

# 查看变更后的版本
git show a88ed44d:zed-ets-language-server/lib/data-parser.js

# 查看完整 diff
git show a88ed44d
```

### 第二步：切换到变更前版本测试

```bash
# 切换到变更前的 commit
# 注意：1083e2d 是问题版本，a88ed44d 是修复版本
# 要测试问题版本：git checkout 1083e2d
# 要测试修复版本：git checkout a88ed44d

git checkout <commit-hash>

# 部署测试
/copy-dev
```

然后使用 Zed 打开 `fixtures/simple.ets` 文件测试 LSP 是否正常工作。

**测试方法**：
1. 用 Zed 打开项目中的 `fixtures/simple.ets` 文件
2. 观察是否有语法高亮、代码补全等 LSP 功能
3. 如需详细日志，设置环境变量 `ZED_ETS_LANG_SERVER_LOG=true`，日志文件位于：
   `~/Library/Application Support/Zed/extensions/work/arkts/node_modules/zed-ets-language-server/lib/arkts-lsw.log`

### 第三步：对比测试

分别测试 `1083e2d`（问题版本）和 `a88ed44d`（修复版本），对比 LSP 行为差异。

```bash
# 测试问题版本
git checkout 1083e2d
/copy-dev
# 然后在 Zed 中打开 fixtures/simple.ets 测试

# 测试修复版本  
git checkout a88ed44d
/copy-dev
# 然后在 Zed 中打开 fixtures/simple.ets 测试
```

### 第四步：分析根本原因

需要重点检查：

1. **Content-Length 计算问题**
   - LSP 协议的 Content-Length 是按**字节**计算的
   - 当使用 `setEncoding('utf8')` 后，data 变成字符串
   - 字符串的 `.length` 返回的是**字符数**，不是字节数
   - 对于包含中文等多字节字符的内容，这会导致解析错误

2. **数据分割问题**
   - TCP 数据流可能在任意字节边界分割
   - 如果数据在多字节 UTF-8 字符中间被分割
   - 使用 `setEncoding('utf8')` 会产生乱码或替换字符
   - 这会导致后续的 Buffer 操作失败

3. **Buffer vs String 索引问题**
   - Buffer 的索引是字节索引
   - String 的索引是字符索引
   - 对于 UTF-8 编码，这两者不一致

## 关键文件

| 文件 | 作用 |
|------|------|
| `zed-ets-language-server/lib/data-parser.js` | LSP 消息解析器 |
| `zed-ets-language-server/index.js` | 语言服务器入口 |
| `zed-ets-language-server/lib/logger.js` | 日志工具 |

## 修复建议

如果确认是 UTF-8 处理问题，应该：

1. 恢复使用 Buffer 处理 stdin 数据
2. 不要在 stdin 上调用 `setEncoding('utf8')`
3. 在需要转换为字符串时，使用 `buffer.toString('utf8')`
4. 确保 Content-Length 始终按字节计算

## 相关资源

- LSP 规范：https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/
- Node.js Buffer 文档：https://nodejs.org/api/buffer.html
