---
name: copy-dev
description: 将当前仓库的 zed-ets-language-server 复制到 Zed 编辑器扩展目录，用于开发测试。使用场景：当你修改了 language server 代码后需要快速部署测试。
disable-model-invocation: true
---

# 复制开发版本到 Zed 扩展目录

此技能将当前 git 仓库中的 `zed-ets-language-server` 复制到 Zed 编辑器的扩展安装目录，用于开发测试。

## 执行步骤

### 第一步：定位 Zed 扩展目录

在 macOS 上，Zed 编辑器的扩展目录通常位于：
- `~/.local/share/zed/extensions/`
- 或 `~/Library/Application Support/Zed/extensions/`

查找方式：
1. 检查 `~/.local/share/zed/extensions/` 是否存在
2. 如果不存在，检查 `~/Library/Application Support/Zed/extensions/` 是否存在
3. 如果都没有找到，说明用户可能没有安装 Zed，任务终止

将该目录路径赋值给环境变量 `ZED_EXTENSIONS_DIR`。

### 第二步：删除旧版本

在 `$ZED_EXTENSIONS_DIR/work/arkts/node_modules/` 目录中删除 `zed-ets-language-server` 目录（如果存在）。

### 第三步：复制新版本

将当前 git 仓库中的 `zed-ets-language-server` 目录完整复制到：
`$ZED_EXTENSIONS_DIR/work/arkts/node_modules/zed-ets-language-server`

## 注意事项

- 此操作会覆盖已有的 language server 文件
- 复制完成后，需要重启 Zed 编辑器或重新加载扩展才能生效
