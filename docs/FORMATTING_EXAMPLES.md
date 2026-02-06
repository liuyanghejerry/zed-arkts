# ArkTS 代码格式化配置示例

这个文件提供了一些常见的 ArkTS 代码格式化配置示例。

## 1. 使用语言服务器的默认格式化（推荐）

最简单的方式是依赖 ArkTS 语言服务器的内置格式化功能。无需额外配置，只需确保语言服务器已正确设置：

```json
{
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "tsdk": "/path/to/typescript/lib",
        "ohosSdkPath": "/path/to/OpenHarmony/xx"
      }
    }
  }
}
```

## 2. 使用 Prettier 格式化

如果你的项目使用 Prettier，可以配置如下：

### 步骤 1: 安装 Prettier

在你的项目中安装 Prettier：

```bash
npm install --save-dev prettier
```

### 步骤 2: 创建 Prettier 配置文件

在项目根目录创建 `.prettierrc` 文件：

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### 步骤 3: 配置 Zed

在 Zed 的 `settings.json` 中添加：

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

或者使用全局安装的 Prettier：

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

## 3. 结合代码操作和格式化

同时使用代码操作（如组织 imports）和格式化：

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

## 4. 使用 ESLint 进行格式化和修复

如果你的项目使用 ESLint，可以配置 ESLint 在保存时自动修复代码：

### 步骤 1: 安装 ESLint

```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### 步骤 2: 创建 ESLint 配置文件

在项目根目录创建 `.eslintrc.json` 文件：

```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "semi": ["error", "always"],
    "quotes": ["error", "single"]
  }
}
```

### 步骤 3: 配置 Zed

```json
{
  "languages": {
    "ArkTS Language": {
      "code_actions_on_format": {
        "source.fixAll.eslint": true
      }
    }
  }
}
```

## 5. 禁用自动格式化

如果你不想在保存时自动格式化，但保留手动格式化的能力：

```json
{
  "languages": {
    "ArkTS Language": {
      "format_on_save": "off"
    }
  }
}
```

## 6. 完全禁用格式化

如果你不想使用任何格式化功能：

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": []
    }
  }
}
```

## 7. 项目级配置

你可以在项目根目录创建 `.zed/settings.json` 文件，为项目配置特定的格式化设置：

```json
{
  "languages": {
    "ArkTS Language": {
      "tab_size": 2,
      "hard_tabs": false,
      "formatter": {
        "external": {
          "command": "node_modules/.bin/prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}", "--parser", "typescript"]
        }
      },
      "code_actions_on_format": {
        "source.organizeImports": true
      }
    }
  },
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "tsdk": "node_modules/typescript/lib",
        "ohosSdkPath": "/path/to/OpenHarmony/xx"
      }
    }
  }
}
```

## 8. 团队协作配置

为了确保团队成员使用一致的格式化配置：

1. 在项目根目录创建 `.zed/settings.json`
2. 创建 `.prettierrc` 或 `.eslintrc.json` 配置文件
3. 将这些配置文件提交到版本控制系统
4. 在 README 中说明需要的格式化工具和配置

## 故障排除

### Prettier 找不到

如果 Prettier 命令找不到，尝试使用绝对路径：

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": {
        "external": {
          "command": "/usr/local/bin/prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}", "--parser", "typescript"]
        }
      }
    }
  }
}
```

### 格式化冲突

如果语言服务器的格式化和外部工具冲突，可以禁用语言服务器的格式化：

```json
{
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "tsdk": "/path/to/typescript/lib",
        "ohosSdkPath": "/path/to/OpenHarmony/xx",
        "preferences": {
          "disableFormatting": true
        }
      }
    }
  }
}
```

## 参考资源

- [完整格式化文档](FORMATTING.md)
- [Prettier 文档](https://prettier.io/docs/en/index.html)
- [ESLint 文档](https://eslint.org/docs/latest/)
- [Zed 设置参考](https://zed.dev/docs/reference/all-settings)
