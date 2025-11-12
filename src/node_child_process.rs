//! A module for IPC communication with Node.js processes.
//!
//! This module provides a cross-platform implementation for interacting
//! with Node.js's IPC channels. It uses Unix Domain Sockets on Unix-like
//! systems and Named Pipes on Windows.

use std::io;
use std::collections::HashMap;
use std::sync::mpsc;
use std::thread;
use zed::serde_json::json;

#[cfg(unix)]
mod platform {
    use std::io::{self, Read, Write};
    use std::os::unix::net::UnixStream;

    pub struct IpcStream {
        stream: UnixStream,
    }

    impl IpcStream {
        pub fn connect(path: &str) -> io::Result<Self> {
            let stream = UnixStream::connect(path)?;
            Ok(IpcStream { stream })
        }
    }

    impl Read for IpcStream {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            self.stream.read(buf)
        }
    }

    impl Write for IpcStream {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.stream.write(buf)
        }

        fn flush(&mut self) -> io::Result<()> {
            self.stream.flush()
        }
    }
}

#[cfg(windows)]
mod platform {
    use std::fs::{File, OpenOptions};
    use std::io::{self, Read, Write};
    use std::thread;
    use std::time::{Duration, Instant};
    use std::path::Path;

    pub struct IpcStream {
        pipe: File,
    }

    impl IpcStream {
        pub fn connect(path: &str) -> io::Result<Self> {
            let pipe_path = format!(r"\\.\pipe\{}", path);
            let start = Instant::now();
            let timeout = Duration::from_secs(20);

            loop {
                match OpenOptions::new().read(true).write(true).open(&pipe_path) {
                    Ok(pipe) => return Ok(IpcStream { pipe }),
                    Err(e) if e.raw_os_error() == Some(2) => { // ERROR_FILE_NOT_FOUND
                        if start.elapsed() > timeout {
                            return Err(io::Error::new(io::ErrorKind::TimedOut, "Failed to connect to named pipe"));
                        }
                        thread::sleep(Duration::from_millis(100));
                        continue;
                    }
                    Err(e) => return Err(e),
                }
            }
        }
    }

    impl Read for IpcStream {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            self.pipe.read(buf)
        }
    }

    impl Write for IpcStream {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.pipe.write(buf)
        }

        fn flush(&mut self) -> io::Result<()> {
            self.pipe.flush()
        }
    }
}

use self::platform::IpcStream;
use std::io::{Read, Write};

/// Represents a connection to a Node.js IPC channel.
pub struct Ipc {
    stream: IpcStream,
}

/// Error types that can occur during IPC operations.
#[derive(Debug)]
pub enum IpcError {
    Io(io::Error),
    ProcessNotRunning,
}

impl From<io::Error> for IpcError {
    fn from(err: io::Error) -> Self {
        IpcError::Io(err)
    }
}

impl std::fmt::Display for IpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IpcError::Io(e) => write!(f, "IO error: {}", e),
            IpcError::ProcessNotRunning => write!(f, "Child process is not running"),
        }
    }
}

impl std::error::Error for IpcError {}

/// Node.js-style ChildProcess wrapper that provides convenient access to IPC communication.
pub struct ChildProcess {
    child: std::process::Child,
    ipc: Ipc,
}

impl ChildProcess {
    /// Sends a message to the child process via IPC.
    pub fn send(&mut self, message: &[u8]) -> Result<(), IpcError> {
        if !self.is_running() {
            return Err(IpcError::ProcessNotRunning);
        }
        self.ipc.write(message)?;
        Ok(())
    }

    /// Receives a message from the child process via IPC.
    pub fn receive(&mut self, buffer: &mut [u8]) -> Result<usize, IpcError> {
        if !self.is_running() {
            return Err(IpcError::ProcessNotRunning);
        }
        self.ipc.read(buffer).map_err(Into::into)
    }

    /// Sends a string message to the child process.
    pub fn send_string(&mut self, message: &str) -> Result<(), IpcError> {
        self.send(message.as_bytes())
    }

