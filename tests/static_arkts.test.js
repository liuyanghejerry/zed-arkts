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
