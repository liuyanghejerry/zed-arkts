use crate::zed::LanguageServerId;
use std::env;
use std::fs;
use std::path::Path;
use zed::serde_json::Value;
use zed::Worktree;
use zed::settings::LspSettings;
use zed_extension_api as zed;

// 包含构建时生成的 JavaScript 代码
mod embedded_js;

/// 检查是否在 WASM 环境中
fn is_wasm_environment() -> bool {
    cfg!(target_arch = "wasm32")
}

/// 获取语言服务器包装器的执行方式
fn get_language_server_wrapper_info() -> Result<(String, Vec<String>), String> {
    // 在 WASM 环境中，我们需要通过环境变量传递 JavaScript 内容
    if is_wasm_environment() {
        // 使用特殊的脚本来接收 JavaScript 内容并通过环境变量传递
        let wrapper_script = r#"
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// 从环境变量获取 JavaScript 代码
const jsCode = process.env.ARKTS_JS_WRAPPER_CODE;
const etsLangServerPath = process.env.ETS_LANG_SERVER;

if (!jsCode) {
    console.error('ARKTS_JS_WRAPPER_CODE environment variable not found');
    process.exit(1);
}

// 将 JavaScript 代码写入临时文件
const tempFile = path.join('/tmp', 'arkts-wrapper-' + Date.now() + '.js');
fs.writeFileSync(tempFile, jsCode);

// 执行实际的 JavaScript 代码
const child = spawn('node', [tempFile, '--ets-server-path', etsLangServerPath], {
    stdio: 'inherit',
    env: { ...process.env, ETS_LANG_SERVER: etsLangServerPath }
});

child.on('exit', (code) => {
    // 清理临时文件
    try {
        fs.unlinkSync(tempFile);
    } catch (e) {
        // 忽略清理错误
    }
    process.exit(code);
});
"#;
        Ok(("node".to_string(), vec!["-e".to_string(), wrapper_script.to_string()]))
    } else {
        // 在原生环境中，将 JavaScript 写入临时文件
        let temp_dir = env::temp_dir();
        let temp_file_path = temp_dir.join("arkts-language-server-wrapper.js");

        if !temp_file_path.exists() {
            fs::write(&temp_file_path, embedded_js::INDEX_JS_CONTENT)
                .map_err(|e| format!("Failed to write embedded JavaScript: {}", e))?;
        }

        Ok(("node".to_string(), vec![temp_file_path.to_string_lossy().to_string()]))
    }
}

const LANGUAGE_SERVER_VERSION: &str = "latest";
const LANGUAGE_SERVER_NAME: &str = "@arkts/language-server";
const ETS_SERVER_PATH: &str = "node_modules/@arkts/language-server/bin/ets-language-server.js";
// const ETS_SERVER_PATH: &str = "/Users/liuyanghejerry/develop/arkTS/packages/language-server/bin/ets-language-server.js";

struct MyArkTSExtension {
    language_server_path: Option<String>,
}

fn ets_server_exists() -> bool {
    fs::metadata(ETS_SERVER_PATH).map_or(false, |stat| stat.is_file())
    // true
}

impl zed::Extension for MyArkTSExtension {
    fn new() -> Self {
        if !ets_server_exists() {
            let install_result =
                zed::npm_install_package(LANGUAGE_SERVER_NAME, LANGUAGE_SERVER_VERSION);

            match install_result {
                Ok(_) => {
                    println!("Successfully installed {}.", LANGUAGE_SERVER_NAME);
                }
                Err(err) => {
                    println!("Failed to install {}: {:?}", LANGUAGE_SERVER_NAME, err);
                    return Self {
                        language_server_path: None,
                    };
                }
            };
        }

        // 获取语言服务器包装器的执行信息
        let language_server_path = match get_language_server_wrapper_info() {
            Ok((_command, args)) => {
                if is_wasm_environment() {
                    println!("Using in-memory JavaScript code for WASM environment");
                    // 在 WASM 环境中，我们使用 node -e 执行内联脚本
                    args.get(1).cloned()
                } else {
                    println!("Successfully extracted language server wrapper to: {}", args[0]);
                    Some(args[0].clone())
                }
            }
            Err(err) => {
                println!("Failed to get language server wrapper info: {}", err);
                None
            }
        };

        Self {
            language_server_path,
        }
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Option<Value>, String> {
        let initialization_options = LspSettings::for_worktree("arkts-language-server", worktree)
            .ok()
            .and_then(|settings| settings.initialization_options)
            .unwrap_or_default();

        Ok(Some(initialization_options))
    }

    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Option<Value>, String> {
        let config = LspSettings::for_worktree("arkts-language-server", worktree)
            .ok()
            .and_then(|settings| settings.settings.clone())
            .unwrap_or_default();

        Ok(Some(config))
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command, String> {
        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::Downloading,
        );

        if self.language_server_path.is_none() {
            return Err("language-server installation failed.".to_string());
        }

        // 将 ETS_SERVER_PATH 解析为绝对路径
        let ets_lang_server_abs_path = if Path::new(ETS_SERVER_PATH).is_absolute() {
            ETS_SERVER_PATH.to_string()
        } else {
            // 相对路径需要基于扩展进程的当前工作目录解析为绝对路径
            let current_dir = env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?;
            let abs_path = current_dir.join(ETS_SERVER_PATH);
            abs_path.to_string_lossy().to_string()
        };

        println!("ets_lang_server_abs_path: {}", ets_lang_server_abs_path);

        // 创建环境变量映射
        let mut env = vec![("ETS_LANG_SERVER".to_string(), ets_lang_server_abs_path)];

        // 在 WASM 环境中添加 JavaScript 内容到环境变量
        if is_wasm_environment() {
            env.push(("ARKTS_JS_WRAPPER_CODE".to_string(), embedded_js::INDEX_JS_CONTENT.to_string()));
        }

        // 构建命令参数
        let args = if is_wasm_environment() {
            // 在 WASM 环境中，使用包装器脚本
            let wrapper_script = r#"
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// 从环境变量获取 JavaScript 代码
const jsCode = process.env.ARKTS_JS_WRAPPER_CODE;
const etsLangServerPath = process.env.ETS_LANG_SERVER;

if (!jsCode) {
    console.error('ARKTS_JS_WRAPPER_CODE environment variable not found');
    process.exit(1);
}

// 将 JavaScript 代码写入临时文件
const tempFile = path.join('/tmp', 'arkts-wrapper-' + Date.now() + '.js');
fs.writeFileSync(tempFile, jsCode);

// 执行实际的 JavaScript 代码
const child = spawn('node', [tempFile], {
    stdio: 'inherit',
    env: { ...process.env, ETS_LANG_SERVER: etsLangServerPath }
});

child.on('exit', (code) => {
    // 清理临时文件
    try {
        fs.unlinkSync(tempFile);
    } catch (e) {
        // 忽略清理错误
    }
    process.exit(code);
});
"#;
            vec!["-e".to_string(), wrapper_script.to_string()]
        } else {
            // 在原生环境中，使用提取的文件路径
            vec![self.language_server_path.clone().unwrap()]
        };

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args,
            env,
        })
    }
}

zed::register_extension!(MyArkTSExtension);
