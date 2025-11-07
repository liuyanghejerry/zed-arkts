# ArkTS Extension

A Zed extension for ArkTS (aka.ETS) development support.

This project is based on [Million-mo/tree-sitter-arkts](https://github.com/Million-mo/tree-sitter-arkts). Thanks for offering an excellent foundation for ArkTS highlighting.

## Features

- **Syntax Highlighting**: Provides TypeScript-based syntax highlighting for ETS files

## Current Status

This is a **Zed language extension** that provides:

- File type detection (`.ets` → ETS language)
- Syntax highlighting extending TypeScript grammar
- Proper Zed extension manifest and structure

## Plans
- Language server integration.

## Installation

### From Source

1. Install Rust: https://rustup.rs/
2. Clone this repository
3. Build the extension:
   ```bash
   ./build.sh
   # or manually:
   # cargo build --release
   ```
4. Copy the contents of `dist/` to your Zed extensions directory:

   ```
   cp -r dist/* ~/.config/zed/extensions/arkts/
   # or on macOS:
   cp -r dist/* ~/Library/Application\ Support/Zed/extensions/arkts/
   ```

   - **Linux**: `~/.config/zed/extensions/`
   - **macOS**: `~/Library/Application Support/Zed/extensions/`
   - **Windows**: `%APPDATA%\Zed\extensions\`

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
