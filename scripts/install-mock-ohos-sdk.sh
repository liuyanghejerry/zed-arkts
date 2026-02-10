#!/bin/bash
# 安装 OpenHarmony SDK (轻量级 Mock 版本用于测试)
# Install OpenHarmony SDK (Lightweight Mock for Testing)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

MOCK_SDK_DIR="${1:-/tmp/mock-openharmony-sdk}"

echo -e "${YELLOW}Creating mock OpenHarmony SDK at $MOCK_SDK_DIR...${NC}"

# 创建目录结构
mkdir -p "$MOCK_SDK_DIR/"{api,toolchains,ets/lib,ets/build-tools/ets-loader/declarations,ets/component,previewer,build-tools}

# 创建 API 定义
cat > "$MOCK_SDK_DIR/api/common.d.ts" << 'EOF'
declare namespace ohos {
  export interface Component {}
  export interface State {}
  export interface Prop {}
}

declare function Component(target: any): any;
declare function Entry(target: any): any;
declare function State(target: any, propertyKey: string): any;
declare function Prop(target: any, propertyKey: string): any;
EOF

# 创建 ETS 类型定义
cat > "$MOCK_SDK_DIR/ets/lib/lib.ets.d.ts" << 'EOF'
// ArkTS Standard Library Definitions

declare const console: Console;

declare interface Console {
  log(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

declare namespace router {
  function pushUrl(options: { url: string }): void;
  function back(): void;
}

// UI Components
declare class Text {
  constructor(content: string);
  fontSize(size: number): Text;
  fontWeight(weight: FontWeight): Text;
  fontColor(color: string): Text;
}

declare class Button {
  constructor(content: string);
  onClick(handler: () => void): Button;
}

declare class Column {
  constructor(options?: { space?: number });
  width(value: string | number): Column;
  height(value: string | number): Column;
  padding(value: number): Column;
  justifyContent(align: FlexAlign): Column;
}

declare class Row {
  constructor(options?: { space?: number });
}

declare enum FontWeight {
  Normal,
  Bold,
  Lighter,
  Medium,
  Regular
}

declare enum FlexAlign {
  Start,
  Center,
  End,
  SpaceBetween,
  SpaceAround,
  SpaceEvenly
}
EOF

# 创建包信息
cat > "$MOCK_SDK_DIR/package.json" << EOF
{
  "name": "openharmony-sdk-mock",
  "version": "4.1.0",
  "description": "Mock OpenHarmony SDK for testing purposes",
  "type": "mock"
}
EOF

# 创建版本信息
cat > "$MOCK_SDK_DIR/version.txt" << EOF
OpenHarmony SDK (Mock)
Version: 4.1.0
API Level: 10
Build: mock-20240210
Type: Testing/Development
EOF

# 创建工具链脚本
cat > "$MOCK_SDK_DIR/toolchains/hvigor" << 'EOF'
#!/bin/bash
echo "Mock hvigor toolchain"
EOF
chmod +x "$MOCK_SDK_DIR/toolchains/hvigor"

cat > "$MOCK_SDK_DIR/toolchains/ohpm" << 'EOF'
#!/bin/bash
echo "Mock ohpm package manager"
case "$1" in
  "install")
    echo "Mock: Installing dependencies..."
    ;;
  "version")
    echo "Mock OHPM 4.1.0"
    ;;
  *)
    echo "Mock ohpm: $@"
    ;;
esac
EOF
chmod +x "$MOCK_SDK_DIR/toolchains/ohpm"

# 创建占位符文件避免警告
touch "$MOCK_SDK_DIR/ets/build-tools/ets-loader/declarations/.gitkeep"
touch "$MOCK_SDK_DIR/ets/component/.gitkeep"

echo -e "${GREEN}✓ Mock OpenHarmony SDK created successfully!${NC}"
echo ""
echo "SDK Location: $MOCK_SDK_DIR"
echo "API Definitions: $MOCK_SDK_DIR/api/"
echo "ETS Lib: $MOCK_SDK_DIR/ets/lib/"
echo ""
echo "To use this SDK, set the environment variable:"
echo "  export OHOS_SDK_PATH=\"$MOCK_SDK_DIR\""
echo ""
echo "Or configure in Zed settings.json:"
echo "  \"ohosSdkPath\": \"$MOCK_SDK_DIR\""