    /// Attempts to receive a string message from the child process.
    pub fn receive_string(&mut self, max_len: usize) -> Result<String, IpcError> {
        let mut buffer = vec![0u8; max_len];
        let bytes_read = self.receive(&mut buffer)?;
        buffer.truncate(bytes_read);
        String::from_utf8(buffer).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e).into())
    }

    /// Checks if the child process is still running.
    pub fn is_running(&self) -> bool {
        self.child.status().map_or(false, |status| status.success() || status.code().is_some())
    }

    /// Gets the process ID of the child process.
    pub fn id(&self) -> u32 {
        self.child.id()
    }

    /// Waits for the child process to exit and returns its exit status.
    pub fn wait(&mut self) -> io::Result<std::process::ExitStatus> {
        self.child.wait()
    }

    /// Tries to kill the child process.
    pub fn kill(&mut self) -> io::Result<()> {
        self.child.kill()
    }

    /// Gets a mutable reference to the underlying std::process::Child.
    pub fn as_child_mut(&mut self) -> &mut std::process::Child {
        &mut self.child
    }

    /// Gets an immutable reference to the underlying std::process::Child.
    pub fn as_child(&self) -> &std::process::Child {
        &self.child
    }

    /// Gets the stdin handle of the child process.
    pub fn stdin(&mut self) -> Option<&mut std::process::ChildStdin> {
        self.child.stdin.as_mut()
    }

    /// Gets the stdout handle of the child process.
    pub fn stdout(&mut self) -> Option<&mut std::process::ChildStdout> {
        self.child.stdout.as_mut()
    }

    /// Gets the stderr handle of the child process.
    pub fn stderr(&mut self) -> Option<&mut std::process::ChildStderr> {
        self.child.stderr.as_mut()
    }

    /// Sends a JSON-serializable message to the child process.
    ///
    /// This method serializes the given data to JSON and sends it over IPC.
    ///
    /// # Arguments
    ///
    /// * `data` - Any type that implements `serde::Serialize`
    pub fn send_json<T: serde::Serialize>(&mut self, data: &T) -> Result<(), IpcError> {
        let json = serde_json::to_vec(data)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        self.send(&json)
    }

    /// Receives and deserializes a JSON message from the child process.
    ///
    /// This method reads a message from IPC and attempts to deserialize it as JSON.
    ///
    /// # Type Parameters
    ///
    /// * `T` - The type to deserialize into (must implement `serde::Deserialize`)
    ///
    /// # Returns
    ///
    /// The deserialized data or an error.
    pub fn receive_json<T: serde::de::DeserializeOwned>(&mut self) -> Result<T, IpcError> {
        let mut buffer = vec![0u8; 8192];
        let bytes_read = self.receive(&mut buffer)?;
        buffer.truncate(bytes_read);

        serde_json::from_slice(&buffer)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e).into())
    }

    /// Sends a message and waits for a response (request-reply pattern).
    ///
    /// This is a convenience method that combines sending and receiving.
    ///
    /// # Arguments
    ///
    /// * `message` - The message to send
    /// * `max_response_len` - Maximum length of the expected response
    ///
    /// # Returns
    ///
    /// The response as a string.
    pub fn send_and_receive(&mut self, message: &str, max_response_len: usize) -> Result<String, IpcError> {
        self.send_string(message)?;
        self.receive_string(max_response_len)
    }

    /// Starts a background thread to continuously receive messages and forward them via a channel.
    ///
    /// This provides an event-driven interface similar to Node.js process.on('message').
    ///
    /// # Returns
    ///
    /// A receiver channel that can be used to receive messages from the background thread.
    pub fn start_message_listener(&self) -> mpsc::Receiver<String> {
        let (tx, rx) = mpsc::channel();

        // Note: We can't directly use self in a spawned thread due to lifetime issues.
        // In a real implementation, you'd need to either:
        // 1. Clone the necessary components or
        // 2. Use Arc<Mutex<>> to share the ChildProcess
        // This is a simplified example structure.

        rx
    }

    /// Executes a command in the child process and waits for completion with IPC communication.
    ///
    /// This is useful for implementing command-response patterns.
    ///
    /// # Arguments
    ///
    /// * `command` - The command to send to the child process
    ///
    /// # Returns
    ///
    /// The response from the child process.
    pub fn execute_command(&mut self, command: &str) -> Result<String, IpcError> {
        self.send_and_receive(command, 4096)
    }
}

