#!/bin/bash

set -e

# Build script for ArkTS Zed extension
echo "Building ArkTS Zed extension..."

# Build the Rust extension
cargo build --release

# Create output directory
mkdir -p dist

# Copy the compiled library
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    cp target/release/libarkts_zed.dylib dist/arkts_zed.dylib
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    cp target/release/libarkts_zed.so dist/arkts_zed.so
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows
    cp target/release/arkts_zed.dll dist/arkts_zed.dll
fi

cp extension.toml dist/
cp -r languages dist/

echo "Extension built successfully!"
echo "Library file: dist/ets_zed.*"
echo "Copy the contents of 'dist' to your Zed extensions directory:"
echo "  ~/.config/zed/extensions/ (Linux)"
echo "  ~/Library/Application Support/Zed/extensions/ (macOS)"
echo "  %APPDATA%\\Zed\\extensions\\ (Windows)"
