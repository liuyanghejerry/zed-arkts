---
name: build-zed-debug
description: 构建定制版 Zed 编辑器，内置 LSP 通信 hex dump 日志和手动触发 completion/definition 的命令，用于排查 language server 字节级协议问题。当你需要重现或更新定制版 Zed 构建时使用。
disable-model-invocation: true
---

# 构建定制版 Zed 用于 LSP 协议调试

此技能完整记录了如何从源码构建一个带有 LSP 通信追踪功能的定制版 Zed 编辑器。

## 能力概览

定制版 Zed 相比官方版本增加了：

1. **LSP stdin/stdout 字节级 hex dump** — 所有发给 language server 和从 language server 收到的字节都会以 `[LSP-TRACE STDIN]` / `[LSP-TRACE STDOUT]` 标签输出到 stderr
2. **`editor: force definition` 命令** — 绕过缓存直接触发 `textDocument/definition`
3. **`editor: force completion` 命令** — 绕过缓存直接触发 `textDocument/completion`
4. **AUTO-CMD 自动化通道**(2026-07-05 加入)— 启动时设 `ZED_AUTO_CMD_FILE=<file>`,向该文件追加一行 action 名(可带 JSON 参数)即可无 UI 派发任意 action 到活动窗口,例如 `editor::ForceDefinition`、`workspace::SendKeystrokes "cmd-p"`。派发结果以 `[AUTO-CMD]` 前缀写到 stderr。实现在 `crates/zed/src/main.rs` 的 `init_auto_cmd_channel()`,于 `initialize_workspace` 之后挂载。

## 前置条件

- macOS（本技能针对 macOS arm64，Linux 需调整路径）
- **Xcode 完整版**（`/Applications/Xcode.app`），不能仅用 Command Line Tools
- **Metal Toolchain** 组件已安装
- Rust 工具链
- Git
- 约 10GB 磁盘空间（源码 + 编译产物）

验证前置条件：

```bash
# Xcode 必须指向完整版
xcode-select -p
# 应该输出: /Applications/Xcode.app/Contents/Developer

# 如果不是，切换：
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# 验证 Metal 编译器可用
xcrun --find metal
# 应该输出: /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/metal

# 如果 metal 不存在，下载 Metal Toolchain：
xcodebuild -downloadComponent MetalToolchain
```

## 执行步骤

### 第一步：克隆 Zed 源码

```bash
git clone --depth=1 https://github.com/zed-industries/zed.git /tmp/zed-debug
cd /tmp/zed-debug
git checkout -b debug/lsp-trace-commands
```

> **基准 commit**：本技能基于 `e3b73c6b30cdc09e820823fe44542b89850d4be1` 记录。新版 Zed 可能有代码偏移，需根据实际情况调整行号。

### 第二步：添加 LSP stdin 写入追踪（`crates/lsp/src/lsp.rs`）

在 `impl LanguageServer` 块内，`handle_outgoing_messages` 方法之前添加 `hex_dump` 工具函数：

```rust
/// Format bytes as a hex dump for debugging LSP communication.
fn hex_dump(data: &[u8], label: &str) -> String {
    let mut output = format!("[LSP-TRACE {}] {} bytes:\n", label, data.len());
    for (i, chunk) in data.chunks(16).enumerate() {
        let offset = i * 16;
        let hex_line: String = chunk
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<_>>()
            .join(" ");
        let ascii_line: String = chunk
            .iter()
            .map(|&b| {
                if b.is_ascii_graphic() || b == b' ' {
                    b as char
                } else {
                    '.'
                }
            })
            .collect();
        output.push_str(&format!(
            "  {:04x}: {:48} {}\n",
            offset, hex_line, ascii_line
        ));
    }
    output
}
```

在 `handle_outgoing_messages` 方法中，在 `write_all` 调用之前添加 hex dump：

```rust
content_len_buffer.clear();
write!(content_len_buffer, "{}", message.len()).unwrap();

// Build the full framed message for hex dump logging
let framed = format!(
    "Content-Length: {}\r\n\r\n{}",
    message.len(),
    message
);
eprintln!("{}", Self::hex_dump(framed.as_bytes(), "STDIN"));

stdin.write_all(CONTENT_LEN_HEADER.as_bytes()).await?;
// ... rest of writes remain unchanged
```

### 第三步：添加 LSP stdout 读取追踪（`crates/lsp/src/input_handler.rs`）

在 `handler` 方法的读消息循环中，`read_exact` 之后、JSON 解析之前添加 hex dump。

关键修改：需要先将 `headers` 转为 `String`（`headers_owned`）以解决 borrow checker 冲突，因为后续需要可变借用 `buffer`。

在 `read_exact(&mut buffer).await?` 之后插入：

