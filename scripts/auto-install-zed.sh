#!/bin/bash
# 自动化安装 Zed 编辑器
# Automated Zed Editor Installation

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Installing Zed Editor...${NC}"

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)

# 检查 Zed 是否已安装
if command -v zed &> /dev/null; then
    echo -e "${GREEN}✓ Zed is already installed: $(zed --version)${NC}"
    exit 0
fi

# 根据系统安装
case "$OS" in
    "macos")
        echo "Installing Zed on macOS..."
        
        # 尝试使用 Homebrew
        if command -v brew &> /dev/null; then
            echo "Using Homebrew..."
            brew install --cask zed
        else
            echo "Homebrew not found. Using direct download..."
            ZED_VERSION="0.165.2"
            curl -L "https://github.com/zed-industries/zed/releases/download/v${ZED_VERSION}/Zed.dmg" -o /tmp/Zed.dmg
            hdiutil attach /tmp/Zed.dmg
            cp -R "/Volumes/Zed/Zed.app" /Applications/
            hdiutil detach "/Volumes/Zed"
            rm /tmp/Zed.dmg
            
            # 创建符号链接
            ln -sf /Applications/Zed.app/Contents/MacOS/zed /usr/local/bin/zed
        fi
        ;;
        
    "linux")
        echo "Installing Zed on Linux..."
        
        # 使用官方安装脚本
        curl -f https://zed.dev/install.sh | sh
        
        # 添加到 PATH
        if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
            export PATH="$HOME/.local/bin:$PATH"
        fi
        ;;
        
    *)
        echo -e "${RED}✗ Unsupported operating system: $OSTYPE${NC}"
        exit 1
        ;;
esac

# 验证安装
if command -v zed &> /dev/null; then
    echo -e "${GREEN}✓ Zed installed successfully!${NC}"
    echo "Version: $(zed --version)"
    echo "Location: $(which zed)"
else
    echo -e "${RED}✗ Zed installation failed${NC}"
    exit 1
fi
