(function_declaration
  body: (_) @function.inside) @function.around

(method_declaration
  body: (_) @function.inside) @function.around

(build_method
  body: (build_body) @function.inside) @function.around

(component_declaration
  body: (component_body) @class.inside) @class.around

(class_declaration
  body: (class_body) @class.inside) @class.around

(interface_declaration
  body: (object_type) @class.inside) @class.around

(parameter) @parameter.inside
(parameter) @parameter.around

(comment)+ @comment.around
