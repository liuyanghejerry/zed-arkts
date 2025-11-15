use crate::zed::LanguageServerId;
use std::env;
use std::path::Path;
use zed::serde_json::Value;
use zed::Worktree;
use zed::settings::LspSettings;
use zed_extension_api as zed;

const LANGUAGE_SERVER_VERSION: &str = "latest";
const LANGUAGE_SERVER_NAME: &str = "zed-ets-language-server";
const ETS_SERVER_PATH: &str = "node_modules/@arkts/language-server/bin/ets-language-server.js";
const SERVER_WRAPPER_PATH: &str = "node_modules/zed-ets-language-server/index.js";

struct MyArkTSExtension { }

fn download_language_server() -> Result<(), String> {
    zed::npm_install_package(LANGUAGE_SERVER_NAME, LANGUAGE_SERVER_VERSION)
}

fn get_absolute_path(path: &str) -> Result<String, String> {
    if Path::new(path).is_absolute() {
        Ok(path.to_string())
    } else {
        // 相对路径需要基于扩展进程的当前工作目录解析为绝对路径
        let current_dir = env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?;
        let abs_path = current_dir.join(path);
        Ok(abs_path.to_string_lossy().to_string())
    }
}

impl zed::Extension for MyArkTSExtension {
    fn new() -> Self {
        Self { }
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

        println!("{:?}", initialization_options);

        Ok(Some(initialization_options))
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command, String> {
        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        let npm_package_installed_version = zed::npm_package_installed_version(&LANGUAGE_SERVER_NAME);
        let npm_package_latest_version = zed::npm_package_latest_version(&LANGUAGE_SERVER_NAME);

        if npm_package_latest_version.is_err() {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Failed("Failed to fetch latest version of zed-ets-language-server".to_string()),
            );
            return Err("Failed to fetch latest version of zed-ets-language-server".to_string());
        }

        let npm_package_latest_version = npm_package_latest_version.unwrap();

        match npm_package_installed_version {
            Ok(Some(version)) => {
                if version == npm_package_latest_version {
                    zed::set_language_server_installation_status(
                        language_server_id,
                        &zed::LanguageServerInstallationStatus::None,
                    );
                } else {
                    download_language_server()?;
                    zed::set_language_server_installation_status(
                        language_server_id,
                        &zed::LanguageServerInstallationStatus::Downloading,
                    );
                }
            }
            Ok(None) => {
                download_language_server()?;
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Downloading,
                );
            }
            Err(err) => {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Failed(err),
                );
            }
        }

        // 将 SERVER_WRAPPER_PATH 解析为绝对路径
        let server_wrapper_abs_path = get_absolute_path(SERVER_WRAPPER_PATH)?;
        // 将 ETS_SERVER_PATH 解析为绝对路径
        let ets_lang_server_abs_path = get_absolute_path(ETS_SERVER_PATH)?;

        // 创建环境变量映射
        let env = vec![("ETS_LANG_SERVER".to_string(), ets_lang_server_abs_path)];

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                server_wrapper_abs_path.clone(),
            ],
            env,
        })
    }
}

zed::register_extension!(MyArkTSExtension);
