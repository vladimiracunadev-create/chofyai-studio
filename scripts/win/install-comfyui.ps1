# ─────────────────────────────────────────────────────────────────────────────
# install-comfyui.ps1 — instala ComfyUI en Windows con CUDA (o CPU).
#
# Detecta GPU NVIDIA y elige el wheel de PyTorch apropiado:
#   - CUDA 12.1+ → torch con cu121 index
#   - sin GPU    → torch CPU (lento pero funciona)
#
# Modelo base por defecto: SD 1.5 v1-5-pruned-emaonly. Cambiable a SDXL/Flux
# editando los enlaces más abajo.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir "..\..")
$SettingsFile = Join-Path $RepoRoot "storage\state\settings.json"
$DefaultHome  = Join-Path $env:USERPROFILE "ChofyAIStudio"

. (Join-Path $ScriptDir "common.ps1")

$StudioHome = Resolve-StudioHome -DefaultHome $DefaultHome -SettingsFile $SettingsFile
$InstallDir = Join-Path $StudioHome "tools\comfyui"
$SourceDir  = Join-Path $InstallDir "ComfyUI"
$EnvDir     = Join-Path $InstallDir "env"
$ModelsRoot = Resolve-ModelsDir -StudioHome $StudioHome
$OutputsDir = Resolve-OutputsDir -StudioHome $StudioHome
$LogDir     = Join-Path $StudioHome "logs"

New-Item -ItemType Directory -Force -Path $InstallDir, $ModelsRoot, $OutputsDir, $LogDir | Out-Null

# Clone upstream
if (-not (Test-Path (Join-Path $SourceDir ".git"))) {
    git clone https://github.com/comfyanonymous/ComfyUI $SourceDir
} else {
    Push-Location $SourceDir
    try { git pull --ff-only } catch { Write-Host "[warn] git pull falló (continúo)" }
    Pop-Location
}

# Venv con Python 3.11 (ComfyUI funciona bien con 3.10 y 3.11)
$python = Get-PythonBin -Candidates @("python3.11", "python3.10", "python")
if (-not $python) { Write-Error "Necesitas Python 3.10 o 3.11"; exit 1 }
New-PyVenv -EnvDir $EnvDir -PythonBin $python

# PyTorch — CUDA o CPU
if (Test-CudaAvailable) {
    Write-Host "[gpu] CUDA detectado → instalando torch+cu121"
    Install-PyPackages -EnvDir $EnvDir -Packages @(
        "torch", "torchvision", "torchaudio",
        "--index-url", "https://download.pytorch.org/whl/cu121"
    )
} else {
    Write-Host "[cpu] sin GPU NVIDIA → instalando torch CPU (lento)"
    Install-PyPackages -EnvDir $EnvDir -Packages @(
        "torch", "torchvision", "torchaudio",
        "--index-url", "https://download.pytorch.org/whl/cpu"
    )
}

# Requirements upstream
Install-PyRequirements -EnvDir $EnvDir -RequirementsFile (Join-Path $SourceDir "requirements.txt")

# Junctions (equivalente a symlinks en mac) para que ComfyUI use los dirs
# centralizados de modelos/outputs en lugar de los suyos locales.
foreach ($pair in @(
    @{ Link = (Join-Path $SourceDir "models");  Target = $ModelsRoot },
    @{ Link = (Join-Path $SourceDir "output");  Target = $OutputsDir }
)) {
    $link = $pair.Link
    $target = $pair.Target
    if (Test-Path $link) {
        # Si existe como dir normal y no como junction, mover su contenido
        $item = Get-Item $link -Force
        if (-not $item.LinkType) {
            $backup = "$link.bak"
            Move-Item $link $backup
        }
    }
    if (-not (Test-Path $link)) {
        New-Item -ItemType Junction -Path $link -Target $target | Out-Null
        Write-Host "[link] $link → $target"
    }
}

# Modelo base SD 1.5
$ckptDir  = Join-Path $ModelsRoot "checkpoints"
New-Item -ItemType Directory -Force -Path $ckptDir | Out-Null
$ckptFile = Join-Path $ckptDir "v1-5-pruned-emaonly.safetensors"
if (-not (Test-Path $ckptFile)) {
    Write-Host "[hf] descargando SD 1.5 base (~4 GB) — esto tarda"
    Invoke-WebRequest -Uri "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors" `
                      -OutFile $ckptFile
}

Write-Host ""
Write-Host "COMFYUI_INSTALL_OK"
Write-Host "Studio Home: $StudioHome"
Write-Host "Tool Home: $InstallDir"
Write-Host "Run Server: $EnvDir\Scripts\python.exe $SourceDir\main.py --port 8188"
