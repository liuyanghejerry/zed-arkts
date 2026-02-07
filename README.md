# ArkTS Extension

A Zed extension for ArkTS (aka.ETS) development support.

This project is based on [Million-mo/tree-sitter-arkts](https://github.com/Million-mo/tree-sitter-arkts) and [ohosvscode/arkTS](https://github.com/ohosvscode/arkTS). Thanks for offering an excellent foundation for ArkTS.

## Features

- **Syntax Highlighting**: Provides TypeScript-based syntax highlighting for ETS files
- **Language Server**: Provides basic language server support, such as go to definition, and find references.

![Module definition](assets/screenshot-1.jpg)
![Symbol definition](assets/screenshot-1.jpg)

## Current Status

This is a **Zed language extension** that provides:

- File type detection (`.ets` → ETS language)
- Syntax highlighting extending TypeScript grammar
- Go to definition
- Find references
- Module definition
- Code formatting support (via Language Server or external tools)

## Plans
- Compatible with more Node.js versions.
- Autocomplete.
- JSON5 schemas support for `oh-package.json5`.

## Non-goals
- Debuggers.
- Code snippets.
- OpenHarmony SDK management.

## Installation

### From Source

You need a Node.js environment to build this extension. Prefer Node.js 24 currently.

1. Clone this repository
2. Open extension page in Zed and install extension from directory

## Configuration

All you need is to put language server settings in zed's `settings.json`:

```json5
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

- `tsdk`: Path to typescript declarations.
- `ohosSdkPath` Path to certain Harmony SDK.

### Code Formatting

The extension supports code formatting through multiple methods. See [docs/FORMATTING.md](docs/FORMATTING.md) for detailed information.

#### Using Language Server Formatting

The ArkTS language server provides built-in formatting support through the custom `ets/formatDocument` request. The extension automatically forwards standard LSP formatting requests to this custom endpoint, so no additional configuration is required. Simply use Zed's standard formatting commands (e.g., format on save or manual format).

#### Using External Formatters (e.g., Prettier)

You can configure external formatters in your `settings.json`:

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

For more formatting options and configuration examples, please refer to [docs/FORMATTING.md](docs/FORMATTING.md).

## Development

```bash
# Build in development mode
cargo build

# Build for release
cargo build --release

# Use the build script
./build.sh
```

## License

MIT License - see LICENSE file for details
