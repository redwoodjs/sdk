## Final Solution: Hybrid `tmate` + VS Code SFTP Extension

After discovering that `sshfs` requires `macFUSE`, which has an invasive installation process on modern macOS, a superior solution was identified. Instead of mounting the remote filesystem at the OS level, a VS Code extension can be used to handle the file operations directly. This achieves the same goal with zero complex local dependencies.

### The Automated SFTP Workflow

1.  **A Minimal `tmate` Workflow:** The `windows-debug.yml` workflow remains in its simple, robust form, launching a `tmate` session to provide the core SSH connection.

2.  **New Orchestration Script (`scripts/connect-windows-debug.mts`):** A new script was created to automate the SFTP setup. It performs the following steps:
    *   Triggers the `windows-debug.yml` workflow on the user's current branch.
    *   Polls the logs to retrieve the `tmate` SSH connection string.
    *   Parses the SSH string to extract the username and hostname.
    *   **Automatically generates a `.vscode/sftp.json` file** with the correct connection details for the SFTP extension.
    *   Finally, it prints clear, numbered instructions for the user, telling them how to use the SFTP extension in VS Code and how to open their separate interactive shell.

This solution provides the two key components of remote development without requiring any complex setup on the user's local machine beyond the SFTP extension itself. It is a clean, robust, and user-friendly conclusion to the investigation.