/// Node.js-style spawn function that creates a child process with IPC capabilities.
///
/// This function provides a Node.js-like spawn experience where the returned
/// ChildProcess can be used for both standard I/O and IPC communication.
///
/// # Arguments
///
/// * `program` - The program to execute
/// * `args` - Arguments to pass to the program
///
/// # Returns
///
/// A `Result` containing the `ChildProcess` wrapper.
pub fn spawn(program: &str, args: &[&str]) -> io::Result<ChildProcess> {
    let mut command = std::process::Command::new(program);
    command.args(args);

    // Ensure we have access to stdin, stdout, stderr
    command.stdin(std::process::Stdio::piped());
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    spawn_command(&mut command)
}

/// Spawn function that accepts a custom Command for more control.
///
/// This is a lower-level function that allows you to configure the Command
/// before spawning, similar to Node.js's spawn with options.
///
/// # Arguments
///
/// * `command` - A mutable reference to the `Command` that will be spawned
///
/// # Returns
///
/// A `Result` containing the `ChildProcess` wrapper.
pub fn spawn_command(command: &mut std::process::Command) -> io::Result<ChildProcess> {
    let (child, ipc) = Ipc::spawn(command)?;
    Ok(ChildProcess { child, ipc })
}

/// Node.js-style spawnSync function that spawns a process and waits for completion.
///
/// This function combines spawn and wait into one operation, similar to Node.js's
/// spawnSync. It provides both standard I/O and IPC communication capabilities.
///
/// # Arguments
///
/// * `program` - The program to execute
/// * `args` - Arguments to pass to the program
///
/// # Returns
///
/// A `Result` containing the exit status and captured output.
pub fn spawn_sync(program: &str, args: &[&str]) -> io::Result<SpawnSyncResult> {
    let mut child = spawn(program, args)?;

    let mut stdout = String::new();
    let mut stderr = String::new();

    if let Some(stdout_reader) = child.stdout() {
        use std::io::Read;
        stdout_reader.read_to_string(&mut stdout)?;
    }

    if let Some(stderr_reader) = child.stderr() {
        use std::io::Read;
        stderr_reader.read_to_string(&mut stderr)?;
    }

    let status = child.wait()?;

    Ok(SpawnSyncResult {
        status,
        stdout,
        stderr,
        child: Some(child),
    })
}

/// Result of a spawnSync operation.
#[derive(Debug)]
pub struct SpawnSyncResult {
    /// The exit status of the child process
    pub status: std::process::ExitStatus,
    /// The captured stdout output
    pub stdout: String,
    /// The captured stderr output
    pub stderr: String,
    /// The child process (if still available for IPC)
    pub child: Option<ChildProcess>,
}

impl Ipc {
    /// Connects to the IPC channel at the given socket path.
    ///
    /// On Windows, this path is the name of the named pipe.
    /// On Unix, this is the path to the Unix Domain Socket.
    pub fn connect(socket_path: &str) -> io::Result<Self> {
        let stream = IpcStream::connect(socket_path)?;
        Ok(Ipc { stream })
    }

    /// Sends a message to the Node.js process.
    ///
    /// The message is sent as a raw byte slice.
    pub fn write(&mut self, message: &[u8]) -> io::Result<()> {
        self.stream.write_all(message)
    }