```rust
// Take ownership of headers before mutable borrow of buffer
let headers_owned = headers.to_string();

buffer.resize(message_len, 0);
stdout.read_exact(&mut buffer).await?;

// Reconstruct the full framed message for hex dump
if let Ok(body_str) = str::from_utf8(&buffer) {
    let full_frame = format!("{headers_owned}{body_str}");
    let mut dump = format!(
        "[LSP-TRACE STDOUT] {} bytes:\n",
        full_frame.len()
    );
    for (i, chunk) in full_frame.as_bytes().chunks(16).enumerate() {
        // ... hex dump formatting (same pattern as hex_dump above) ...
    }
    eprintln!("{dump}");
}
```

### 第四步：添加手动触发命令（editor actions）

**`crates/editor/src/actions.rs`** — 在 `actions!` 宏中添加两个新 action：

- 在 `GoToDefinitionSplit,` 之后添加：`ForceDefinition,`
- 在 `ShowCompletions,` 之后添加：`ForceCompletion,`

**`crates/editor/src/navigation.rs`** — 在 `go_to_definition` 方法之后添加 handler：

```rust
pub fn force_definition(
    &mut self,
    _: &ForceDefinition,
    window: &mut Window,
    cx: &mut Context<Self>,
) -> Task<Result<Navigated>> {
    self.go_to_definition_of_kind(GotoDefinitionKind::Symbol, false, window, cx)
}
```

**`crates/editor/src/completions.rs`** — 在 `show_completions` 方法之后添加 handler：

```rust
pub fn force_completion(
    &mut self,
    _: &ForceCompletion,
    window: &mut Window,
    cx: &mut Context<Self>,
) {
    self.open_or_update_completions_menu(None, None, false, window, cx);
}
```

**⚠️ `crates/editor/src/element.rs` — 必须注册 handler,否则 action 存在但永远不会触发**(旧版文档漏了这步)。在 `register_actions` 里 `go_to_definition` 的注册之后添加：

```rust
register_action(editor, window, |editor, action, window, cx| {
    editor
        .force_definition(action, window, cx)
        .detach_and_log_err(cx);
});
register_action(editor, window, Editor::force_completion);
```

### 第四步补：AUTO-CMD 自动化通道（无 UI 派发 action）

**`crates/zed/src/main.rs`** — 添加 `init_auto_cmd_channel(cx)` 并在 `app.run` 闭包里 `initialize_workspace(...)` 之后调用。该函数:若设置了 `ZED_AUTO_CMD_FILE` 环境变量,每 500ms 轮询该文件,把新增的每一行解析为 `action名 [JSON参数]`,用 `cx.build_action(name, data)` 构建后 `window.dispatch_action` 派发到活动窗口(无活动窗口时回退到第一个窗口),结果 `eprintln!("[AUTO-CMD] ...")`。完整实现已在 `~/develop/zed-debug/crates/zed/src/main.rs` 中,搜 `init_auto_cmd_channel`。

用法示例（headless 验证 go-to-definition）：

```bash
CMD=/tmp/zed-cmds.txt; : > $CMD
ZED_AUTO_CMD_FILE=$CMD ./target/debug/zed <folder> <folder>/file.ets 2>/tmp/zed-stderr.log &
# 等 LSP didOpen 后：
echo 'editor::ForceDefinition' >> $CMD
# stderr 出现 "[AUTO-CMD] dispatched editor::ForceDefinition"；
# 验证导航成功的标志：definition 响应后,Zed 会在目标位置发新的
# textDocument/documentHighlight / codeAction 请求（光标已移动）。
```

**Trust 弹窗**：headless 打开新文件夹会被 "unrecognized project" 弹窗卡住。两个解法：
- Zed 设置 `"session": {"trust_all_worktrees": true}`（内置设置,无需改源码）；
- 或预插数据库：`sqlite3 "~/Library/Application Support/Zed/db/0-dev/db.sqlite" "INSERT INTO trusted_worktrees(absolute_path) VALUES('<folder>');"`（dev 构建用 `0-dev`,正式版用 `0-stable`）。

### 第五步：编译

```bash
# 构建需要 DEVELOPER_DIR 环境变量指向完整 Xcode
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd /tmp/zed-debug
cargo build -p zed
```

编译产物：`target/debug/zed`（约 1.1GB debug build）。

首次编译需要下载约 2GB 依赖并编译整个项目，预计耗时 20-40 分钟（取决于机器性能）。后续增量编译只需数十秒。

### 第六步：安装 ArkTS 扩展

