[CmdletBinding()]
param(
    [ValidateSet('all', 'ship', 'shore')]
    [string]$Side = 'all',
    [switch]$OpenBrowser,
    [ValidateRange(10, 600)]
    [int]$PageTimeoutSeconds = 90
)

# PowerShell 5.1 compatible. This script never installs dependencies or stops
# an unrelated process. Keep this file in the parent of the two repositories.
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$runtimeDir = Join-Path $projectRoot '.runtime'
$statePath = Join-Path $runtimeDir 'pid.json'
$lockPath = Join-Path $runtimeDir 'local-runtime.lock'
$services = @(
    [pscustomobject]@{ Side = 'ship'; RelativePath = 'ship-maintenance\phase2-demo'; Port = 5173 },
    [pscustomobject]@{ Side = 'shore'; RelativePath = 'shore-ship-maintenance\shore-phase2-demo'; Port = 5174 }
)
if ($Side -ne 'all') { $services = @($services | Where-Object { $_.Side -eq $Side }) }

function Wait-ForServicePage {
    param([int]$Port)
    $uri = "http://127.0.0.1:$Port/"
    $diagnosticPath = Join-Path $runtimeDir 'startup.log'
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    $lastError = 'No HTTP response received.'
    Write-Host "Waiting for $uri (up to $PageTimeoutSeconds seconds)..."
    while ($timer.Elapsed.TotalSeconds -lt $PageTimeoutSeconds) {
        $request = $null
        $response = $null
        try {
            # Use a direct loopback request, independent of system proxy settings.
            # Check the real account API as well as the page for the ship backend.
            $request = [System.Net.HttpWebRequest]::Create($uri)
            $request.Proxy = $null
            $remainingMs = [Math]::Max(1, [int](($PageTimeoutSeconds - $timer.Elapsed.TotalSeconds) * 1000))
            $request.Timeout = [Math]::Min(15000, $remainingMs)
            $request.ReadWriteTimeout = $request.Timeout
            $response = $request.GetResponse()
            if ([int]$response.StatusCode -eq 200) {
                if ($Port -eq 5173) {
                    $probe = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/api/auth/me")
                    $probe.Proxy = $null
                    $probe.Headers.Add('X-Engine-Room-Client', 'local-ui')
                    $probe.Timeout = 5000
                    $api = $null
                    $reader = $null
                    try {
                        $api = $probe.GetResponse()
                        $reader = [System.IO.StreamReader]::new($api.GetResponseStream())
                        $account = $reader.ReadToEnd() | ConvertFrom-Json
                        if ($account.PSObject.Properties.Name -notcontains 'user') { throw 'Account API is not ready.' }
                    } finally {
                        if ($null -ne $reader) { $reader.Dispose() }
                        if ($null -ne $api) { $api.Close() }
                        $probe.Abort()
                    }
                }
                Add-Content -LiteralPath $diagnosticPath -Encoding UTF8 -Value ("{0:o} {1} HTTP 200 after {2:N1}s" -f [DateTime]::Now, $uri, $timer.Elapsed.TotalSeconds)
                return
            }
            $lastError = "HTTP $([int]$response.StatusCode)"
        } catch {
            $lastError = $_.Exception.GetBaseException().Message
        } finally {
            if ($null -ne $response) { $response.Close() }
            if ($null -ne $request) { $request.Abort() }
        }
        Add-Content -LiteralPath $diagnosticPath -Encoding UTF8 -Value ("{0:o} {1} after {2:N1}s: {3}" -f [DateTime]::Now, $uri, $timer.Elapsed.TotalSeconds, $lastError)
        Start-Sleep -Milliseconds 500
    }
    throw "The page is not ready at $uri after $PageTimeoutSeconds seconds. Last error: $lastError. Check $diagnosticPath and the service logs in .runtime."
}

