use zed_extension_api as zed;

struct MyArkTSExtension {
    // ... state
}

impl zed::Extension for MyArkTSExtension {
    fn new() -> Self {
        Self {
            // Initialize any state here
        }
    }
}

zed::register_extension!(MyArkTSExtension);
