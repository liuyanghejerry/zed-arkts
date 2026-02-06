# Zed 语言扩展系统的代码格式化支持

本文档详细说明 Zed 编辑器的语言扩展系统如何支持代码格式化操作。

## 概述

Zed 提供了三种主要的代码格式化方式：

1. **语言服务器提供的格式化** (Language Server Protocol formatting)
2. **外部命令行工具格式化** (External formatter)
3. **代码操作格式化** (Code actions on format)

## 1. 语言服务器格式化

### LSP 格式化支持

如果语言服务器实现了 LSP 的格式化功能（`textDocument/formatting` 和 `textDocument/rangeFormatting`），Zed 会自动使用这些功能。

### 工作原理

当语言服务器启动并且支持格式化功能时：
- Zed 会在保存文件时自动调用语言服务器的格式化功能
- 用户可以通过 `editor: format` 命令手动触发格式化
- 支持格式化整个文档或选中的范围

### 实现方式

在扩展的 Rust 代码中，通过 `language_server_command` 方法启动语言服务器：

```rust
impl zed::Extension for MyExtension {
    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        Ok(zed::Command {
            command: get_path_to_language_server_executable()?,
            args: vec![/* 启动参数 */],
            env: vec![/* 环境变量 */],
        })
    }
}
```

如果语言服务器实现了格式化功能，Zed 会自动检测并启用。

## 2. 外部格式化工具

### 配置方式

用户可以在 `settings.json` 中为特定语言配置外部格式化工具：

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": {
        "external": {
          "command": "prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}", "--parser", "typescript"]
        }
      }
    }
  }
}
```

### 可用的占位符

在 `arguments` 中可以使用以下占位符：
- `{buffer_path}`: 文件的完整路径
- `{worktree_root}`: 工作区根目录路径

### 格式化工具示例

常用的 JavaScript/TypeScript 格式化工具配置：

#### Prettier

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": {
        "external": {
          "command": "prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}"]
        }
      }
    }
  }
}
```

#### ESLint (作为格式化工具)

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": {
        "external": {
          "command": "eslint",
          "arguments": ["--fix", "--stdin", "--stdin-filename", "{buffer_path}"]
        }
      }
    }
  }
}
```

## 3. 代码操作格式化

### 概念

代码操作（Code Actions）是 LSP 提供的一种功能，允许在格式化时执行特定的代码修复操作。

### 配置方式

```json
{
  "languages": {
    "ArkTS Language": {
      "code_actions_on_format": {
        "source.fixAll.eslint": true,
        "source.organizeImports": true
      }
    }
  }
}
```

### 常见代码操作

- `source.fixAll.eslint`: 使用 ESLint 修复所有可自动修复的问题
- `source.organizeImports`: 组织和排序 import 语句
- `source.fixAll`: 修复所有可自动修复的问题

### 执行顺序

当同时配置了多种格式化方式时，执行顺序如下：

1. 代码操作（code_actions_on_format）
2. 外部格式化工具（external formatter）
3. 语言服务器格式化（LSP formatting）

## 4. 语言配置选项

在 `languages/arkts/config.toml` 中可以配置与格式化相关的选项：

```toml
name = "ArkTS Language"
grammar = "arkts"
path_suffixes = ["ets"]
line_comments = ["// "]
tab_size = 2
hard_tabs = false

# 支持 Prettier 解析器名称（可选）
prettier_parser_name = "typescript"
```

### 配置选项说明

- `tab_size`: 缩进大小（默认为 4）
- `hard_tabs`: 是否使用 Tab 字符缩进（true）还是空格（false，默认）
- `prettier_parser_name`: 如果使用 Prettier，指定使用的解析器名称
- `line_comments`: 行注释符号，用于 toggle comments 功能

## 5. 禁用格式化

### 完全禁用

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": []
    }
  }
}
```

### 仅禁用保存时格式化

```json
{
  "languages": {
    "ArkTS Language": {
      "format_on_save": "off"
    }
  }
}
```

这样配置后，保存时不会自动格式化，但仍可以手动执行格式化命令。

## 6. ArkTS 扩展的格式化实现建议

基于 ArkTS 是 TypeScript 的超集，建议采用以下方案：

### 方案 1：依赖语言服务器格式化（推荐）