function Read-RuntimeState {
    if (-not (Test-Path -LiteralPath $statePath)) {
        return [pscustomobject]@{ version = 1; projectRoot = $projectRoot; processes = @() }
    }
    $value = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($value.version -ne 1 -or $value.projectRoot -ine $projectRoot -or $null -eq $value.processes) {
        throw "Unrecognized runtime state: $statePath. No process has been stopped."
    }
    return $value
}

function Save-RuntimeState {
    param($State)
    $temporaryPath = Join-Path $runtimeDir 'pid.json.tmp'
    $json = $State | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($temporaryPath, $json, [System.Text.UTF8Encoding]::new($true))
    Move-Item -LiteralPath $temporaryPath -Destination $statePath -Force
}

function Get-RecordedProcess {
    param($Record, [string]$VitePath, [int]$Port)
    $process = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f [int]$Record.pid) -ErrorAction Stop
    if ($null -eq $process) { return $null }
    $createdAt = $process.CreationDate.ToUniversalTime().Ticks
    $recordedCreation = ([DateTime]$Record.creationTimeUtc).ToUniversalTime().Ticks
    if ($Record.mode -eq 'backend') {
        $expectedEntry = Join-Path $projectRoot 'ship-maintenance\phase2-demo\server\local-server.mjs'
        $entryPattern = '(?i)(?:^|\s)"?' + [regex]::Escape($expectedEntry) + '"?(?:\s|$)'
        if ($Record.side -ne 'ship' -or $Record.port -ne 5173 -or $Record.entryPath -ine $expectedEntry -or
            $createdAt -ne $recordedCreation -or $process.ExecutablePath -ine $Record.nodePath -or
            $process.CommandLine -cne $Record.commandLine -or $process.CommandLine -notmatch $entryPattern) { return $null }
        return $process
    }
    $vitePattern = '(?i)(?:^|\s)"?' + [regex]::Escape($VitePath) + '"?(?:\s|$)'
    $portPattern = '(?:^|\s)--port\s+' + $Port + '(?:\s|$)'
    if ($createdAt -ne $recordedCreation -or
        $process.ExecutablePath -ine $Record.nodePath -or
        $process.CommandLine -cne $Record.commandLine -or
        $process.CommandLine -notmatch $vitePattern -or
        $process.CommandLine -notmatch '(?:^|\s)--host\s+127\.0\.0\.1(?:\s|$)' -or
        $process.CommandLine -notmatch $portPattern -or
        $process.CommandLine -notmatch '(?:^|\s)--strictPort(?:\s|$)') {
        return $null
    }
    return $process
}