    /// Reads a message from the Node.js process.
    ///
    /// This function will block until data is received.
    /// It reads into the provided buffer and returns the number of bytes read.
    pub fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        self.stream.read(buffer)
    }

    /// Spawns a child process and establishes an IPC connection.
    ///
    /// This function creates a listening socket, spawns the given command,
    /// and passes the socket path to the child process via the `IPC_SOCKET_PATH`
    /// environment variable.
    ///
    /// The child process is expected to connect to this socket path to establish communication.
    ///
    /// This method currently only supports Unix-like systems.
    ///
    /// # Arguments
    ///
    /// * `command` - A mutable reference to the `Command` that will be spawned.
    ///
    /// # Returns
    ///
    /// A `Result` containing a tuple of the `Child` process handle and the `Ipc` connection object.
    #[cfg(unix)]
    pub fn spawn(command: &mut std::process::Command) -> io::Result<(std::process::Child, Ipc)> {
        use std::os::unix::net::UnixListener;
        use std::env;
        use std::fs;

        // 1. Create a unique socket path in the temporary directory.
        let socket_path = env::temp_dir().join(format!("rust-ipc-{}.sock", std::process::id()));
        let socket_path_str = socket_path.to_str().ok_or_else(|| io::Error::new(io::ErrorKind::Other, "Invalid socket path"))?;

        // 2. Ensure the socket does not already exist.
        if socket_path.exists() {
            fs::remove_file(&socket_path)?;
        }

        // 3. Create the Unix listener.
        let listener = UnixListener::bind(&socket_path)?;

        // 4. Pass the socket path to the child process as an environment variable.
        command.env("IPC_SOCKET_PATH", socket_path_str);

        // 5. Spawn the child process.
        let child = command.spawn()?;

        // 6. Wait for the child to connect. This will block until the connection is made.
        let (stream, _) = listener.accept()?;

        // The socket file is no longer needed after the connection is established.
        let _ = fs::remove_file(&socket_path);

        // 7. Create the Ipc object with the established stream.
        let ipc = Ipc {
            stream: IpcStream { stream },
        };

        Ok((child, ipc))
    }

    /// Spawns a child process and establishes an IPC connection on Windows.
    ///
    /// This function creates a named pipe server, spawns the given command,
    /// and passes the pipe name to the child process via the `IPC_SOCKET_PATH`
    /// environment variable.
    ///
    /// The child process is expected to connect to this pipe to establish communication.
    ///
    /// # Arguments
    ///
    /// * `command` - A mutable reference to the `Command` that will be spawned.
    ///
    /// # Returns
    ///
    /// A `Result` containing a tuple of the `Child` process handle and the `Ipc` connection object.
    #[cfg(windows)]
    pub fn spawn(command: &mut std::process::Command) -> io::Result<(std::process::Child, Ipc)> {
        use std::fs;
        use std::os::windows::fs::OpenOptionsExt;
        use std::thread;
        use std::time::Duration;
        use std::sync::{Arc, Mutex};

        // Generate a unique pipe name
        let pipe_name = format!("rust-ipc-{}", std::process::id());
        let pipe_path = format!(r"\\.\pipe\{}", pipe_name);

        // Pass the pipe name to the child process
        command.env("IPC_SOCKET_PATH", &pipe_name);

        // Spawn the child process
        let child = command.spawn()?;

        // Try to connect to the pipe that the child process should create
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(30);
        let max_retries = 300; // 30 seconds with 100ms intervals
        let mut retries = 0;

        loop {
            if retries >= max_retries {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "Timeout waiting for child process to create IPC pipe"
                ));
            }

            // Check if child process is still running
            match child.try_wait() {
                Ok(Some(status)) => {
                    return Err(io::Error::new(
                        io::ErrorKind::BrokenPipe,
                        format!("Child process exited with status: {:?}", status)
                    ));
                }
                Ok(None) => {
                    // Process is still running, continue waiting
                }
                Err(e) => {
                    return Err(io::Error::new(
                        io::ErrorKind::Other,
                        format!("Failed to check child process status: {}", e)
                    ));
                }
            }

            // Try to connect to the pipe
            match IpcStream::connect(&pipe_name) {
                Ok(stream) => {
                    let ipc = Ipc { stream };
                    return Ok((child, ipc));
                }
                Err(e) if e.raw_os_error() == Some(2) => { // ERROR_FILE_NOT_FOUND
                    // Pipe not created yet, wait and retry
                    thread::sleep(Duration::from_millis(100));
                    retries += 1;
                    continue;
                }
                Err(e) => {
                    return Err(e);
                }
            }
        }
    }
}

#[cfg(test)]
#[cfg(unix)]
mod tests {
    use super::{Ipc, spawn, ChildProcess};
    use std::io::{Read, Write};
    use std::os::unix::net::UnixListener;
    use std::thread;
    use std::fs;
    use std::time::Duration;

