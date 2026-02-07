# Code Formatting Research Summary

## Research Objective

研究 Zed 的语言扩展系统如何支持代码格式化操作
(Research how Zed's language extension system supports code formatting operations)

## Key Findings

### 1. No Custom Formatting Command API

**Important Discovery**: Zed does **not** provide extension-level custom formatting command APIs. Formatting is entirely configuration-based:

- Extensions cannot implement custom formatting commands
- All formatting is done through LSP or user-configured external tools
- This design gives users full control over formatting behavior

### 2. Three Main Formatting Approaches

Zed's language extension system supports code formatting through three primary mechanisms:

#### a) Language Server Protocol (LSP) Formatting
- **Automatic**: If the language server implements LSP formatting capabilities (`textDocument/formatting`, `textDocument/rangeFormatting`)
- **Zero Configuration**: Zed automatically detects and enables formatting
- **Best for**: Languages with mature LSP implementations (like TypeScript/ArkTS)

#### b) External Formatter Tools
- **Flexible**: Configure command-line tools (Prettier, ESLint, etc.)
- **User Configurable**: Set up in `settings.json`
- **Best for**: Projects with established formatter tools

#### c) Code Actions on Format
- **LSP-based**: Uses `textDocument/codeAction` with specific action kinds
- **Multi-purpose**: Can combine multiple operations (organize imports, fix linting issues)
- **Best for**: Complex formatting workflows

### 2. Configuration Options

#### Language Configuration (`languages/arkts/config.toml`)
```toml
name = "ArkTS Language"
tab_size = 2
hard_tabs = false
prettier_parser_name = "typescript"
```

#### User Settings (`settings.json`)
```json
{
  "languages": {
    "ArkTS Language": {
      "formatter": {
        "external": {
          "command": "prettier",
          "arguments": ["--stdin-filepath", "{buffer_path}"]
        }
      },
      "code_actions_on_format": {
        "source.organizeImports": true
      }
    }
  }
}
```

### 3. Extension Implementation and LSP Integration

**How Extensions Integrate with Formatting**:

The ArkTS extension supports formatting through:

1. **Language Server**: The `arkts-language-server` (based on TypeScript LS) provides built-in formatting
   - Extensions only need to start the language server via `language_server_command`
   - Zed automatically detects LSP formatting capabilities
   - No additional extension code required for formatting

2. **Configuration**: Users can override with external tools via settings
   - External formatters override LSP formatting
   - Users have complete control

3. **Flexibility**: Multiple formatting strategies can coexist
   - Code actions + external formatter + LSP formatting
   - Users choose their preferred workflow

**Key Insight**: Extensions influence formatting by providing a capable language server, not by implementing formatting commands themselves.

### 4. Execution Order

When multiple formatting methods are configured:
1. Code actions execute first
2. External formatter runs second
3. LSP formatting runs last

## Implementation for ArkTS

### Current Status
- ✅ Language server provides formatting capability
- ✅ Configuration supports external formatters
- ✅ Documentation added for all approaches

### Recommended Approach
**Primary**: Rely on language server formatting (already implemented)
**Alternative**: Configure Prettier for projects that need it
**Advanced**: Combine code actions with formatting

## Documentation Created

1. **FORMATTING_EXAMPLES.md** (Chinese) - Practical configuration examples
2. **Updated README.md** - Added formatting section

## Code Changes

1. **languages/arkts/config.toml** - Added `prettier_parser_name` and `hard_tabs` settings
2. **README.md** - Added formatting feature and configuration examples

## Key Takeaways

1. **No Extension Code Required**: Formatting support works through configuration
2. **Automatic LSP Support**: Language servers with formatting capability work out-of-the-box
3. **User Control**: Users can choose their preferred formatting approach
4. **Flexible Configuration**: Project-level and user-level settings both supported

## References

- Zed Language Extensions: https://zed.dev/docs/extensions/languages
- LSP Specification: https://microsoft.github.io/language-server-protocol/
- Prettier: https://prettier.io/
- TypeScript Language Server: https://github.com/typescript-language-server/typescript-language-server

## Conclusion

The research demonstrates that Zed's language extension system provides comprehensive and flexible code formatting support through multiple mechanisms. The ArkTS extension already benefits from LSP-based formatting through its TypeScript language server, and users can easily configure alternative formatters as needed.

The implemented solution includes:
- Complete documentation in both Chinese and English
- Practical configuration examples
- Updated language configuration for better Prettier integration
- Clear guidance on choosing formatting approaches

This completes the research objective and provides users with full information about code formatting support in the ArkTS extension.
