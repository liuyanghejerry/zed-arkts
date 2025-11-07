use crate::zed::LanguageServerId;
use std::fs;
use zed::serde_json::json;
use zed::serde_json::Value;
use zed::Worktree;
use zed_extension_api as zed;

const LANGUAGE_SERVER_VERSION: &str = "latest";
const LANGUAGE_SERVER_NAME: &str = "@arkts/language-server";
const SERVER_PATH: &str = "node_modules/@arkts/language-server/bin/ets-language-server.mjs";

struct MyArkTSExtension {
    language_server_path: Option<String>,
}

fn server_exists() -> bool {
    fs::metadata(SERVER_PATH).map_or(false, |stat| stat.is_file())
    // true
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
        _worktree: &Worktree,
    ) -> Result<Option<Value>, String> {
        return Ok(Some(json!({
            "typescript": {
                "tsdk": "/Users/liuyanghejerry/develop/arkTS/ohos-typescript/lib"
            },
            "ohos": {
                "resourceReferenceDiagnostic": "error",
                // TODO: find them dynamically
                "sdkPath": "DevEco-Studio-5.0.9.300.app/Contents/sdk/default/openharmony",
                "etsComponentPath": "DevEco-Studio-5.0.9.300.app/Contents/sdk/default/openharmony/ets/component",
                "etsLoaderPath": "DevEco-Studio-5.0.9.300.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader",
                "lib": ["es6", "dom", "es2015"],
                "typeRoots": ["DevEco-Studio-5.0.9.300.app/Contents/sdk/default/openharmony/types"],
                "baseUrl": ".",
                "paths": {}
            }
        })));
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

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                self.language_server_path.clone().unwrap(),
                "--server-mode".to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(MyArkTSExtension);
