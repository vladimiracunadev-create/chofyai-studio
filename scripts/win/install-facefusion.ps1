# ─────────────────────────────────────────────────────────────────────────────
# install-facefusion.ps1 — instala FaceFusion en Windows.
#
# ONNX Runtime provider:
#   - GPU NVIDIA  → onnxruntime-gpu (CUDA EP)
#   - sin GPU     → onnxruntime CPU
#   - Si tienes GPU AMD/Intel y quieres aceleración, cambia a
#     onnxruntime-directml manualmente.
#
# ffmpeg debe estar en el PATH (winget install Gyan.FFmpeg).
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir "..\..")
$SettingsFile = Join-Path $RepoRoot "storage\state\settings.json"
$DefaultHome  = Join-Path $env:USERPROFILE "ChofyAIStudio"

. (Join-Path $ScriptDir "common.ps1")

$StudioHome = Resolve-StudioHome -DefaultHome $DefaultHome -SettingsFile $SettingsFile
$InstallDir = Join-Path $StudioHome "tools\facefusion"
$SourceDir  = Join-Path $InstallDir "source"
$EnvDir     = Join-Path $InstallDir "env"
$LogDir     = Join-Path $StudioHome "logs"

New-Item -ItemType Directory -Force -Path $InstallDir, $LogDir | Out-Null

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Error "ffmpeg no está en el PATH. Instálalo con: winget install Gyan.FFmpeg"
    exit 1
}

if (-not (Test-Path (Join-Path $SourceDir ".git"))) {
    git clone https://github.com/facefusion/facefusion $SourceDir
} else {
    Push-Location $SourceDir
    try { git pull --ff-only } catch { Write-Host "[warn] git pull falló (continúo)" }
    Pop-Location
}

$python = Get-PythonBin -Candidates @("python3.10", "python3.11", "python")
if (-not $python) { Write-Error "Necesitas Python 3.10 o 3.11"; exit 1 }
New-PyVenv -EnvDir $EnvDir -PythonBin $python

# FaceFusion trae un installer propio que pide conda — lo saltamos con --skip-conda
# y usamos nuestro venv. Mismo workaround que en el script de Mac (I6 del POSTMORTEM).
Push-Location $SourceDir
try {
    & "$EnvDir\Scripts\python.exe" install.py --skip-conda --onnxruntime ($(if (Test-CudaAvailable) { "cuda" } else { "default" }))
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "FACEFUSION_INSTALL_OK"
Write-Host "Studio Home: $StudioHome"
Write-Host "Tool Home: $InstallDir"
Write-Host "Run Server: $EnvDir\Scripts\python.exe $SourceDir\facefusion.py run --execution-providers $(if (Test-CudaAvailable) { 'cuda' } else { 'cpu' })"
