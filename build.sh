#!/bin/bash

set -e

# Build script for ArkTS Zed extension
echo "Building ArkTS Zed extension..."

# Build the Rust extension
cargo build --release

# Create output directory
mkdir -p dist
rm -rf dist/*

# Copy the compiled library
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    cp target/release/libzed_arkts.dylib dist/arkts.dylib
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    cp target/release/libzed_arkts.so dist/zed_arkts.so
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows
    cp target/release/zed_arkts.dll dist/zed_arkts.dll
fi

cp extension.toml dist/
cp -r languages dist/

echo "Extension built successfully!"
