; ArkTS Syntax Highlighting Rules

; Core Keywords
[
  "import"
  "export"
  "default"
  "from"
  "as"
  "struct"
  "interface"
  "type"
  "class"
  "extends"
  "implements"
  "abstract"
  "function"
  "let"
  "const"
  "var"
  "if"
  "else"
  "for"
  "while"
  "return"
  "try"
  "catch"
  "finally"
  "throw"
  "new"
  "await"
  "async"
  "enum"
  "static"
  "readonly"
  "private"
  "public"
  "protected"
  "typeof"
  "void"
  "delete"
  "in"
  "instanceof"
  "break"
  "continue"
] @keyword

; ArkTS specific keywords
[
  "build"
  "ForEach"
  "LazyForEach"
] @keyword.special

; Built-in types
[
  "any"
  "number"
  "string"
  "boolean"
  "void"
  "null"
  "undefined"
] @type.builtin

; Operators
[
  "="
  "+="
  "-="
  "*="
  "/="
  "%="
  "&="
  "|="
  "^="
  "<<="
  ">>="
  ">>>="
  "+"
  "-"
  "*"
  "/"
  "%"
  "++"
  "--"
  "**"
  "&"
  "|"
  "^"
  "~"
  "<<"
  ">>"
  ">>>"
  "&&"
  "||"
  "!"
  "=="
  "!="
  "==="
  "!=="
  "<"
  ">"
  "<="
  ">="
  "?"
  ":"
  "??"
  "?."
  "..."
] @operator

; Punctuation
[
  ";"
  ","
  "."
] @punctuation.delimiter

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

; Decorators - ArkTS特有的重要特性
(decorator
  "@" @punctuation.special
  [
    ; Basic decorators
    "Entry"
    "Component"
    "ComponentV2"

    ; State management V1 decorators
    "State"
    "Prop"
    "Link"
    "Provide"
    "Consume"
    "ObjectLink"
    "Observed"
    "Watch"
    "StorageLink"
    "StorageProp"
    "LocalStorageLink"
    "LocalStorageProp"

    ; State management V2 decorators
    "Local"
    "Param"
    "Once"
    "Event"
    "Provider"
    "Consumer"
    "Monitor"
    "Computed"
    "Type"
    "ObservedV2"
    "Trace"

    ; UI building decorators
    "Builder"
    "BuilderParam"
    "LocalBuilder"
    "Styles"
    "Extend"
    "AnimatableExtend"

    ; Other decorators
    "Require"
    "Reusable"
    "Concurrent"
    "Track"
  ] @attribute.builtin)

(decorator
  "@" @punctuation.special
  (identifier) @attribute)

; UI Components - ArkTS特有的UI组件
(ui_component
  [
    ; Basic components
    "Text"
    "Button"
    "Image"
    "TextInput"
    "TextArea"

    ; Layout containers
    "Column"
    "Row"
    "Stack"
    "Flex"
    "Grid"
    "GridRow"
    "GridCol"
    "List"
    "ScrollList"
    "NavDestination"

    ; Container items
    "ListItem"
    "GridItem"
    "ListItemGroup"
  ] @function.builtin)

; Component declaration
(component_declaration
  "struct" @keyword
  name: (identifier) @type)

; Class declaration
(class_declaration
  "class" @keyword
  name: (identifier) @type)

; Interface declaration
(interface_declaration
  "interface" @keyword
  name: (identifier) @type)

; Enum declaration
(enum_declaration
  "enum" @keyword
  name: (identifier) @type)

; Type declaration
(type_declaration
  "type" @keyword
  name: (identifier) @type)

; Function declaration
(function_declaration
  "function" @keyword
  name: (identifier) @function)

; Method declaration
(method_declaration
  name: (identifier) @function.method)

; Constructor declaration
(constructor_declaration
  "constructor" @keyword)

; Build method - ArkTS特有
(build_method
  "build" @keyword.special)

; Variable declarations
(variable_declarator
  name: (identifier) @variable)

; Parameter
(parameter
  name: (identifier) @variable.parameter)

; Property declaration
(property_declaration
  name: (identifier) @property)

; Member expression
(member_expression
  property: (identifier) @property)



; Arrow function
(arrow_function
  "=>" @operator)

; Function expression
(function_expression
  "function" @keyword)

; Identifiers
(identifier) @variable

; Literals
(string_literal) @string
(template_literal) @string
; (template_substitution
;   "${" @punctuation.special
;   "}" @punctuation.special)
; (escape_sequence) @string.escape

(numeric_literal) @number
(boolean_literal) @boolean
(null_literal) @constant.builtin

; Resource expression - ArkTS特有的$r()语法
(resource_expression
  "$r" @function.builtin)

; State binding expression - ArkTS特有的$语法
(state_binding_expression
  "$" @punctuation.special)

; As expression - Type assertion
(as_expression
  "as" @operator)

; Await expression
(await_expression
  "await" @keyword)

; Import expression - dynamic import()
(import_expression
  "import" @keyword)

; Comments
(comment) @comment

; Type annotations
(type_annotation) @type

; Array type
(array_type) @type

; Tuple type
(tuple_type) @type

; Generic type
(generic_type) @type

; Union type
(union_type) @type

; Function type
(function_type) @type

; Conditional type
(conditional_type) @type

; Modifier chain expression - ArkTS UI修饰符链
(modifier_chain_expression
  "." @punctuation.delimiter
  (identifier) @function.method)

; Import/Export
(import_declaration
  "import" @keyword
  "from" @keyword)

(export_declaration
  "export" @keyword)

; Control flow
(if_statement
  "if" @keyword.conditional)

(ui_if_statement
  "if" @keyword.conditional)

(for_each_statement
  "ForEach" @keyword.repeat)

(lazy_for_each_statement
  "LazyForEach" @keyword.repeat)

; Try statement
(try_statement
  "try" @keyword)

(catch_clause
  "catch" @keyword)

(finally_clause
  "finally" @keyword)

; Throw statement
(throw_statement
  "throw" @keyword)

; Loop statements
(for_statement
  "for" @keyword.repeat)

(while_statement
  "while" @keyword.repeat)

(break_statement
  "break" @keyword)

(continue_statement
  "continue" @keyword)

; Template literal substitution
(template_substitution
  "$" @punctuation.special
  "{" @punctuation.special
  "}" @punctuation.special)

; Escape sequences in strings
; (escape_sequence) @string.escape

; Spread element
(spread_element
  "..." @operator)

; Update expressions (++/--)
; (update_expression
;   operator: choice("++" "--") @operator)

; Non-null assertion
(non_null_assertion_expression
  "!" @operator)

; New expression
(new_expression
  "new" @keyword)

; Type parameters
(type_parameters
  "<" @punctuation.bracket
  ">" @punctuation.bracket)

; Type arguments
(type_arguments
  "<" @punctuation.bracket
  ">" @punctuation.bracket)

; Optional chaining
(member_expression
  "?." @operator)

(subscript_expression
  "?." @operator)

; Argument list punctuation
(argument_list
  "(" @punctuation.bracket
  ")" @punctuation.bracket)

; Optional parameter
(parameter
  "?" @operator)

; Optional property
(property_declaration
  "?" @operator)

; Enum members
(enum_member
  name: (identifier) @variable)

; Property assignment in object literals
(property_assignment
  key: (property_name) @property)

; Computed property names
(property_name
  "[" @punctuation.bracket
  "]" @punctuation.bracket)

; Error highlighting for unmatched brackets
(ERROR) @error
