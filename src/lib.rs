use zed_extension_api as zed;

struct MyEtsExtension {
    // ... state
}

impl zed::Extension for MyEtsExtension {
    fn new() -> Self {
        Self {
            // Initialize any state here
        }
    }
}

zed::register_extension!(MyEtsExtension);
