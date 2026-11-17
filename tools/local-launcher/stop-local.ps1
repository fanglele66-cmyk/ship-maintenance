[CmdletBinding()]
param(
    [ValidateSet('all', 'ship', 'shore')]
    [string]$Side = 'all'
)

# Stops only backend/Vite processes recorded by start-local.ps1 in this project root.
# PID, creation time, executable and complete command line must all still match.
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$runtimeDir = Join-Path $projectRoot '.runtime'
$statePath = Join-Path $runtimeDir 'pid.json'
$lockPath = Join-Path $runtimeDir 'local-runtime.lock'
$services = @{
    ship = [pscustomobject]@{ RelativePath = 'ship-maintenance\phase2-demo'; Port = 5173 }
    shore = [pscustomobject]@{ RelativePath = 'shore-ship-maintenance\shore-phase2-demo'; Port = 5174 }
}

if (-not (Test-Path -LiteralPath $statePath)) {
    Write-Host 'No managed runtime records; no process was stopped.'
    return
}

function Save-RuntimeState {
    param($State)
    $temporaryPath = Join-Path $runtimeDir 'pid.json.tmp'
    [System.IO.File]::WriteAllText($temporaryPath, ($State | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($true))
    Move-Item -LiteralPath $temporaryPath -Destination $statePath -Force
}

$lockHandle = $null
try {
    try {
        $lockHandle = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch {
        throw 'Another start-local.ps1 or stop-local.ps1 is running. Retry after it finishes.'
    }
    $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($state.version -ne 1 -or $state.projectRoot -ine $projectRoot -or $null -eq $state.processes) {
        throw "Unrecognized runtime state: $statePath. No process has been stopped."
    }
    foreach ($record in @($state.processes)) {
        if ($Side -ne 'all' -and $record.side -ne $Side) { continue }
        if (-not $services.ContainsKey([string]$record.side) -or $record.projectRoot -ine $projectRoot) {
            Write-Warning 'Skipping an unrecognized runtime entry; no process was stopped for it.'
            continue
        }
        $service = $services[[string]$record.side]
        $vitePath = Join-Path (Join-Path $projectRoot $service.RelativePath) 'node_modules\vite\bin\vite.js'
        $process = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f [int]$record.pid) -ErrorAction Stop
        if ($null -eq $process) {
            Write-Host ("Already stopped: {0} (old PID {1})" -f $record.side, $record.pid)
            $state.processes = @($state.processes | Where-Object { $_.side -ne $record.side })
            Save-RuntimeState -State $state
            continue
        }
        $createdAt = $process.CreationDate.ToUniversalTime().Ticks
        $recordedCreation = ([DateTime]$record.creationTimeUtc).ToUniversalTime().Ticks
        $vitePattern = '(?i)(?:^|\s)"?' + [regex]::Escape($vitePath) + '"?(?:\s|$)'
        $portPattern = '(?:^|\s)--port\s+' + $service.Port + '(?:\s|$)'
        $entryMatches = $process.CommandLine -match $vitePattern -and
            $process.CommandLine -match '(?:^|\s)--host\s+127\.0\.0\.1(?:\s|$)' -and
            $process.CommandLine -match $portPattern -and
            $process.CommandLine -match '(?:^|\s)--strictPort(?:\s|$)'
        if ($record.mode -eq 'backend') {
            $entryPath = Join-Path (Join-Path $projectRoot $service.RelativePath) 'server\local-server.mjs'
            $entryPattern = '(?i)(?:^|\s)"?' + [regex]::Escape($entryPath) + '"?(?:\s|$)'
            $entryMatches = $record.side -eq 'ship' -and $record.port -eq 5173 -and
                $record.entryPath -ieq $entryPath -and $process.CommandLine -match $entryPattern
        }
        if ($createdAt -ne $recordedCreation -or
            $process.ExecutablePath -ine $record.nodePath -or
            $process.CommandLine -cne $record.commandLine -or
            -not $entryMatches) {
            Write-Warning ("PID {0} no longer matches the recorded {1} service. It will NOT be stopped." -f $record.pid, $record.side)
            $state.processes = @($state.processes | Where-Object { $_.side -ne $record.side })
            Save-RuntimeState -State $state
            continue
        }
        # Acquire a process handle and compare its start time again to protect
        # against PID reuse between the CIM check and the actual stop operation.
        $target = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
        if ($null -eq $target) {
            $state.processes = @($state.processes | Where-Object { $_.side -ne $record.side })
            Save-RuntimeState -State $state
            continue
        }
        $handle = $target.Handle
        $startDifference = [Math]::Abs(($target.StartTime.ToUniversalTime() - $process.CreationDate.ToUniversalTime()).TotalMilliseconds)
        if ($startDifference -gt 1) {
            Write-Warning ("PID {0} changed during verification. No process was stopped." -f $record.pid)
            continue
        }
        $target.Kill()
        if (-not $target.WaitForExit(10000)) {
            throw "Timed out stopping managed PID $($record.pid). Its runtime record was retained."
        }
        Write-Host ("Stopped: {0} (PID {1})" -f $record.side, $record.pid)
        $state.processes = @($state.processes | Where-Object { $_.side -ne $record.side })
        Save-RuntimeState -State $state
        if ($record.side -eq 'ship') {
            $activePath = Join-Path (Join-Path $projectRoot $service.RelativePath) '.local-data\server-active.json'
            if (Test-Path -LiteralPath $activePath) {
                $active = Get-Content -LiteralPath $activePath -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($active.pid -eq $record.pid) { Remove-Item -LiteralPath $activePath }
            }
        }
    }
    Write-Host 'Logs remain in .runtime for inspection.'
} finally {
    if ($null -ne $lockHandle) { $lockHandle.Dispose() }
}
