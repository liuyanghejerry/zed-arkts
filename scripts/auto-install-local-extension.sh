#!/bin/bash
# 自动化安装本地扩展到 Zed
# Automated local extension installation for Zed

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Automating extension installation...${NC}"

# 1. 构建扩展
echo "[1/4] Building extension..."
cargo build --release

if [ $? -ne 0 ]; then
    echo "✗ Build failed"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"

# 2. 确定扩展目录
if [[ "$OSTYPE" == "darwin"* ]]; then
    ZED_EXT_DIR="$HOME/Library/Application Support/Zed/extensions/installed/arkts"
else
    ZED_EXT_DIR="$HOME/.config/zed/extensions/installed/arkts"
fi

echo "[2/4] Installing to $ZED_EXT_DIR..."

# 3. 创建扩展目录并复制文件
mkdir -p "$ZED_EXT_DIR"

# 复制编译后的库
if [[ "$OSTYPE" == "darwin"* ]]; then
    cp target/release/libzed_arkts.dylib "$ZED_EXT_DIR/" 2>/dev/null || echo "⚠ No dylib found"
else
    cp target/release/libzed_arkts.so "$ZED_EXT_DIR/" 2>/dev/null || echo "⚠ No so file found"
fi

# 复制配置和资源
cp extension.toml "$ZED_EXT_DIR/"
cp -r languages "$ZED_EXT_DIR/" 2>/dev/null || true
cp -r assets "$ZED_EXT_DIR/" 2>/dev/null || true

# 复制语言服务器
cp -r zed-ets-language-server "$ZED_EXT_DIR/"

echo -e "${GREEN}✓ Files copied${NC}"

# 4. 创建扩展元数据
cat > "$ZED_EXT_DIR/manifest.json" << EOF
{
  "id": "arkts",
  "name": "ArkTS",
  "version": "0.2.0",
  "schema_version": 1,
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "installation_method": "automated"
}
EOF

echo "[3/4] Created manifest..."

# 5. 设置配置
CONFIG_DIR="$HOME/.config/zed"
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_DIR="$HOME/Library/Application Support/Zed"
fi

mkdir -p "$CONFIG_DIR"

# 如果配置文件不存在，创建一个
if [ ! -f "$CONFIG_DIR/settings.json" ]; then
    cat > "$CONFIG_DIR/settings.json" << 'EOF'
{
  "lsp": {
    "arkts-language-server": {
      "initialization_options": {
        "tsdk": "/usr/local/lib/node_modules/typescript/lib",
        "ohosSdkPath": "/opt/OpenHarmony/sdk"
      }
    }
  }
}
EOF
    echo -e "${GREEN}✓ Created default settings.json${NC}"
else
    echo "⚠ settings.json already exists, skipping configuration"
fi

echo "[4/4] Installation complete!"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Extension installed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Extension directory: $ZED_EXT_DIR"
echo "Config directory: $CONFIG_DIR"
echo ""
echo "Next steps:"
echo "  1. Restart Zed if it's running"
echo "  2. Open an ArkTS project (.ets files)"
echo "  3. Verify LSP features work"
echo ""
echo "To test with sample project:"
echo "  zed test-fixtures/arkts-sample-project"