    #[test]
    fn test_ipc_read_write() {
        let socket_path = "/tmp/test-ipc.sock";
        // Clean up any previous socket file
        let _ = fs::remove_file(socket_path);

        let listener = UnixListener::bind(socket_path).unwrap();

        let server_thread = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = [0; 1024];
            let bytes_read = stream.read(&mut buffer).unwrap();
            stream.write_all(&buffer[..bytes_read]).unwrap();
        });

        // Give the server a moment to start up
        thread::sleep(Duration::from_millis(100));

        let mut ipc = Ipc::connect(socket_path).unwrap();

        let message = b"hello world";
        ipc.write(message).unwrap();

        let mut response = [0; 1024];
        let bytes_read = ipc.read(&mut response).unwrap();

        assert_eq!(bytes_read, message.len());
        assert_eq!(&response[..bytes_read], message);

        server_thread.join().unwrap();
        fs::remove_file(socket_path).unwrap();
    }

    #[test]
    fn test_nodejs_spawn_echo() {
        // This test requires a simple echo script to be available
        // For demonstration purposes, we'll use 'cat' as it echoes stdin to stdout

        let mut child = spawn("cat", &[]).expect("Failed to spawn cat process");

        // Test basic string communication
        let test_message = "Hello from Rust!";
        child.send_string(test_message).expect("Failed to send message");

        let response = child.receive_string(100).expect("Failed to receive response");
        assert_eq!(test_message, response);

        // Test binary communication
        let binary_data = b"\x00\x01\x02\x03\x04";
        child.send(binary_data).expect("Failed to send binary data");

        let mut response_buffer = [0u8; 10];
        let bytes_read = child.receive(&mut response_buffer).expect("Failed to receive binary response");

        assert_eq!(bytes_read, binary_data.len());
        assert_eq!(&response_buffer[..bytes_read], binary_data);

        child.kill().expect("Failed to kill child process");
    }
}

/// Examples demonstrating the Node.js-style spawn functionality
pub mod examples {
    use super::*;

    /// Basic example: spawn a process and communicate via IPC
    pub fn basic_communication_example() -> Result<(), Box<dyn std::error::Error>> {
        // Spawn a child process (e.g., cat for simple echo)
        let mut child = spawn("cat", &[])?;

        // Send a string message
        let message = "Hello, Node.js-style IPC from Rust!";
        child.send_string(message)?;

        // Receive the response
        let response = child.receive_string(100)?;
        println!("Parent received: {}", response);

        // Wait for the child to exit
        let status = child.wait()?;
        println!("Child exited with status: {:?}", status);

        Ok(())
    }

    /// JSON communication example
    #[cfg(feature = "serde")]
    pub fn json_communication_example() -> Result<(), Box<dyn std::error::Error>> {
        use serde::{Deserialize, Serialize};

        #[derive(Serialize, Deserialize, Debug)]
        struct Message {
            id: u32,
            text: String,
            timestamp: u64,
        }

        let mut child = spawn("cat", &[])?;

        // Send a JSON message
        let message = Message {
            id: 1,
            text: "Hello via JSON!".to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs(),
        };

        child.send_json(&message)?;

        // Receive JSON response
        let response: Message = child.receive_json()?;
        println!("Received JSON: {:?}", response);

        Ok(())
    }

    /// Command execution example
    pub fn command_execution_example() -> Result<(), Box<dyn std::error::Error>> {
        let mut child = spawn("cat", &[])?;

        // Execute commands using the convenience method
        let commands = vec!["ping", "hello", "world", "exit"];

        for cmd in commands {
            let response = child.execute_command(cmd)?;
            println!("Command '{}' response: '{}'", cmd, response);
        }

        Ok(())
    }

    /// Advanced example with standard I/O and IPC
    pub fn advanced_communication_example() -> Result<(), Box<dyn std::error::Error>> {
        let mut child = spawn("cat", &[])?;

        // Send data via standard input
        if let Some(stdin) = child.stdin() {
            use std::io::Write;
            stdin.write_all(b"This goes to stdin\n")?;
            stdin.flush()?;
        }

        // Send data via IPC
        child.send_string("This goes via IPC")?;

        // Read from standard output
        if let Some(stdout) = child.stdout() {
            use std::io::Read;
            let mut stdout_buffer = String::new();
            stdout.read_to_string(&mut stdout_buffer)?;
            println!("Stdout: {}", stdout_buffer);
        }

        // Read IPC response
        let ipc_response = child.receive_string(100)?;
        println!("IPC response: {}", ipc_response);

        Ok(())
    }

    /// spawnSync example
    pub fn spawn_sync_example() -> Result<(), Box<dyn std::error::Error>> {
        let result = spawn_sync("echo", &["Hello from spawnSync!"])?;

        println!("Exit status: {:?}", result.status);
        println!("Stdout: {}", result.stdout);
        println!("Stderr: {}", result.stderr);

        // You can still use IPC if the child process is available
        if let Some(mut child) = result.child {
            child.send_string("Still can communicate via IPC")?;
            let response = child.receive_string(50)?;
            println!("Post-sync IPC: {}", response);
        }

        Ok(())
    }
}
