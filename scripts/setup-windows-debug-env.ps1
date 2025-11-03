# Setup script for Windows Debug Session
# Sets up git aliases, PowerShell profile, and bash profile

param(
    [string]$CursorTunnelName = "",
    [string]$WorkspacePath = $env:GITHUB_WORKSPACE,
    [string]$CloudflareAccountId = "",
    [string]$CloudflareApiToken = "",
    [string]$GitUserName = "",
    [string]$GitUserEmail = ""
)

# Setup PowerShell profile that auto-runs tunnel and includes git aliases
$ProfileDir = Split-Path -Parent $PROFILE
if (-not (Test-Path $ProfileDir)) {
    New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
}

$TunnelCmd = if ($CursorTunnelName -ne "") {
    "& '.\.tmp\cursor_cli\cursor.exe' tunnel --name '$CursorTunnelName' --verbose"
} else {
    "& '.\.tmp\cursor_cli\cursor.exe' tunnel --random-name --verbose"
}

# Git config setup
$GitConfig = ""
if ($GitUserName -ne "") {
    $GitConfig += "git config --global user.name '$GitUserName'`n"
}
if ($GitUserEmail -ne "") {
    $GitConfig += "git config --global user.email '$GitUserEmail'`n"
}

# Git aliases as PowerShell functions
# Remove any existing aliases that might conflict with our functions
$AliasesToRemove = @('gs', 'ga', 'gf', 'gpll', 'gpsh', 'gpshu', 'gpshh', 'gm', 'grm', 'gch', 'gffs', 'gfff', 'grh', 'gb', 'grb', 'gll', 'gd', 'gds', 'gl', 'gc', 'gcm', 'gca', 'gst', 'gssh', 'gsap', 'gsa', 'gcp')
$RemoveAliasesScript = ""
foreach ($alias in $AliasesToRemove) {
    $RemoveAliasesScript += "if (Get-Alias -Name $alias -ErrorAction SilentlyContinue) { Remove-Item Alias:$alias -Force -ErrorAction SilentlyContinue }`n"
}

$GitAliases = @"
# Remove conflicting aliases
$RemoveAliasesScript

# Git aliases (functions take precedence over aliases)
function gs { git status @args }
function ga { git add @args }
function gf { git fetch @args }
function gpll { git pull @args }
function gpsh { git push @args }
function gpshu { git push -u @args }
function gpshh { git pull; git push }
function gm { git merge @args }
function grm { git rm @args }
function gch { git checkout @args }
function gffs { git flow feature start @args }
function gfff { git flow feature finish @args }
function grh { git reset HEAD @args }
function gb { git branch @args }
function grb { git rebase @args }
function gll { param([string]`$args) git log `$args | less }
function gd { git diff @args }
function gds { git diff --staged @args }
function gd@ { param([int]`$n) git diff HEAD~(`$n + 1) HEAD~`$n }
function gl { git log @args }
function gc { git commit @args }
function gcm { git commit -m @args }
function gca { git commit --amend @args }
function gst { git stash @args }
function gssh { param([int]`$n) git stash show -p "stash@{`$n}" }
function gsap { param([int]`$n) git stash apply "stash@{`$n}" }
function gsa { git stash; git stash apply "stash@{0}" }
function gcp { git cherry-pick @args }

# Add ad script to PATH
`$env:Path += ";$WorkspacePath\.tmp\bin"
"@

# Set Cloudflare credentials as environment variables (without logging)
$CloudflareEnvVars = ""
if ($CloudflareAccountId -ne "") {
    $env:CLOUDFLARE_ACCOUNT_ID = $CloudflareAccountId
    [Environment]::SetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", $CloudflareAccountId, [EnvironmentVariableTarget]::User)
    $CloudflareEnvVars += "`$env:CLOUDFLARE_ACCOUNT_ID = '$CloudflareAccountId'`n"
}
if ($CloudflareApiToken -ne "") {
    $env:CLOUDFLARE_API_TOKEN = $CloudflareApiToken
    [Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $CloudflareApiToken, [EnvironmentVariableTarget]::User)
    $CloudflareEnvVars += "`$env:CLOUDFLARE_API_TOKEN = '$CloudflareApiToken'`n"
}

$AutoRunScript = @"
# Auto-run script for Windows Debug Session
Write-Host "`n🚀 Auto-starting Cursor tunnel...`n" -ForegroundColor Cyan
Set-Location "$WorkspacePath"

# Configure git
$GitConfig

$GitAliases

# Set Cloudflare credentials
$CloudflareEnvVars

$TunnelCmd
"@

Set-Content -Path $PROFILE -Value $AutoRunScript
Write-Host "PowerShell profile created at: $PROFILE"

# Confirm Cloudflare credentials were set (without exposing values)
if ($CloudflareAccountId -ne "" -or $CloudflareApiToken -ne "") {
    Write-Host "Cloudflare credentials have been set as environment variables" -ForegroundColor Green
}

# Setup bash profiles to auto-launch PowerShell
# .bash_profile is sourced for login shells (like SSH)
# .bashrc is sourced for interactive non-login shells
$BashAutoRun = @"
# Auto-launch PowerShell for Windows Debug Session
if [ -z "$PS_LAUNCHED" ]; then
  export PS_LAUNCHED=1
  echo "🚀 Launching PowerShell session..."
  pwsh.exe
fi
"@

# Set up .bash_profile (for login shells like SSH)
$BashProfile = "$env:USERPROFILE\.bash_profile"
Set-Content -Path $BashProfile -Value $BashAutoRun -Encoding UTF8
Write-Host "Bash profile (.bash_profile) created at: $BashProfile"

# Also set up .bashrc (for interactive shells)
$BashRc = "$env:USERPROFILE\.bashrc"
Set-Content -Path $BashRc -Value $BashAutoRun -Encoding UTF8
Write-Host "Bash profile (.bashrc) created at: $BashRc"

# Ensure .bash_profile sources .bashrc if it exists
$BashProfileContent = @"
# Source .bashrc if it exists
if [ -f `$HOME/.bashrc ]; then
  source `$HOME/.bashrc
fi

$BashAutoRun
"@
Set-Content -Path $BashProfile -Value $BashProfileContent -Encoding UTF8
Write-Host "Updated .bash_profile to source .bashrc"

