# ArkTS Zed Extension

A Zed extension for ArkTS (aka.ETS) development support.

This project is based on [Million-mo/tree-sitter-arkts](https://github.com/Million-mo/tree-sitter-arkts). Thanks for offering an excellent foundation for ArkTS highlighting.

## Features

- **Language Detection**: Automatically recognizes `.ets` files as ETS language
- **Syntax Highlighting**: Provides TypeScript-based syntax highlighting for ETS files
- **Proper Zed Extension Structure**: Follows Zed extension conventions

## Current Status

This is a **complete Zed language extension** that provides:

- File type detection (`.ets` → ETS language)
- Syntax highlighting extending TypeScript grammar
- Proper Zed extension manifest and structure

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
   cp -r dist/* ~/.config/zed/extensions/ets-zed/
   # or on macOS:
   cp -r dist/* ~/Library/Application\ Support/Zed/extensions/ets-zed/
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
