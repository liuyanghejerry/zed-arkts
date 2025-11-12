use crate::zed::LanguageServerId;
use std::env;
use std::fs;
use std::path::Path;
use zed::serde_json::Value;
use zed::Worktree;
use zed::settings::LspSettings;
use zed_extension_api as zed;

const LANGUAGE_SERVER_VERSION: &str = "latest";
const LANGUAGE_SERVER_NAME: &str = "@arkts/language-server";
const ETS_SERVER_PATH: &str = "node_modules/@arkts/language-server/bin/ets-language-server.js";
// const ETS_SERVER_PATH: &str = "/Users/liuyanghejerry/develop/arkTS/packages/language-server/bin/ets-language-server.js";
const SERVER_WRAPPER_PATH: &str = "language-server-wrapper/index.js";
// const SERVER_WRAPPER_PATH: &str = "/Users/liuyanghejerry/develop/zed-arkts/language-server-wrapper/index.js";

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

        // 将 SERVER_WRAPPER_PATH 解析为绝对路径
        let language_server_abs_path = if Path::new(SERVER_WRAPPER_PATH).is_absolute() {
            SERVER_WRAPPER_PATH.to_string()
        } else {
            // 相对路径需要基于扩展进程的当前工作目录解析为绝对路径
            let current_dir = env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let abs_path = current_dir.join(SERVER_WRAPPER_PATH);
            abs_path.to_string_lossy().to_string()
        };

        Self {
            language_server_path: Some(language_server_abs_path),
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
        let env = vec![("ETS_LANG_SERVER".to_string(), ets_lang_server_abs_path)];

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                self.language_server_path.clone().unwrap(),
            ],
            env,
        })
    }
}

zed::register_extension!(MyArkTSExtension);