function Get-PortListeners {
    param([int]$Port)
    return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-ForManagedListener {
    param($Record, [string]$VitePath, [int]$Port)
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt $PageTimeoutSeconds) {
        $process = Get-RecordedProcess -Record $Record -VitePath $VitePath -Port $Port
        if ($null -eq $process) { throw "Managed service exited or its identity changed (PID $($Record.pid))." }
        $listeners = @(Get-PortListeners -Port $Port)
        if ($listeners.Count -gt 0) {
            $foreign = @($listeners | Where-Object { [int]$_.OwningProcess -ne [int]$Record.pid })
            if ($foreign.Count -gt 0) { throw "Port $Port is owned by an unrelated process. No process has been stopped." }
            $loopback = @($listeners | Where-Object { $_.LocalAddress -eq '127.0.0.1' })
            if ($loopback.Count -gt 0) { return }
            throw "Managed service is not listening on 127.0.0.1:$Port."
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Timed out waiting for 127.0.0.1:$Port. The recorded process can be inspected or stopped with stop-local.ps1."
}

function Prepare-ShipBuild {
    param([string]$Directory)
    & $nodePath -e "try { require('node:sqlite') } catch { process.exit(1) }"
    if ($LASTEXITCODE -ne 0) { throw 'Ship backend requires Node.js with node:sqlite (use Node.js 24 LTS).' }
    $page = Join-Path $Directory 'dist\index.html'
    $needsBuild = -not (Test-Path -LiteralPath $page)
    if (-not $needsBuild) {
        $builtAt = (Get-Item -LiteralPath $page).LastWriteTimeUtc
        foreach ($name in @('src','public','wiki_rt-flex50','data','scripts','docs\information-map','index.html','vite.config.js','package.json','package-lock.json')) {
            $source = Join-Path $Directory $name
            if (Test-Path -LiteralPath $source) {
                if (Get-ChildItem -LiteralPath $source -File -Recurse | Where-Object { $_.LastWriteTimeUtc -gt $builtAt } | Select-Object -First 1) { $needsBuild = $true; break }
            }
        }
    }
    if ($needsBuild) {
        Write-Host 'Building the updated ship frontend...'
        $npmPath = (Get-Command npm.cmd -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
        Push-Location -LiteralPath $Directory
        try {
            & $npmPath run build
            if ($LASTEXITCODE -ne 0) { throw 'Ship build failed. The backend was not started.' }
        } finally { Pop-Location }
    }
    if (-not (Test-Path -LiteralPath $page)) { throw "Missing ship build: $page" }
}

function Get-ShipSourceFingerprint {
    param([string]$Directory)
    # The backend imports workflow/data modules from src as well as server.
    # Exclude mutable databases, generated reports and model credentials.
    $files = foreach ($name in @('server', 'src', 'data', 'package.json', 'package-lock.json')) {
        $path = Join-Path $Directory $name
        if (Test-Path -LiteralPath $path) { Get-ChildItem -LiteralPath $path -File -Recurse }
    }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $manifest = foreach ($file in ($files | Sort-Object FullName)) {
            $relative = $file.FullName.Substring($Directory.Length)
            $stream = [System.IO.File]::OpenRead($file.FullName)
            try { $hash = [System.BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
            finally { $stream.Dispose() }
            "${relative}:$hash"
        }
        $bytes = [System.Text.Encoding]::UTF8.GetBytes(($manifest -join "`n"))
        return [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '')
    } finally { $sha.Dispose() }
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$lockHandle = $null
try {
    try {
        $lockHandle = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch {
        throw 'Another start-local.ps1 or stop-local.ps1 is running. Retry after it finishes.'
    }
    $nodePath = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    foreach ($service in $services) {
        $directory = Join-Path $projectRoot $service.RelativePath
        $vitePath = Join-Path $directory 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path -LiteralPath $vitePath -PathType Leaf)) {
            throw "Dependencies are missing for $($service.Side): $vitePath. See doc\本地运行说明.md."
        }
    }
    $state = Read-RuntimeState
    foreach ($service in $services) {
        $directory = Join-Path $projectRoot $service.RelativePath
        $vitePath = Join-Path $directory 'node_modules\vite\bin\vite.js'
        $sourceFingerprint = $null
        if ($service.Side -eq 'ship') {
            # Build before stopping a healthy service. A failed build leaves it running.
            Prepare-ShipBuild -Directory $directory
            $sourceFingerprint = Get-ShipSourceFingerprint -Directory $directory
        }
        $records = @($state.processes | Where-Object { $_.side -eq $service.Side })
        if ($records.Count -gt 1) { throw "Duplicate runtime records for $($service.Side); no process has been stopped." }
        if ($records.Count -eq 1) {
            $record = $records[0]
            $existing = Get-RecordedProcess -Record $record -VitePath $vitePath -Port $service.Port
            if ($null -ne $existing -and $service.Side -eq 'ship' -and
                ($record.mode -ne 'backend' -or $record.sourceFingerprint -ne $sourceFingerprint)) {
                # Restart only the exact process recorded by this launcher. A legacy
                # record without a fingerprint is refreshed once, then safely reused.
                $target = Get-Process -Id ([int]$record.pid) -ErrorAction Stop
                $handle = $target.Handle
                if ([Math]::Abs(($target.StartTime.ToUniversalTime() - $existing.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 1) { throw 'Process identity changed during upgrade.' }
                $target.Kill()
                if (-not $target.WaitForExit(10000)) { throw 'Old ship development server did not stop.' }
                Write-Host 'Reloading the ship backend to match the current application code.'
                $existing = $null
            }
            if ($null -ne $existing) {
                Wait-ForManagedListener -Record $record -VitePath $vitePath -Port $service.Port
                Wait-ForServicePage -Port $service.Port
                Write-Host ("Already running: {0} http://127.0.0.1:{1}/ (PID {2})" -f $service.Side, $service.Port, $record.pid)
                continue
            }
            Write-Host ("Clearing the previous {0} runtime record." -f $service.Side)
            $state.processes = @($state.processes | Where-Object { $_.side -ne $service.Side })
            Save-RuntimeState -State $state
        }
        $listeners = @(Get-PortListeners -Port $service.Port)
        if ($listeners.Count -gt 0) {
            $owners = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
            throw "Port $($service.Port) is already occupied (PID $owners). No process has been stopped."
        }
        $stdoutPath = Join-Path $runtimeDir ($service.Side + '.stdout.log')
        $stderrPath = Join-Path $runtimeDir ($service.Side + '.stderr.log')
        $arguments = @(('"' + $vitePath + '"'), '--host', '127.0.0.1', '--port', [string]$service.Port, '--strictPort')
        $entryPath = $vitePath
        $mode = 'vite'
        if ($service.Side -eq 'ship') {
            $entryPath = Join-Path $directory 'server\local-server.mjs'
            $arguments = @('"' + $entryPath + '"')
            $mode = 'backend'
        }
        $previousPort = $env:PORT
        $previousUtf8 = $env:PYTHONUTF8
        try {
            $env:PORT = [string]$service.Port
            $env:PYTHONUTF8 = '1'
            $started = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
        } finally { $env:PORT = $previousPort; $env:PYTHONUTF8 = $previousUtf8 }
        $process = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $started.Id) -ErrorAction Stop
        if ($null -eq $process) { throw "Service exited during startup. Check $stderrPath and $stdoutPath." }
        $record = [pscustomobject]@{
            side = $service.Side
            pid = $started.Id
            port = $service.Port
            projectRoot = $projectRoot
            workingDirectory = $directory
            nodePath = $nodePath
            vitePath = $vitePath
            mode = $mode
            entryPath = $entryPath
            commandLine = $process.CommandLine
            creationTimeUtc = $process.CreationDate.ToUniversalTime().ToString('o')
            recordedAtUtc = [DateTime]::UtcNow.ToString('o')
            sourceFingerprint = $sourceFingerprint
            stdout = $stdoutPath
            stderr = $stderrPath
        }
        $state.processes = @($state.processes) + @($record)
        Save-RuntimeState -State $state
        if ($service.Side -eq 'ship') {
            $activePath = Join-Path $directory '.local-data\server-active.json'
            $active = @{ pid = $record.pid; port = $record.port; stdout = $stdoutPath; stderr = $stderrPath }
            [System.IO.File]::WriteAllText($activePath, ($active | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
        }
        try {
            Wait-ForManagedListener -Record $record -VitePath $vitePath -Port $service.Port
            Wait-ForServicePage -Port $service.Port
        } catch {
            throw "$($_.Exception.Message) Logs: $stdoutPath ; $stderrPath"
        }
        Write-Host ("Started: {0} http://127.0.0.1:{1}/ (PID {2})" -f $service.Side, $service.Port, $started.Id)
    }
    Write-Host "Runtime records: $statePath"
    Write-Host ("Stop selected services with: .\stop-local.ps1 -Side {0}" -f $Side)
    if ($OpenBrowser) {
        foreach ($service in $services) {
            $entryRoute = if ($service.Side -eq 'ship') { '/#/situation' } else { '/' }
            Start-Process -FilePath ("http://127.0.0.1:{0}{1}" -f $service.Port, $entryRoute)
        }
    }
} finally {
    if ($null -ne $lockHandle) { $lockHandle.Dispose() }
}
