# ETS Zed Extension

A Zed extension for ETS (Enhanced TypeScript) development support.

## Features

- **Language Detection**: Automatically recognizes `.ets` files as ETS language
- **Syntax Highlighting**: Provides TypeScript-based syntax highlighting for ETS files
- **Code Snippets**: Common ETS patterns and boilerplate code
- **Language Server Integration**: Ready for TypeScript language server
- **Proper Zed Extension Structure**: Follows Zed extension conventions

## Current Status

This is a **complete Zed language extension** that provides:
- File type detection (`.ets` → ETS language)
- Syntax highlighting extending TypeScript grammar
- Code snippets for common ETS patterns
- Configuration for language server integration
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

## Current Implementation

The extension currently exports C functions:
- `init()` - Extension initialization
- `language_for_file()` - Detects language for file paths

## Future Plans

- [ ] Full TypeScript Language Server integration
- [ ] ETS-specific language features
- [ ] Code completion and IntelliSense
- [ ] Custom syntax highlighting rules
- [ ] Build system integration
- [ ] ETS-specific commands and keybindings

## Contributing

Contributions are welcome! This is a good starting point for adding ETS support to Zed.

## License

MIT License - see LICENSE file for details