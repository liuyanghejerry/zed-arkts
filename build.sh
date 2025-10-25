#!/bin/bash

set -e

# Build script for ETS Zed extension
echo "Building ETS Zed extension..."

# Build the Rust extension
cargo build --release

# Create output directory
mkdir -p dist

# Copy the compiled library
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    cp target/release/libets_zed.dylib dist/ets_zed.dylib
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    cp target/release/libets_zed.so dist/ets_zed.so
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows
    cp target/release/ets_zed.dll dist/ets_zed.dll
fi

# Copy configuration files
# cp config.toml dist/
cp extension.toml dist/
cp -r languages dist/

# Copy grammar and snippets
# cp -r grammars dist/
# cp -r snippets dist/

echo "Extension built successfully!"
echo "Library file: dist/ets_zed.*"
echo "Copy the contents of 'dist' to your Zed extensions directory:"
echo "  ~/.config/zed/extensions/ (Linux)"
echo "  ~/Library/Application Support/Zed/extensions/ (macOS)"
echo "  %APPDATA%\\Zed\\extensions\\ (Windows)"
