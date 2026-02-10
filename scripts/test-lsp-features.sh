#!/bin/bash
# 测试特定的 LSP 功能

set -e

PROJECT_DIR="$(pwd)/test-fixtures/arkts-sample-project"
LSP_SERVER_DIR="$(pwd)/zed-ets-language-server"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing LSP Features...${NC}"
echo ""

# 辅助函数：创建 LSP 消息
create_lsp_message() {
    local content="$1"
    local length=$(echo -n "$content" | wc -c)
    echo -e "Content-Length: $length\r\n\r\n$content"
}

# 辅助函数：发送 LSP 请求并获取响应
send_lsp_request() {
    local message="$1"
    local output=$(echo -e "$message" | timeout 3s node "$LSP_SERVER_DIR/index.js" 2>&1 || true)
    echo "$output"
}

# 测试 1: Initialize
echo -e "${YELLOW}Test 1: Initialize${NC}"
INIT_REQUEST='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":"file://'"$PROJECT_DIR"'","capabilities":{}}}'
INIT_MESSAGE=$(create_lsp_message "$INIT_REQUEST")
INIT_RESPONSE=$(send_lsp_request "$INIT_MESSAGE")

if echo "$INIT_RESPONSE" | grep -q "capabilities"; then
    echo -e "${GREEN}✓ Initialize request succeeded${NC}"
else
    echo -e "${RED}✗ Initialize request failed${NC}"
    echo "Response: $INIT_RESPONSE"
fi

# 测试 2: Initialized notification
echo ""
echo -e "${YELLOW}Test 2: Initialized notification${NC}"
INITIALIZED_NOTIF='{"jsonrpc":"2.0","method":"initialized","params":{}}'
INITIALIZED_MESSAGE=$(create_lsp_message "$INITIALIZED_NOTIF")
INITIALIZED_RESPONSE=$(send_lsp_request "$INITIALIZED_MESSAGE")
echo -e "${GREEN}✓ Initialized notification sent${NC}"

# 测试 3: textDocument/didOpen
echo ""
echo -e "${YELLOW}Test 3: textDocument/didOpen${NC}"
MAIN_ETS_CONTENT=$(cat "$PROJECT_DIR/src/main.ets" | sed 's/"/\\"/g' | tr '\n' ' ')
DIDOPEN_NOTIF='{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file://'"$PROJECT_DIR"'/src/main.ets","languageId":"arkts","version":1,"text":"'"$MAIN_ETS_CONTENT"'"}}}'
DIDOPEN_MESSAGE=$(create_lsp_message "$DIDOPEN_NOTIF")
DIDOPEN_RESPONSE=$(send_lsp_request "$DIDOPEN_MESSAGE")
echo -e "${GREEN}✓ didOpen notification sent${NC}"

# 测试 4: textDocument/definition (模拟)
echo ""
echo -e "${YELLOW}Test 4: textDocument/definition (sample request)${NC}"
DEFINITION_REQUEST='{"jsonrpc":"2.0","id":2,"method":"textDocument/definition","params":{"textDocument":{"uri":"file://'"$PROJECT_DIR"'/src/main.ets"},"position":{"line":1,"character":10}}}'
DEFINITION_MESSAGE=$(create_lsp_message "$DEFINITION_REQUEST")
echo "Request would be:"
echo "$DEFINITION_REQUEST" | jq '.' 2>/dev/null || echo "$DEFINITION_REQUEST"
echo -e "${YELLOW}⚠ Full integration test requires running LSP server${NC}"

# 测试 5: textDocument/references (模拟)
echo ""
echo -e "${YELLOW}Test 5: textDocument/references (sample request)${NC}"
REFERENCES_REQUEST='{"jsonrpc":"2.0","id":3,"method":"textDocument/references","params":{"textDocument":{"uri":"file://'"$PROJECT_DIR"'/src/components/HelloWorld.ets"},"position":{"line":6,"character":15},"context":{"includeDeclaration":true}}}'
REFERENCES_MESSAGE=$(create_lsp_message "$REFERENCES_REQUEST")
echo "Request would be:"
echo "$REFERENCES_REQUEST" | jq '.' 2>/dev/null || echo "$REFERENCES_REQUEST"
echo -e "${YELLOW}⚠ Full integration test requires running LSP server${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  LSP Feature Tests Completed${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "To run full integration tests:"
echo "  1. Start the LSP server in the background"
echo "  2. Use an LSP client to send requests"
echo "  3. Verify responses match expected format"
echo ""
echo "For manual testing:"
echo "  1. Open test-fixtures/arkts-sample-project in Zed"
echo "  2. Try Go to Definition on imported components"
echo "  3. Try Find References on component definitions"
echo "  4. Check that syntax highlighting works"
