# ─────────────────────────────────────────────────────────────────────────────
# install-whispercpp.ps1 — instala whisper.cpp en Windows.
#
# Estrategia:
#   - Si nvidia-smi está disponible → build con CUDA (mucho más rápido)
#   - Si no → build CPU puro (siempre funciona)
#
# Requisitos previos en el host:
#   - Git para Windows
#   - CMake 3.x+
#   - Visual Studio Build Tools 2022 con "Desktop development with C++"
#   - (Opcional) CUDA Toolkit 12.x para aceleración GPU
#
# Equivalente a scripts/mac/install-whispercpp.sh (que usa Metal).
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir "..\..")
$SettingsFile = Join-Path $RepoRoot "storage\state\settings.json"
$DefaultHome  = Join-Path $env:USERPROFILE "ChofyAIStudio"

. (Join-Path $ScriptDir "common.ps1")

$StudioHome = Resolve-StudioHome -DefaultHome $DefaultHome -SettingsFile $SettingsFile
$InstallDir = Join-Path $StudioHome "tools\whispercpp"
$SourceDir  = Join-Path $InstallDir "source"
$ModelsDir  = Join-Path $InstallDir "models"
$LogDir     = Join-Path $StudioHome "logs"

New-Item -ItemType Directory -Force -Path $InstallDir, $SourceDir, $ModelsDir, $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "inputs"), (Join-Path $InstallDir "outputs") | Out-Null

foreach ($bin in @("git", "cmake")) {
    if (-not (Get-Command $bin -ErrorAction SilentlyContinue)) {
        Write-Error "$bin no está disponible en el PATH"
        exit 1
    }
}

if (-not (Test-Path (Join-Path $SourceDir ".git"))) {
    git clone https://github.com/ggml-org/whisper.cpp $SourceDir
} else {
    Push-Location $SourceDir
    try { git pull --ff-only } catch { Write-Host "[warn] git pull falló (continúo)" }
    Pop-Location
}

Push-Location $SourceDir
try {
    # Detectar y limpiar CMakeCache.txt obsoleto (paths absolutos)
    $cachePath = Join-Path $SourceDir "build\CMakeCache.txt"
    if (Test-Path $cachePath) {
        $cachedSrc = (Select-String -Path $cachePath -Pattern 'CMAKE_HOME_DIRECTORY:INTERNAL=(.*)' | Select-Object -First 1).Matches.Groups[1].Value
        if ($cachedSrc -and $cachedSrc -ne $SourceDir) {
            Write-Host "[clean] CMakeCache apunta a $cachedSrc, esperado $SourceDir — limpiando build/"
            Remove-Item -Recurse -Force (Join-Path $SourceDir "build")
        }
    }

    $cmakeArgs = @("-B", "build")
    if (Test-CudaAvailable) {
        Write-Host "[gpu] nvidia-smi detectado → compilando con CUDA"
        $cmakeArgs += "-DGGML_CUDA=ON"
    } else {
        Write-Host "[cpu] sin GPU NVIDIA → compilando CPU-only"
    }

    cmake @cmakeArgs
    cmake --build build --config Release -j 4
} finally {
    Pop-Location
}

$modelFile = Join-Path $ModelsDir "ggml-base.en.bin"
if (-not (Test-Path $modelFile)) {
    Write-Host "[hf] descargando modelo base.en (141 MB)"
    Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" `
                      -OutFile $modelFile
}

# Comando de arranque equivalente al del manifest mac
$serverExe = Join-Path $SourceDir "build\bin\Release\whisper-server.exe"
if (-not (Test-Path $serverExe)) {
    $serverExe = Join-Path $SourceDir "build\bin\whisper-server.exe"
}

Write-Host ""
Write-Host "WHISPERCPP_INSTALL_OK"
Write-Host "Studio Home: $StudioHome"
Write-Host "Tool Home: $InstallDir"
Write-Host "Run Server: $serverExe --host 127.0.0.1 --port 8178 -m $modelFile"
