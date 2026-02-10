# Quick Reference - LSP Testing

## 快速开始 / Quick Start

### 运行所有测试 / Run All Tests
```bash
./scripts/run-lsp-tests.sh
```

### 运行单元测试 / Run Unit Tests Only
```bash
cd zed-ets-language-server
npm install  # First time only
npm test
```

### 安装扩展到 Zed / Install Extension to Zed
```bash
./scripts/install-extension.sh
```

## 文件结构 / File Structure

```
zed-arkts/
├── docs/
│   ├── TESTING.md         # 测试指南（中文）
│   ├── TESTING_EN.md      # Testing Guide (English)
│   └── SUMMARY.md         # 研究总结 / Research Summary
├── scripts/
│   ├── run-lsp-tests.sh        # 主测试运行器 / Main test runner
│   ├── install-extension.sh    # 扩展安装器 / Extension installer
│   └── test-lsp-features.sh    # LSP 功能测试 / LSP feature tests
├── test-fixtures/
│   └── arkts-sample-project/   # 样板项目 / Sample project
│       ├── src/
│       │   ├── main.ets
│       │   ├── components/
│       │   └── pages/
│       └── README.md
└── zed-ets-language-server/
    ├── tests/
    │   └── integration/
    │       └── lsp-server.test.js
    ├── lib/
    │   ├── data-parser.test.js
    │   └── lib-expander.test.js
    └── package.json
```

## 测试命令 / Test Commands

| 命令 / Command | 说明 / Description |
|---------------|-------------------|
| `npm test` | 运行所有测试 / Run all tests |
| `npm run test:unit` | 只运行单元测试 / Unit tests only |
| `npm run test:integration` | 只运行集成测试 / Integration tests only |
| `npm run test:watch` | 监视模式 / Watch mode |

## LSP 测试场景 / LSP Test Scenarios

### 1. 转到定义 / Go to Definition
在 `test-fixtures/arkts-sample-project/src/main.ets` 中：
- 点击 `HelloWorld` → 跳转到 `components/HelloWorld.ets`

### 2. 查找引用 / Find References
在 `HelloWorld.ets` 组件中：
- 查找 `HelloWorld` 的引用 → 找到在 `main.ets` 和 `pages/HelloWorld.ets` 中的使用

### 3. 语法高亮 / Syntax Highlighting
打开任何 `.ets` 文件：
- 装饰器 (`@Component`, `@State`) 应该高亮
- 关键字和类型应该正确着色

### 4. 自动补全 / Completion
在编辑器中：
- 输入 `@` → 显示装饰器建议
- 输入 `this.` → 显示组件属性

## CI/CD

GitHub Actions 会自动运行：
1. 构建 Rust 扩展
2. 运行单元测试
3. 运行集成测试
4. 验证 LSP 服务器启动

查看: `.github/workflows/ci.yml`

## 环境要求 / Requirements

- Node.js >= 22.12.0
- Rust (stable)
- Cargo

## 故障排查 / Troubleshooting

### 问题：测试失败 / Tests Fail
```bash
# 重新安装依赖 / Reinstall dependencies
cd zed-ets-language-server
rm -rf node_modules package-lock.json
npm install
npm test
```

### 问题：扩展未加载 / Extension Not Loading
```bash
# 重新构建并安装 / Rebuild and reinstall
cargo clean
cargo build --release
./scripts/install-extension.sh
# 重启 Zed / Restart Zed
```

### 问题：LSP 服务器未启动 / LSP Server Not Starting
检查 Zed 日志 / Check Zed logs:
```bash
# Linux
tail -f ~/.local/share/zed/logs/Zed.log

# macOS
tail -f ~/Library/Logs/Zed/Zed.log
```

## 更多信息 / More Information

- 📖 完整测试指南 / Full Testing Guide: `docs/TESTING_EN.md`
- 🔍 研究总结 / Research Summary: `docs/SUMMARY.md`
- ✅ 验证清单 / Verification: `VERIFICATION.md`
- 📦 样板项目 / Sample Project: `test-fixtures/arkts-sample-project/README.md`

## 贡献 / Contributing

1. 添加新测试到 `zed-ets-language-server/tests/`
2. 更新文档
3. 运行 `npm test` 确保通过
4. 提交 PR

## 许可 / License

MIT License
