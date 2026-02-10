#!/bin/bash

# Script to run formatting-specific tests for the ArkTS extension

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LSP_SERVER_DIR="$PROJECT_ROOT/zed-ets-language-server"

echo "================================"
echo "Running Formatting Tests"
echo "================================"
echo ""

# Navigate to language server directory
cd "$LSP_SERVER_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "Running formatting-specific tests..."
echo ""

# Run only the formatting tests
npx vitest run tests/integration/formatting.test.js

echo ""
echo "================================"
echo "Formatting Tests Complete"
echo "================================"
