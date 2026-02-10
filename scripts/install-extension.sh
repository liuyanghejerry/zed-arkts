#!/bin/bash
# 自动安装扩展到 Zed

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Installing ArkTS extension to Zed...${NC}"

# 构建扩展
echo "Building extension..."
cargo build --release

# 确定扩展目录（支持 Linux 和 macOS）
if [[ "$OSTYPE" == "darwin"* ]]; then
    ZED_EXTENSIONS_DIR="$HOME/Library/Application Support/Zed/extensions"
else
    ZED_EXTENSIONS_DIR="$HOME/.config/zed/extensions"
fi

EXTENSION_DIR="$ZED_EXTENSIONS_DIR/installed/arkts"

# 创建扩展目录
mkdir -p "$EXTENSION_DIR"

echo "Copying extension files to $EXTENSION_DIR..."

# 复制编译后的库文件
if [[ "$OSTYPE" == "darwin"* ]]; then
    cp target/release/libzed_arkts.dylib "$EXTENSION_DIR/" 2>/dev/null || true
else
    cp target/release/libzed_arkts.so "$EXTENSION_DIR/" 2>/dev/null || true
fi

# 复制配置和资源
cp extension.toml "$EXTENSION_DIR/"
cp -r languages "$EXTENSION_DIR/" 2>/dev/null || true
cp -r assets "$EXTENSION_DIR/" 2>/dev/null || true

# 复制语言服务器包装器
mkdir -p "$EXTENSION_DIR/zed-ets-language-server"
cp -r zed-ets-language-server/* "$EXTENSION_DIR/zed-ets-language-server/"

echo -e "${GREEN}✓ Extension installed successfully${NC}"
echo ""
echo "To use the extension:"
echo "  1. Restart Zed"
echo "  2. Open an ArkTS project (.ets files)"
echo "  3. Configure LSP settings in Zed's settings.json:"
echo ""
echo "     {"
echo "       \"lsp\": {"
echo "         \"arkts-language-server\": {"
echo "           \"initialization_options\": {"
echo "             \"tsdk\": \"/path/to/typescript/lib\","
echo "             \"ohosSdkPath\": \"/path/to/OpenHarmony/sdk\""
echo "           }"
echo "         }"
echo "       }"
echo "     }"
echo ""
echo "Test with the sample project:"
echo "  Open: test-fixtures/arkts-sample-project in Zed"
