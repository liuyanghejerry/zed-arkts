# Code Formatting Support in Zed Language Extension System

This document explains how Zed editor's language extension system supports code formatting operations.

## Overview

Zed provides three main approaches to code formatting:

1. **Language Server Protocol (LSP) Formatting**
2. **External Command-Line Formatter**
3. **Code Actions on Format**

## 1. Language Server Formatting

### LSP Formatting Support

If a language server implements LSP formatting capabilities (`textDocument/formatting` and `textDocument/rangeFormatting`), Zed will automatically utilize these features.

### How It Works

When a language server starts and supports formatting:
- Zed automatically calls the language server's formatting function when saving files
- Users can manually trigger formatting via the `editor: format` command
- Supports formatting the entire document or selected ranges

### Implementation

In the extension's Rust code, start the language server via the `language_server_command` method:

```rust
impl zed::Extension for MyExtension {
    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        Ok(zed::Command {
            command: get_path_to_language_server_executable()?,
            args: vec![/* startup arguments */],
            env: vec![/* environment variables */],
        })
    }
}
```

If the language server implements formatting, Zed will automatically detect and enable it.

### ArkTS Custom Formatting Implementation

The ArkTS language server uses a custom `ets/formatDocument` request instead of the standard LSP `textDocument/formatting`. To integrate with Zed's standard formatting system, this extension's language server wrapper (`zed-ets-language-server`) automatically forwards standard LSP formatting requests to the ArkTS custom formatting endpoint.

**Forwarding Mechanism**:
- When Zed sends a `textDocument/formatting` request, the wrapper converts it to an `ets/formatDocument` request
- When Zed sends a `textDocument/rangeFormatting` request, it is also converted to an `ets/formatDocument` request
- Formatting results are returned to Zed in the standard LSP `TextEdit[]` format

This implementation ensures that:
- Users can use Zed's standard formatting commands
- No special configuration is required
- Full compatibility with ArkTS language server formatting capabilities

## 2. External Formatter

### Configuration

Users can configure external formatting tools for specific languages in `settings.json`:

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

### Available Placeholders

The following placeholders can be used in `arguments`:
- `{buffer_path}`: Full path to the file
- `{worktree_root}`: Path to the workspace root directory

### Formatter Examples

Common JavaScript/TypeScript formatter configurations:

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

#### ESLint (as formatter)

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

## 3. Code Actions on Format

### Concept

Code Actions are LSP features that allow executing specific code fix operations during formatting.

### Configuration

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

### Common Code Actions

- `source.fixAll.eslint`: Fix all auto-fixable issues using ESLint
- `source.organizeImports`: Organize and sort import statements
- `source.fixAll`: Fix all auto-fixable issues

### Execution Order

When multiple formatting methods are configured, they execute in this order:

1. Code actions (code_actions_on_format)
2. External formatter
3. Language server formatting (LSP formatting)

## 4. Language Configuration Options

Formatting-related options can be configured in `languages/arkts/config.toml`:

```toml
name = "ArkTS Language"
grammar = "arkts"
path_suffixes = ["ets"]
line_comments = ["// "]
tab_size = 2
hard_tabs = false

# Prettier parser name for external formatting
prettier_parser_name = "typescript"
```

### Configuration Options

- `tab_size`: Indentation size (default is 4)
- `hard_tabs`: Whether to use tab characters (true) or spaces (false, default)
- `prettier_parser_name`: Specify the parser name if using Prettier
- `line_comments`: Line comment symbols for toggle comments feature

## 5. Disabling Formatting

### Completely Disable

```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": []
    }
  }
}
```

### Disable Format on Save Only

```json
{
  "languages": {
    "ArkTS Language": {
      "format_on_save": "off"
    }
  }
}
```

This configuration disables automatic formatting on save but retains the ability to manually format.

## 6. Formatting Implementation Recommendations for ArkTS

Since ArkTS is a superset of TypeScript, the following approaches are recommended:

### Approach 1: Rely on Language Server Formatting (Recommended)

Since the ArkTS language server is based on the TypeScript language server, it should already include formatting capabilities.

**Advantages**:
- No additional configuration required
- Well integrated with other language server features
- Formatting rules consistent with language server type checking

**Implementation**:
- Ensure the language server starts correctly
- Language server automatically provides formatting

### Approach 2: Use Prettier External Formatting

Prettier is the most popular code formatting tool in the JavaScript/TypeScript ecosystem.

**Advantages**:
- Consistent formatting results
- Widely used in the community
- Supports multiple file types
- Configurable rules

**Implementation**:

Install Prettier in your project:

```bash
npm install --save-dev prettier
```

Configure in Zed's `settings.json`:

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

### Approach 3: Combine Code Actions and Formatting

Use both code actions and formatting tools:

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

## 7. Extension API Methods

While the current `zed_extension_api` primarily focuses on language server startup and configuration, formatting behavior can be influenced through:

### `language_server_initialization_options`

