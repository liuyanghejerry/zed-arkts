#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Installing ETS Zed extension...${NC}"

# 检查 dist 目录是否存在
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist/ directory not found. Please run ./build.sh first.${NC}"
    exit 1
fi

# 检查必要文件是否存在
required_files=("config.toml" "extension.toml")
for file in "${required_files[@]}"; do
    if [ ! -f "dist/$file" ]; then
        echo -e "${RED}❌ Error: Required file dist/$file not found.${NC}"
        echo -e "${YELLOW}💡 Please ensure the build completed successfully.${NC}"
        exit 1
    fi
done

# 创建扩展目录 (使用正确的扩展名)
EXTENSION_DIR="$HOME/Library/Application Support/Zed/extensions/ets-zed"
mkdir -p "$EXTENSION_DIR"

echo -e "${YELLOW}📁 Installing to: $EXTENSION_DIR${NC}"

# 复制所有文件到扩展目录
cp -r dist/* "$EXTENSION_DIR/"

# 验证安装
if [ -f "$EXTENSION_DIR/config.toml" ] && [ -f "$EXTENSION_DIR/extension.toml" ]; then
    echo -e "${GREEN}✅ ETS extension installed successfully!${NC}"
    echo -e "${YELLOW}🔄 Please restart Zed to activate the extension.${NC}"
else
    echo -e "${RED}❌ Installation verification failed.${NC}"
    exit 1
fi
