import XCTest
import SwiftTreeSitter
import TreeSitterEts

final class TreeSitterEtsTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_ets())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Ets grammar")
    }
}
