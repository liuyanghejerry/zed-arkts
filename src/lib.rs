use crate::zed::LanguageServerId;
use std::env;
use zed_extension_api as zed;

static OHOS_TYPESCRIPT_VERSION: &str = "4.9.5-r10";

struct MyArkTSExtension {
    ohos_typescript_module_path: Option<String>,
}

impl zed::Extension for MyArkTSExtension {
    fn new() -> Self {
        let install_result = zed::npm_install_package("ohos-typescript", OHOS_TYPESCRIPT_VERSION);
        let module_path = match install_result {
            Ok(path) => {
                println!("Successfully installed ohos-typescript at: {:?}", path);
                Some(path)
            }
            Err(err) => {
                println!("Failed to install ohos-typescript: {:?}", err);
                None
            }
        };
        println!("ohos-typescript path: {:?}", module_path);

        let node_binary = zed::node_binary_path().unwrap_or_else(|err| {
            println!("Failed to get node binary path: {:?}", err);
            std::process::exit(1);
        });

        println!("Node binary path: {:?}", node_binary);

        let server_path = env::current_dir()
            .unwrap()
            .join("ohos-typescript/bin/tsserver")
            .to_string_lossy()
            .to_string();
        Self {
            ohos_typescript_module_path: Some(server_path),
        }
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

        let install_result = zed::npm_install_package("ohos-typescript", OHOS_TYPESCRIPT_VERSION);
        let module_path = match install_result {
            Ok(path) => {
                println!("Successfully installed ohos-typescript at: {:?}", path);
                Some(path)
            }
            Err(err) => {
                println!("Failed to install ohos-typescript: {:?}", err);
                None
            }
        };
        println!("ohos-typescript path: {:?}", module_path);

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![
                self.ohos_typescript_module_path.clone().unwrap(),
                "--server-mode".to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(MyArkTSExtension);
