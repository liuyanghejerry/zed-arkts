# ArkTS Sample Project

这是一个用于测试 Zed ArkTS 扩展的样板项目。

## 项目结构

```
arkts-sample-project/
├── oh-package.json5        # 项目配置和依赖
├── src/
│   ├── main.ets           # 应用入口
│   ├── components/
│   │   └── HelloWorld.ets # 示例组件
│   └── pages/
│       ├── Index.ets      # 首页
│       └── HelloWorld.ets # Hello World 页面
└── README.md
```

## 功能特性

### 1. 组件定义和导出
- `HelloWorld.ets` 演示了如何定义和导出组件
- 使用 `@Component` 装饰器
- 定义组件接口 `HelloWorldProps`

### 2. 状态管理
- `@State` - 组件内部状态
- `@Prop` - 组件属性

### 3. 路由导航
- 使用 `@kit.ArkUI` 的 router 进行页面跳转

### 4. 事件处理
- `onClick` 事件处理
- 状态更新

## 测试用途

此项目用于测试以下 LSP 功能：

### 1. 转到定义 (Go to Definition)
- 在 `Index.ets` 中点击 `router.pushUrl` 应该跳转到定义
- 在 `HelloWorld.ets` 中点击 `HelloWorldProps` 应该跳转到接口定义
- 在 `main.ets` 中点击 `HelloWorld` 应该跳转到组件定义

### 2. 查找引用 (Find References)
- 查找 `HelloWorld` 组件的所有引用
- 应该在 `main.ets` 和 `pages/HelloWorld.ets` 中找到

### 3. 自动补全 (Completion)
- 输入 `@` 应该提示装饰器：`@Component`, `@State`, `@Prop` 等
- 输入 `this.` 应该提示组件属性

### 4. 诊断 (Diagnostics)
- 类型错误检查
- 未使用的导入
- 语法错误

## 自动化测试示例

### 测试 LSP 初始化

```bash
#!/bin/bash
cd /home/runner/work/zed-arkts/zed-arkts

# 启动语言服务器并发送初始化请求
node zed-ets-language-server/index.js << EOF
Content-Length: 200

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":"file://$(pwd)/test-fixtures/arkts-sample-project","capabilities":{}}}
EOF
```

### 测试转到定义

```javascript
// 测试从 main.ets 跳转到 HelloWorld 定义
const request = {
  jsonrpc: '2.0',
  id: 2,
  method: 'textDocument/definition',
  params: {
    textDocument: { 
      uri: 'file:///test-fixtures/arkts-sample-project/src/main.ets' 
    },
    position: { line: 3, character: 10 } // HelloWorld 位置
  }
};

// 期望结果：返回 src/components/HelloWorld.ets 的位置
```

### 测试查找引用

```javascript
const request = {
  jsonrpc: '2.0',
  id: 3,
  method: 'textDocument/references',
  params: {
    textDocument: { 
      uri: 'file:///test-fixtures/arkts-sample-project/src/components/HelloWorld.ets' 
    },
    position: { line: 6, character: 15 }, // HelloWorld 组件名
    context: { includeDeclaration: true }
  }
};

// 期望结果：找到 2-3 个引用位置
```

## 手动测试步骤

### 1. 安装扩展

```bash
# 构建扩展
cd /home/runner/work/zed-arkts/zed-arkts
cargo build --release

# 安装到 Zed（如果在本地环境）
# 在 Zed 中打开扩展页面，选择 "Install from Directory"
# 选择此项目目录
```

### 2. 打开项目

在 Zed 中打开 `test-fixtures/arkts-sample-project` 目录

### 3. 验证功能

- [x] 打开 `src/main.ets`，语法高亮应该正常工作
- [x] 将鼠标悬停在 `HelloWorld` 上，应该显示类型信息
- [x] 右键点击 `HelloWorld`，选择 "Go to Definition"，应该跳转到 `components/HelloWorld.ets`
- [x] 右键点击 `HelloWorld`，选择 "Find All References"，应该列出所有引用
- [x] 尝试修改代码，应该有实时的语法检查

## 预期的 LSP 响应

### Initialize Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "capabilities": {
      "textDocumentSync": 2,
      "completionProvider": {
        "resolveProvider": true,
        "triggerCharacters": [".", "@"]
      },
      "definitionProvider": true,
      "referencesProvider": true,
      "documentSymbolProvider": true,
      "workspaceSymbolProvider": true
    }
  }
}
```

### Definition Response

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "uri": "file:///test-fixtures/arkts-sample-project/src/components/HelloWorld.ets",
    "range": {
      "start": { "line": 6, "character": 14 },
      "end": { "line": 6, "character": 24 }
    }
  }
}
```

## 故障排查

### LSP 服务器未启动

检查 Zed 的日志：
```bash
tail -f ~/.local/share/zed/logs/Zed.log
```

### 无法找到定义

确保配置了正确的 `tsdk` 路径：
```json
{
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "tsdk": "/path/to/typescript/lib"
      }
    }
  }
}
```

## 贡献

此示例项目用于测试目的。如有改进建议，欢迎提交 PR。
