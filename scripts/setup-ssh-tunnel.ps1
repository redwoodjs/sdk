# FINAL SCRIPT - Sets up zrok and configures PowerShell as the default SSH shell.
# This script is designed to be run directly by a GitHub Actions workflow step.
# The final 'zrok share' command will block, keeping the workflow alive.

# 1. User Input: Get the zrok enable token from GitHub Actions secrets
# IMPORTANT: You must create a repository secret named ZROK_TOKEN with your enable token.
if (-not ($env:ZROK_TOKEN)) {
    Write-Error "ZROK_TOKEN secret is not set. Please add it to your repository secrets."
    exit 1
}
$zrokToken = $env:ZROK_TOKEN

# 2. Ensure OpenSSH server is running so we can configure it
Write-Host "Ensuring sshd service is running..."
Start-Service sshd

# 3. Set PowerShell as the Default SSH Shell (The VS Code Fix)
Write-Host "Setting PowerShell as the default SSH shell..."
$pwshPath = "C:\Program Files\PowerShell\7\pwsh.exe"
Set-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value $pwshPath -Force
Write-Host "Default SSH shell configured."

# 4. CRITICAL FIX: Restart the SSH service to apply the new default shell
Write-Host "Restarting sshd service to apply registry changes..."
Restart-Service sshd
Write-Host "sshd service restarted."

# 5. Download and Extract zrok v1.1.1
Write-Host "Downloading zrok v1.1.1..."
$zrokUri = "https://github.com/openziti/zrok/releases/download/v1.1.1/zrok_1.1.1_windows_amd64.tar.gz"
$zrokArchive = "$env:TEMP\zrok.tar.gz"
Invoke-WebRequest -Uri $zrokUri -OutFile $zrokArchive
Write-Host "Extracting zrok..."
tar -xzf $zrokArchive -C $env:TEMP
$env:PATH += ";$env:TEMP"
Write-Host "zrok installed to temporary directory."

# 6. Enable zrok
Write-Host "Enabling zrok environment..."
# Use -v to get rich output in the logs
zrok -v enable $zrokToken

# 7. Set a new, random password for the runneradmin user
Write-Host "Generating new password for runneradmin..."
$password = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
Get-LocalUser -Name "runneradmin" | Set-LocalUser -Password $securePassword
Write-Host "Password for 'runneradmin' is: $password" -ForegroundColor Green

# 8. Start the zrok tunnel and block
Write-Host "`n"
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "Starting zrok tunnel. This will block the workflow."
Write-Host "Find the TCP address in the logs below to connect."
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "`n"

# The '-v' flag will provide verbose output in the GitHub Actions log,
# ensuring we can see the tcp:// address.
zrok -v share private tcp://127.0.0.1:22
