use std::env;
use std::fs;
use std::path::Path;

fn escape_string(s: &str) -> String {
    s.replace('\\', r#"\\\\"#)
     .replace('"', r#"\""#)
     .replace('\n', r#"\\n"#)
     .replace('\r', r#"\\r"#)
     .replace('\t', r#"\\t"#)
}

fn main() {
    println!("cargo:rerun-if-changed=language-server-wrapper/index.js");

    let out_dir = env::var_os("OUT_DIR").unwrap();

    // 生成到 OUT_DIR 的文件（用于 include!）
    let out_path = Path::new(&out_dir).join("index_js.rs");

    // 生成到 src 目录的文件（用于直接引用）
    let src_path = Path::new("src").join("embedded_js.rs");

    // 读取 index.js 文件内容
    let js_content = fs::read_to_string("language-server-wrapper/index.js")
        .expect("Failed to read language-server-wrapper/index.js");

    // 转义 JavaScript 内容
    let escaped_content = escape_string(&js_content);

    // 生成 Rust 代码
    let rust_content = format!(
        r#"// 此文件由 build.rs 自动生成，请勿手动修改
/// 嵌入的语言服务器包装器 JavaScript 代码
pub const INDEX_JS_CONTENT: &str = "{}";
"#,
        escaped_content
    );

    // 写入两个位置
    fs::write(&out_path, &rust_content)
        .expect("Failed to write embedded JavaScript code to OUT_DIR");

    fs::write(&src_path, &rust_content)
        .expect("Failed to write embedded JavaScript code to src");

    println!("cargo:warning=Embedded language-server-wrapper/index.js into binary");
}