由于 ArkTS 语言服务器基于 TypeScript 语言服务器，它应该已经包含了格式化功能。

**优点**：
- 无需额外配置
- 与语言服务器的其他功能集成良好
- 格式化规则与语言服务器的类型检查一致

**实现**：
- 确保语言服务器正确启动
- 语言服务器自动提供格式化功能

### 方案 2：使用 Prettier 外部格式化

Prettier 是 JavaScript/TypeScript 生态系统中最流行的代码格式化工具。

**优点**：
- 格式化结果一致
- 社区广泛使用
- 支持多种文件类型
- 可配置规则

**实现**：

用户需要在项目中安装 Prettier：

```bash
npm install --save-dev prettier
```

然后在 Zed 的 `settings.json` 中配置：

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": {
        "external": {
          "command": "node_modules/.bin/prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}", "--parser", "typescript"]
        }
      }
    }
  }
}
```

### 方案 3：结合代码操作和格式化

同时使用代码操作和格式化工具：

```json
{
  "languages": {
    "ArkTS Language": {
      "code_actions_on_format": {
        "source.organizeImports": true
      },
      "formatter": {
        "external": {
          "command": "prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}", "--parser", "typescript"]
        }
      }
    }
  }
}
```

## 7. 扩展 API 方法

虽然当前的 `zed_extension_api` 主要关注语言服务器的启动和配置，但可以通过以下方法影响格式化行为：

### `language_server_initialization_options`

通过初始化选项配置语言服务器的格式化行为：

```rust
fn language_server_initialization_options(
    &mut self,
    _language_server_id: &LanguageServerId,
    worktree: &Worktree,
) -> Result<Option<Value>, String> {
    let mut options = LspSettings::for_worktree("arkts-language-server", worktree)
        .ok()
        .and_then(|settings| settings.initialization_options)
        .unwrap_or_default();
    
    // 可以在这里添加格式化相关的配置
    // 例如：options["formatting"] = json!({"enable": true});
    
    Ok(Some(options))
}
```

### `label_for_completion` 和其他方法

这些方法主要用于自定义补全和其他 LSP 功能的显示，不直接影响格式化。

## 8. 实践建议

### 项目级配置

在项目根目录创建 `.prettierrc` 或其他格式化工具的配置文件：

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### 团队协作

1. 在项目的 `.zed/settings.json` 中配置格式化选项
2. 将配置文件提交到版本控制系统
3. 团队成员统一使用相同的格式化配置

### 性能考虑

- 对于大文件，外部格式化工具可能比语言服务器格式化更快
- 可以通过配置只在保存时格式化选中的范围来提高性能

## 9. 常见问题

### Q: 如何确定语言服务器是否支持格式化？

A: 查看语言服务器的文档或在启动时查看其 capabilities。大多数基于 TypeScript 的语言服务器都支持格式化。

### Q: 外部格式化工具找不到？

A: 确保格式化工具已安装且在 PATH 中，或使用绝对路径：

```json
{
  "formatter": {
    "external": {
      "command": "/usr/local/bin/prettier",
      "arguments": ["--stdin-filepath", "{buffer_path}"]
    }
  }
}
```

### Q: 格式化和语言服务器冲突？

A: 可以禁用语言服务器的格式化功能，只使用外部工具：

```json
{
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "formatting": false
      }
    }
  },
  "languages": {
    "ArkTS Language": {
      "formatter": {
        "external": {
          "command": "prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}"]
        }
      }
    }
  }
}
```

## 10. 自定义格式化命令与 LSP 集成

### Zed 的格式化命令系统

Zed **没有提供扩展级别的自定义格式化命令 API**。格式化功能完全通过配置实现，而不是通过扩展代码。这种设计有以下优点：

1. **用户可控**：用户可以根据项目需求自由选择格式化工具
2. **简化扩展开发**：扩展开发者无需实现格式化逻辑
3. **统一配置**：所有格式化配置都在 `settings.json` 中管理

### 格式化的优先级和集成

虽然扩展不能直接提供格式化命令，但可以通过以下方式影响格式化行为：

#### 1. LSP 格式化（自动集成）

当扩展提供语言服务器时，如果该语言服务器实现了 LSP 格式化能力：
- Zed 会自动检测并启用格式化功能
- 用户无需额外配置即可使用
- 这是**最推荐**的集成方式

```rust
// 扩展代码只需启动语言服务器
impl zed::Extension for MyExtension {
    fn language_server_command(&mut self, ...) -> Result<zed::Command> {
        Ok(zed::Command {
            command: "path/to/language-server",
            args: vec!["--stdio"],
            env: vec![],
        })
    }
}
```

语言服务器的格式化能力会自动被 Zed 使用。

#### 2. 用户配置外部格式化工具（覆盖 LSP）

用户可以在 `settings.json` 中配置外部格式化工具，这会**覆盖**语言服务器的格式化：

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": {
        "external": {
          "command": "prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}"]
        }
      }
    }
  }
}
```

