"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const Parser = require("tree-sitter");
const ArkTS = require("tree-sitter-arkts");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(__dirname, "fixtures/editing_features.ets"), "utf8");
const parser = new Parser();
parser.setLanguage(ArkTS);
const tree = parser.parse(source);

function query(name) {
  const querySource = fs.readFileSync(path.join(root, "languages/arkts", `${name}.scm`), "utf8");
  return new Parser.Query(ArkTS, querySource);
}

function captureTexts(name) {
  return query(name).captures(tree.rootNode).map((capture) => ({
    name: capture.name,
    text: capture.node.text,
  }));
}

function assertCapture(queryName, captureName, text) {
  assert.ok(
    captureTexts(queryName).some((capture) =>
      capture.name === captureName && capture.text === text),
    `missing @${captureName} capture for ${JSON.stringify(text)} in ${queryName}.scm`,
  );
}

function assertCaptureIncludes(queryName, captureName, text) {
  assert.ok(
    captureTexts(queryName).some((capture) =>
      capture.name === captureName && capture.text.includes(text)),
    `missing @${captureName} capture containing ${JSON.stringify(text)} in ${queryName}.scm`,
  );
}

test("fixture parses and existing highlight query compiles", () => {
  assert.equal(tree.rootNode.hasError, false);
  assert.doesNotThrow(() => query("highlights"));
});

test("highlights distinguish ArkTS and ArkUI syntax roles", () => {
  for (const [capture, text] of [
    ["attribute.builtin", "Component"],
    ["type", "Dashboard"],
    ["function.method", "build"],
    ["function.builtin", "Column"],
    ["property", "title"],
    ["variable.parameter", "value"],
    ["type.builtin", "string"],
    ["constant", "MAX_ITEMS"],
    ["function.builtin", "$r"],
  ]) {
    assertCapture("highlights", capture, text);
  }
});

test("outline exposes ArkTS declarations and build methods", () => {
  for (const name of [
    "ItemData",
    "LoadState",
    "ItemStore",
    "getTitle",
    "normalizeTitle",
    "Dashboard",
    "updateTitle",
    "build",
  ]) {
    assertCapture("outline", "name", name);
  }
  assertCaptureIncludes("outline", "item", "struct Dashboard");
});

test("text objects cover components functions parameters and comments", () => {
  assertCaptureIncludes("textobjects", "class.around", "struct Dashboard");
  assertCaptureIncludes("textobjects", "class.inside", "@State title");
  assertCaptureIncludes("textobjects", "function.around", "normalizeTitle");
  assertCaptureIncludes("textobjects", "function.around", "build()");
  assertCapture("textobjects", "parameter.inside", "value: string");
  assertCapture(
    "textobjects",
    "comment.around",
    "// Text displayed in the main card.",
  );
});

test("structural queries cover indentation and bracket pairs", () => {
  assertCaptureIncludes("indents", "indent", "@State title");
  assertCaptureIncludes("indents", "indent", "return value.trim()");
  assertCaptureIncludes("indents", "indent", "Text(this.title)");
  assertCaptureIncludes("indents", "indent", "16,");
  assertCapture("indents", "outdent", "}");
  assertCapture("indents", "outdent", "]");

  for (const [capture, text] of [
    ["open", "("],
    ["close", ")"],
    ["open", "["],
    ["close", "]"],
    ["open", "{"],
    ["close", "}"],
  ]) {
    assertCapture("brackets", capture, text);
  }
});