```bash
# 1. 构建 Rust 扩展（如果尚未构建）
cd /path/to/zed-arkts
cargo build --release

# 2. 安装到 Zed 扩展目录
ZED_EXT_DIR="$HOME/Library/Application Support/Zed/extensions/installed/arkts"
mkdir -p "$ZED_EXT_DIR"
cp target/release/libzed_arkts.dylib "$ZED_EXT_DIR/"
cp extension.toml "$ZED_EXT_DIR/"
cp -r languages "$ZED_EXT_DIR/"
cp -r zed-ets-language-server "$ZED_EXT_DIR/"

# ⚠️ 关键：还必须提供编译好的 tree-sitter grammar wasm，否则 Zed 会报
# "failed to load language ArkTS Language: No such file or directory"，
# 语言完全无法加载（没有高亮、也不会启动 LSP）。
# grammar 用 Zed 缓存的 wasi-sdk clang 编译（extensions/build/wasi-sdk 由
# Zed 首次 dev-extension 安装时下载）：
GRAMMAR_SRC=/tmp/tree-sitter-arkts
git clone --filter=blob:none --no-checkout https://github.com/liuyanghejerry/tree-sitter-arkts.git "$GRAMMAR_SRC"
git -C "$GRAMMAR_SRC" checkout 2b3d4b944ea4417729ebcd030834a5352cff7bb2  # extension.toml 里的 rev
CLANG="$HOME/Library/Application Support/Zed/extensions/build/wasi-sdk/bin/clang"
mkdir -p "$ZED_EXT_DIR/grammars"
"$CLANG" -fPIC -shared -Os "-Wl,--export=tree_sitter_arkts" \
  -o "$ZED_EXT_DIR/grammars/arkts.wasm" \
  -I "$GRAMMAR_SRC/src" "$GRAMMAR_SRC/src/parser.c"
# （若 src/scanner.c 存在需一并加入编译参数）

# 3. 安装 LSP wrapper 的 npm 依赖
cd "$ZED_EXT_DIR/zed-ets-language-server"
npm install --production

# 4. 创建扩展元数据
cat > "$ZED_EXT_DIR/manifest.json" << EOF
{
  "id": "arkts",
  "name": "ArkTS",
  "version": "0.2.0",
  "schema_version": 1,
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "installation_method": "automated"
}
EOF
```

### 第七步：启动并收集日志

```bash
# 启动定制版 Zed，stderr 重定向以收集 hex dump
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
/path/to/zed-debug/target/debug/zed 2>/tmp/zed-lsp-trace.log

# 在另一个终端实时查看 hex dump
tail -f /tmp/zed-lsp-trace.log | grep "LSP-TRACE"
```

### 第八步：使用新命令

在运行中的定制版 Zed 里：

1. 打开 `.ets` 文件
2. `Cmd+Shift+P` 打开命令面板
3. 搜索 **"force"** 找到：
   - `Editor: Force Definition`
   - `Editor: Force Completion`
4. 选择执行，然后检查 stderr 输出的 hex dump

### 第九步：结合 wrapper 日志对比

同时启用 wrapper 侧的日志：

```bash
ZED_ETS_LANG_SERVER_LOG=true /path/to/zed-debug/target/debug/zed 2>/tmp/zed-lsp-trace.log
```

wrapper 日志位于 `~/Library/Application Support/Zed/extensions/installed/arkts/zed-ets-language-server/lib/arkts-lsw.log`。

**对比点**：
- `[LSP-TRACE STDIN]` 中的 `Content-Length` 值 与 消息体字节数是否一致
- wrapper 日志中是否有 `Error parsing message` 报错
- 如果 Zed 发送的字节正确但 wrapper 报错，问题在 `data-parser.js`
- 如果 Zed 发送的字节本身有问题，问题在 Zed 的 LSP client

## 验证修改是否生效

```bash
# 检查二进制中是否包含我们的字符串
strings /path/to/zed-debug/target/debug/zed | grep "LSP-TRACE"
# 应该输出: [LSP-TRACE STDIN] 和 [LSP-TRACE STDOUT]

strings /path/to/zed-debug/target/debug/zed | grep "ForceDefinition"
# 应该找到相关字符串
```

## 清理

```bash
# 删除定制版 Zed 源码和编译产物（回收约 12GB）
rm -rf /tmp/zed-debug

# 恢复 xcode-select（如果需要）
sudo xcode-select --switch /Library/Developer/CommandLineTools
```

## 版本记录

| 日期 | 基准 Zed commit | 说明 |
|------|----------------|------|
| 2026-07-04 | `e3b73c6b30cdc09e820823fe44542b89850d4be1` | 初始版本 |
| 2026-07-05 | `e3b73c6b30cdc09e820823fe44542b89850d4be1` | 补注册 Force* actions（element.rs）；新增 AUTO-CMD 通道（main.rs `init_auto_cmd_channel`）；step 6 补 grammar wasm 编译步骤。源码在 `~/develop/zed-debug`（已从 /tmp 迁移） |
