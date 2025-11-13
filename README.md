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

## Plans
- Compatible with more Node.js versions.
- Autocomplete.
- JSON5 schemas support for `oh-package.json5`.
- Code actions, like formatting.

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

TODO

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
