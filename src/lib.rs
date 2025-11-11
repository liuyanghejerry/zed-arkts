use crate::zed::LanguageServerId;
use std::fs;
use zed::serde_json::json;
use zed::serde_json::Value;
use zed::Worktree;
use zed::settings::LspSettings;
use zed_extension_api as zed;

const LANGUAGE_SERVER_VERSION: &str = "latest";
const LANGUAGE_SERVER_NAME: &str = "@arkts/language-server";
// const SERVER_PATH: &str = "node_modules/@arkts/language-server/bin/ets-language-server.mjs";
const ETS_SERVER_PATH: &str = "/Users/liuyanghejerry/develop/arkTS/packages/language-server/bin/ets-language-server.js";
const SERVER_PATH: &str = "/Users/liuyanghejerry/develop/zed-arkts/language-server-wrapper/index.js";

struct MyArkTSExtension {
    language_server_path: Option<String>,
}

fn server_exists() -> bool {
    // fs::metadata(SERVER_PATH).map_or(false, |stat| stat.is_file())
    true
}

impl zed::Extension for MyArkTSExtension {
    fn new() -> Self {
        if !server_exists() {
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

        Self {
            language_server_path: Some(SERVER_PATH.to_string()),
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

        // 创建环境变量映射
        let env = vec![("ETS_LANG_SERVER".to_string(), ETS_SERVER_PATH.to_string())];

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                self.language_server_path.clone().unwrap(),
                // "--server-mode".to_string(),
                // "--stdio".to_string(),
            ],
            env,
        })
    }
}

zed::register_extension!(MyArkTSExtension);
