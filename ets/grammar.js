/**
 * @file Harmony ets parser
 * @author liuyanghejerry <liuyanghejerry@126.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// module.exports = grammar({
//   name: "ets",

//   rules: {
//     // TODO: add the actual grammar rules
//     source_file: $ => "hello"
//   }
// });

const defineGrammar = require("./typescript-grammar");

module.exports = defineGrammar("typescript");
