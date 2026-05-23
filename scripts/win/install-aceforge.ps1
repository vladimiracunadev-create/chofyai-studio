# ─────────────────────────────────────────────────────────────────────────────
# install-aceforge.ps1 — instala AceForge en Windows con PyTorch CUDA.
#
# ACE-Step-v1-3.5B pesa ~7.7 GB; recomendado SSD con 20 GB libres y RAM ≥ 32 GB.
# GPU NVIDIA con ≥ 12 GB VRAM para inferencia razonable.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir "..\..")
$SettingsFile = Join-Path $RepoRoot "storage\state\settings.json"
$DefaultHome  = Join-Path $env:USERPROFILE "ChofyAIStudio"

. (Join-Path $ScriptDir "common.ps1")

$StudioHome = Resolve-StudioHome -DefaultHome $DefaultHome -SettingsFile $SettingsFile
$InstallDir = Join-Path $StudioHome "tools\aceforge"
$SourceDir  = Join-Path $InstallDir "source"
$EnvDir     = Join-Path $InstallDir "env"
$ModelsRoot = Resolve-ModelsDir -StudioHome $StudioHome
$CacheDir   = Resolve-CacheDir -StudioHome $StudioHome
$LogDir     = Join-Path $StudioHome "logs"

New-Item -ItemType Directory -Force -Path $InstallDir, $ModelsRoot, $CacheDir, $LogDir | Out-Null

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Error "ffmpeg no está en el PATH. Instálalo con: winget install Gyan.FFmpeg"
    exit 1
}

if (-not (Test-Path (Join-Path $SourceDir ".git"))) {
    git clone https://github.com/woct0rdho/ACE-Step $SourceDir
} else {
    Push-Location $SourceDir
    try { git pull --ff-only } catch { Write-Host "[warn] git pull falló (continúo)" }
    Pop-Location
}

$python = Get-PythonBin -Candidates @("python3.10", "python3.11", "python")
if (-not $python) { Write-Error "Necesitas Python 3.10 o 3.11"; exit 1 }
New-PyVenv -EnvDir $EnvDir -PythonBin $python

# PyTorch — CUDA o CPU. Sin GPU AceForge es prácticamente inviable.
if (Test-CudaAvailable) {
    Write-Host "[gpu] CUDA detectado → instalando torch+cu121"
    Install-PyPackages -EnvDir $EnvDir -Packages @(
        "torch", "torchaudio",
        "--index-url", "https://download.pytorch.org/whl/cu121"
    )
} else {
    Write-Host "[warn] sin GPU NVIDIA → AceForge será MUY lento (instalando torch CPU igualmente)"
    Install-PyPackages -EnvDir $EnvDir -Packages @(
        "torch", "torchaudio",
        "--index-url", "https://download.pytorch.org/whl/cpu"
    )
}

# Requirements de AceForge
Install-PyRequirements -EnvDir $EnvDir -RequirementsFile (Join-Path $SourceDir "requirements.txt")

# HF_HOME aislado en cache
$env:HF_HOME = Join-Path $CacheDir "huggingface"
New-Item -ItemType Directory -Force -Path $env:HF_HOME | Out-Null

Write-Host ""
Write-Host "ACEFORGE_INSTALL_OK"
Write-Host "Studio Home: $StudioHome"
Write-Host "Tool Home: $InstallDir"
Write-Host "Run Server: $EnvDir\Scripts\python.exe $SourceDir\app.py --port 7857"