Configure language server formatting behavior through initialization options:

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
    
    // Add formatting-related configuration here
    // e.g., options["formatting"] = json!({"enable": true});
    
    Ok(Some(options))
}
```

## 8. Best Practices

### Project-Level Configuration

Create `.prettierrc` or other formatter configuration files in the project root:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Team Collaboration

1. Configure formatting options in the project's `.zed/settings.json`
2. Commit configuration files to version control
3. Team members use the same formatting configuration

### Performance Considerations

- For large files, external formatters may be faster than language server formatting
- Configure to format only selected ranges on save to improve performance

## 9. Common Issues

### Q: How to determine if the language server supports formatting?

A: Check the language server documentation or its capabilities at startup. Most TypeScript-based language servers support formatting.

### Q: External formatter not found?

A: Ensure the formatter is installed and in PATH, or use an absolute path:

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

### Q: Formatting conflicts with language server?

A: Disable language server formatting and use only external tools:

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

## 10. Custom Formatting Commands and LSP Integration

### Zed's Formatting Command System

Zed **does not provide extension-level custom formatting command APIs**. Formatting functionality is entirely configuration-based, not implemented through extension code. This design has the following advantages:

1. **User Control**: Users can freely choose formatting tools based on project needs
2. **Simplified Extension Development**: Extension developers don't need to implement formatting logic
3. **Unified Configuration**: All formatting configuration is managed in `settings.json`

### Formatting Priority and Integration

While extensions cannot directly provide formatting commands, they can influence formatting behavior through:

#### 1. LSP Formatting (Automatic Integration)

When an extension provides a language server that implements LSP formatting capabilities:
- Zed automatically detects and enables formatting
- Users can use it immediately without additional configuration
- This is the **recommended** integration approach

```rust
// Extension code only needs to start the language server
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

The language server's formatting capability is automatically used by Zed.

#### 2. User-Configured External Formatter (Overrides LSP)

Users can configure external formatting tools in `settings.json`, which **overrides** language server formatting:

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

#### 3. Code Actions Working with Formatting

Code Actions can work alongside formatting:

```json
{
  "languages": {
    "ArkTS Language": {
      "code_actions_on_format": {
        "source.organizeImports": true,
        "source.fixAll.eslint": true
      },
      "formatter": "language_server"  // or "auto"
    }
  }
}
```

Execution order:
1. Execute code actions first (e.g., organize imports)
2. Then execute formatting (external tool or LSP)

### Formatting Selection Strategy

Zed selects formatting methods in this priority order:

1. **User-explicitly configured external formatter** (`formatter.external`)
2. **Language server-provided formatting** (if `formatter: "language_server"` or `"auto"`)
3. **Default behavior**: Attempt to use language server formatting

```json
// Different formatting configuration modes
{
  "languages": {
    "ArkTS Language": {
      // Mode 1: Auto-select (default)
      "formatter": "auto",  // Prefer LSP if available
      
      // Mode 2: Use only language server
      "formatter": "language_server",
      
      // Mode 3: Use external tool
      "formatter": {
        "external": {
          "command": "prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}"]
        }
      },
      
      // Mode 4: Disable formatting
      "formatter": []
    }
  }
}
```

### Recommendations for Extension Developers

For ArkTS extension developers:

1. **Ensure the language server provides formatting capability**
   - This is the simplest and most effective approach
   - Users can use it immediately without additional configuration

2. **Document how to configure alternative formatting tools**
   - Provide configuration examples for Prettier, ESLint, etc.
   - Explain when external tools should be used instead of LSP

3. **Don't try to implement formatting in extension code**
   - Zed's extension API doesn't support custom formatting commands
   - All formatting should be implemented through LSP or user configuration

### Real-World Example: ArkTS Formatting Support

ArkTS extension formatting workflow:

```
User saves file
    ↓
Zed checks settings.json
    ↓
Is external formatter configured?
    ├─ Yes → Use external tool (e.g., Prettier)
    └─ No → Check if language server supports formatting
           ├─ Yes → Use LSP formatting (provided by ArkTS LS)
           └─ No → Skip formatting
```

Since the ArkTS language server is based on TypeScript language server, it has built-in formatting:
- **Works out of the box**: Users can format immediately after installing the extension
- **Customizable**: Users can configure Prettier or other tools to override default behavior
- **No extension code needed**: All formatting logic is handled by LSP or external tools

## 11. References

- [Zed Language Extensions Documentation](https://zed.dev/docs/extensions/languages)
- [Language Server Protocol Specification](https://microsoft.github.io/language-server-protocol/)
- [Prettier Documentation](https://prettier.io/docs/en/index.html)
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)

## Summary

Zed's language extension system provides flexible code formatting support:

1. **Automatic Support**: If the language server implements LSP formatting, no additional configuration needed
2. **Flexible Configuration**: Support for configuring external formatters to meet different project needs
3. **Code Actions**: Support executing other code fix operations during formatting
4. **User Control**: Users have complete control over formatting behavior, including disabling or customizing

For the ArkTS extension, it's recommended to primarily rely on language server formatting, while documenting how to configure Prettier and other external tools as alternative options.
