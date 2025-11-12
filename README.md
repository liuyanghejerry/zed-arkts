# ArkTS Extension

A Zed extension for ArkTS (aka.ETS) development support.

This project is based on [Million-mo/tree-sitter-arkts](https://github.com/Million-mo/tree-sitter-arkts). Thanks for offering an excellent foundation for ArkTS highlighting.

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

## Plans
- Autocomplete.
- Code actions.
- Compatible with more Node.js versions.

## Installation

### From Source

You need a Node.js environment to build this extension. Prefer Node.js 24.

1. Clone this repository
2. Open extension page in Zed and install extension from directory

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