#### 3. 代码操作与格式化协同

代码操作（Code Actions）可以与格式化协同工作：

```json
{
  "languages": {
    "ArkTS Language": {
      "code_actions_on_format": {
        "source.organizeImports": true,
        "source.fixAll.eslint": true
      },
      "formatter": "language_server"  // 或 "auto"
    }
  }
}
```

执行顺序：
1. 先执行代码操作（如组织 imports）
2. 再执行格式化（外部工具或 LSP）

### 格式化选择策略

Zed 按以下优先级选择格式化方式：

1. **用户明确配置的外部格式化工具** (`formatter.external`)
2. **语言服务器提供的格式化** (如果 `formatter: "language_server"` 或 `"auto"`)
3. **默认行为**：尝试使用语言服务器格式化

```json
// 格式化配置的不同模式
{
  "languages": {
    "ArkTS Language": {
      // 模式 1: 自动选择（默认）
      "formatter": "auto",  // 优先使用 LSP，如果可用
      
      // 模式 2: 仅使用语言服务器
      "formatter": "language_server",
      
      // 模式 3: 使用外部工具
      "formatter": {
        "external": {
          "command": "prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}"]
        }
      },
      
      // 模式 4: 禁用格式化
      "formatter": []
    }
  }
}
```

### 扩展开发者的建议

对于 ArkTS 扩展开发者：

1. **确保语言服务器提供格式化功能**
   - 这是最简单和最有效的方式
   - 用户可以立即使用，无需额外配置

2. **在文档中说明如何配置替代格式化工具**
   - 提供 Prettier、ESLint 等工具的配置示例
   - 说明何时应该使用外部工具而不是 LSP

3. **不要尝试在扩展代码中实现格式化**
   - Zed 的扩展 API 不支持自定义格式化命令
   - 所有格式化应该通过 LSP 或用户配置实现

### 实际案例：ArkTS 的格式化支持

ArkTS 扩展的格式化工作流程：

```
用户保存文件
    ↓
Zed 检查 settings.json
    ↓
是否配置了外部格式化工具？
    ├─ 是 → 使用外部工具（如 Prettier）
    └─ 否 → 检查语言服务器是否支持格式化
           ├─ 是 → 使用 LSP 格式化（ArkTS LS 提供）
           └─ 否 → 跳过格式化
```

由于 ArkTS 语言服务器基于 TypeScript 语言服务器，它已经内置了格式化功能，因此：
- **开箱即用**：用户安装扩展后即可使用格式化
- **可自定义**：用户可以配置 Prettier 等工具覆盖默认行为
- **无需扩展代码**：所有格式化逻辑由 LSP 或外部工具处理

## 11. 参考资源

- [Zed Language Extensions 文档](https://zed.dev/docs/extensions/languages)
- [Language Server Protocol 规范](https://microsoft.github.io/language-server-protocol/)
- [Prettier 文档](https://prettier.io/docs/en/index.html)
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)

## 总结

Zed 的语言扩展系统为代码格式化提供了灵活的支持机制：

1. **自动支持**：如果语言服务器实现了 LSP 格式化功能，无需额外配置
2. **灵活配置**：支持配置外部格式化工具，满足不同项目需求
3. **代码操作**：支持在格式化时执行其他代码修复操作
4. **用户控制**：用户可以完全控制格式化行为，包括禁用或自定义

对于 ArkTS 扩展，建议优先依赖语言服务器的格式化功能，同时在文档中说明如何配置 Prettier 等外部工具作为备选方案。
