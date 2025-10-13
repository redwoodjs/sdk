# 2025-10-09: Investigate Windows Integration Issues

## Problem

The SDK has several known issues when running on Windows. These seem to be primarily related to file path handling, leading to errors during development server startup and other filesystem operations. I don't have a Windows machine for testing, which makes debugging these problems difficult.

Known errors include:
- `ERR_UNSUPPORTED_ESM_URL_SCHEME`: Node.js's ESM loader receives a path with a drive letter (e.g., `c:`) instead of a `file://` URL. This indicates that absolute paths on Windows are not being correctly converted to file URLs before being passed to `import()`.
- `ENOENT: no such file or directory`: The application attempts to create a directory at a path that appears to have a duplicated drive letter (e.g., `C:\C:\...`). This suggests an issue with path joining or normalization where an absolute path is being incorrectly concatenated with another path segment that includes the drive root.

The goal is to establish a reliable method for debugging the SDK on a Windows environment to identify and fix these and any other platform-specific issues.

## Plan

1.  **Set up a debugging environment**: Create a GitHub Actions workflow that provides a shell on a Windows runner. This will serve as a remote debugging environment.
2.  **Use tmate for SSH access**: The workflow will use `tmate` to create a remote SSH session, allowing interactive access to the Windows runner to run commands, inspect the filesystem, and debug the SDK in a live environment.
3.  **Reproduce the errors**: Once the environment is accessible, the next step will be to run the playground examples or other test cases to reproduce the reported path issues.
4.  **Investigate and fix**: With a reproducible case, I can start debugging the code to find the root cause of the path handling problems and implement fixes. This will likely involve ensuring all path manipulations are handled in a platform-agnostic way, possibly using Node's `path` module more consistently and using `pathToFileURL` from the `url` module where appropriate.

This work log will track the progress of this investigation.

## 2025-10-13: Scripting and Automation Attempts

The initial phase focused on creating a script to automate the process of starting the debug workflow and connecting to the tmate session. Several approaches were attempted:

1.  **Log Scraping (`gh run view --log`)**: The script polled the logs of the workflow run, looking for the SSH connection string. This failed because the `gh` command waits for the run to complete before outputting logs, which it never does while tmate is active.
2.  **Log Streaming (`gh run watch`)**: This improved on the first approach by streaming logs in real time. While functional, it proved to be brittle and sometimes failed to capture the connection string reliably.
3.  **Artifact Upload/Download**: The workflow was modified to save the connection string to a file and upload it as an artifact. The script would then poll for and download this artifact. This method was plagued by a series of platform-specific issues on the Windows runner, including problems with package managers (`scoop`, `choco`), PATH variables, and file system paths, making it unreliable.

Given the time spent on these automation attempts, the decision was made to simplify the script significantly. The new approach is to have the script only trigger the workflow and provide a direct link to the run. The developer can then manually copy the SSH connection string from the logs. This provides a reliable, albeit less automated, solution that allows the primary goal—debugging on Windows—to proceed without further delay. The script will also provide instructions for mounting the remote filesystem locally with `sshfs` for convenience.

## 2025-10-13: Iteration Towards a VS Code Solution

The terminal-only solution was deemed insufficient, as the ability to debug within VS Code was a primary requirement. The investigation then pivoted to finding a reliable way to connect the VS Code "Remote - SSH" extension to the Windows runner.

### Attempt 1: Fixing `tmate` for VS Code

The initial theory was that VS Code's connection failures with `tmate` were due to strict host key checking. The script was updated to guide the user to add a `~/.ssh/config` entry for `*.tmate.io`.

**Finding:** This did not work. Deeper investigation of the VS Code extension's logs revealed the root cause: the extension doesn't just open a shell; it tries to execute a setup script on the remote host. The `tmate` session, not being a standard SSH server, rejects this script with an "Invalid command" error. This proved that `tmate` is fundamentally incompatible with the VS Code Remote SSH extension's automated setup.

### Attempt 2: `ngrok` with a real SSH server

To solve the incompatibility, the approach shifted to running a standard OpenSSH server on the Windows runner and exposing it to the internet. `ngrok` was chosen as the tunneling tool.

This attempt was plagued by a series of reliability issues with launching the `ngrok` process from PowerShell on the GitHub Actions runner:
- The `ngrok` process failed to start silently when called directly.
- Attempts to use `Start-Process` and `Start-Job` also failed to launch the process reliably.
- Issues with the `PATH` environment variable and finding the executable's location led to multiple failures.
- It was concluded that `ngrok`'s client was too brittle in this specific execution environment.

### Attempt 3: `serveo.net`

The final and current approach replaces `ngrok` with `serveo.net`. This method is simpler and more robust because it does not require installing any third-party client. It uses the standard `ssh` client, which is already present on the runner, to create a reverse tunnel.

The workflow now:
1.  Starts the standard OpenSSH server.
2.  Uses `ssh` to connect to `serveo.net` in the background, creating the tunnel.
3.  Resiliently polls a log file to capture the public URL provided by `serveo`.
4.  Saves the connection details to an artifact for the local script to consume.

This method avoids the client installation and process-launching issues that doomed `ngrok`, while still providing a real SSH server that is fully compatible with VS Code.

## 2025-10-13: Interactive Debugging Pivot

The automated approach of setting up a VS Code-compatible SSH server via `ngrok` or `serveo.net` proved unreliable. The scripts failed consistently, preventing the acquisition of a shell.

The strategy has been changed to prioritize getting *any* interactive shell first, which can then be used to manually debug the runner environment and figure out the correct commands for a more permanent solution.

**Plan:**
1.  **Revert to `tmate`:** The GitHub Actions workflow was reverted to a minimal configuration that uses `mxschmitt/action-tmate@v3`. This action is known to reliably provide a terminal SSH session.
2.  **Log-Scraping Script:** A `debug-windows.mts` script was created to automate the process of triggering the workflow and parsing the runner logs to extract the `tmate` SSH connection string. This avoids the complexities of artifact passing and provides the user with a direct command to connect.
3.  **Interactive Investigation:** Once connected, the shell will be used to live-test the commands that were previously failing in the workflow (`ngrok`, `choco`, `serveo.net`, etc.) to understand the environment's limitations and find a working sequence.
