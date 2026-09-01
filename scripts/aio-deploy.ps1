$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$linuxRoot = (wsl.exe wslpath -a ($projectRoot -replace '\\','/')).Trim()
if ([string]::IsNullOrWhiteSpace($linuxRoot)) { throw "WSL 2 is required and the project path could not be translated." }

$flags = @()
if ($env:OBEDIANCE_SKIP_INSTALL -eq "1") { $flags += "OBEDIANCE_SKIP_INSTALL=1" }
if ($env:OBEDIANCE_SKIP_MIGRATION -eq "1") { $flags += "OBEDIANCE_SKIP_MIGRATION=1" }
if ($env:START_APP -eq "1") { $flags += "START_APP=1" }
if ($env:START_TUNNEL -eq "1") { $flags += "START_TUNNEL=1" }

$envPrefix = if ($flags.Count -gt 0) { ($flags -join ' ') + ' ' } else { '' }
& wsl.exe bash -lc "cd '$linuxRoot' && ${envPrefix}bash scripts/aio-deploy.sh"
if ($LASTEXITCODE -ne 0) { throw "The WSL deployment workflow failed with exit code $LASTEXITCODE." }
