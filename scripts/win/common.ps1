# ─────────────────────────────────────────────────────────────────────────────
# common.ps1 — utilidades compartidas por los scripts de instalación Windows.
#
# Provee:
#   * Resolve-StudioHome      · resolución de path con fallback
#   * Get-PythonBin           · ubica un Python aceptable (preferred → fallback)
#   * Get-UvBin               · imprime path a uv si está disponible
#   * New-PyVenv              · crea (o reutiliza) un venv con uv o python -m venv
#   * Install-PyPackages      · pip install vía uv o pip clásico
#   * Resolve-ModelsDir / Resolve-OutputsDir / Resolve-CacheDir
#     honran las env vars CHOFYAI_MODELS_DIR / OUTPUTS_DIR / CACHE_DIR
#
# Equivalente a scripts/mac/common.sh — misma API funcional, diferente sintaxis.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

function Resolve-StudioHome {
    [CmdletBinding()]
    param(
        [string]$DefaultHome = "$env:USERPROFILE\ChofyAIStudio",
        [string]$SettingsFile = ""
    )

    $studioHome = if ($env:CHOFYAI_STUDIO_HOME) { $env:CHOFYAI_STUDIO_HOME }
                  elseif ($env:STUDIO_HOME) { $env:STUDIO_HOME }
                  else { "" }

    if (-not $studioHome -and $SettingsFile -and (Test-Path $SettingsFile)) {
        try {
            $json = Get-Content -Raw $SettingsFile | ConvertFrom-Json
            $studioHome = $json.studio_home
        } catch { $studioHome = "" }
    }

    if (-not $studioHome -or $studioHome -eq "null") {
        $studioHome = $DefaultHome
    }

    # Si la carpeta no existe pero su padre sí, mantener.
    # Si no es escribible, caer al default.
    $parent = Split-Path $studioHome -Parent
    if (-not (Test-Path $studioHome) -and -not (Test-Path $parent)) {
        $studioHome = $DefaultHome
    }

    return $studioHome
}

function Get-PythonBin {
    [CmdletBinding()]
    param(
        [string[]]$Candidates = @("python3.11", "python3.10", "python3.12", "python", "py")
    )
    foreach ($c in $Candidates) {
        $cmd = Get-Command $c -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

function Get-UvBin {
    if ($env:CHOFYAI_DISABLE_UV -eq "1") { return $null }
    $cmd = Get-Command uv -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function New-PyVenv {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$EnvDir,
        [string]$PythonBin = ""
    )
    if (-not $PythonBin) {
        $PythonBin = Get-PythonBin
        if (-not $PythonBin) { throw "No encontré una versión usable de Python (instala Python 3.10 o 3.11)" }
    }

    if ((Test-Path $EnvDir) -and (Test-Path "$EnvDir\Scripts\python.exe")) {
        Write-Host "[uv] Reutilizando venv existente: $EnvDir"
        return
    }

    $uv = Get-UvBin
    if ($uv) {
        Write-Host "[uv] Creando venv con uv: $EnvDir (python=$PythonBin)"
        & $uv venv --python $PythonBin $EnvDir
        New-Item -ItemType File -Force "$EnvDir\.chofyai-uv" | Out-Null
    } else {
        Write-Host "[pip] uv no disponible, usando python -m venv: $EnvDir"
        & $PythonBin -m venv $EnvDir
    }
}

function Install-PyPackages {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$EnvDir,
        [Parameter(Mandatory)][string[]]$Packages
    )
    $uv = Get-UvBin
    if ((Test-Path "$EnvDir\.chofyai-uv") -and $uv) {
        $env:VIRTUAL_ENV = $EnvDir
        & $uv pip install @Packages
    } else {
        & "$EnvDir\Scripts\python.exe" -m pip install @Packages
    }
}

function Install-PyRequirements {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$EnvDir,
        [Parameter(Mandatory)][string]$RequirementsFile
    )
    $uv = Get-UvBin
    if ((Test-Path "$EnvDir\.chofyai-uv") -and $uv) {
        Write-Host "[uv] Instalando requirements: $RequirementsFile"
        $env:VIRTUAL_ENV = $EnvDir
        & $uv pip install -r $RequirementsFile
    } else {
        Write-Host "[pip] Instalando requirements: $RequirementsFile"
        & "$EnvDir\Scripts\python.exe" -m pip install -r $RequirementsFile
    }
}

function Resolve-ModelsDir {
    param([string]$StudioHome)
    if ($env:CHOFYAI_MODELS_DIR) { return $env:CHOFYAI_MODELS_DIR }
    return (Join-Path $StudioHome "models")
}

function Resolve-OutputsDir {
    param([string]$StudioHome)
    if ($env:CHOFYAI_OUTPUTS_DIR) { return $env:CHOFYAI_OUTPUTS_DIR }
    return (Join-Path $StudioHome "outputs")
}

function Resolve-CacheDir {
    param([string]$StudioHome)
    if ($env:CHOFYAI_CACHE_DIR) { return $env:CHOFYAI_CACHE_DIR }
    return (Join-Path $StudioHome "cache")
}

function Test-CudaAvailable {
    # Heurística rápida: existe `nvidia-smi` en PATH.
    $smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    return [bool]$smi
}
