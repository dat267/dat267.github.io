---
title: PowerShell
description: PowerShell scripts for remote execution, system administration, task persistence, multithreaded runspaces, proxy commands, and ETW event forensics on Windows.
icon: seti:powershell
---

## Remote Script Execution

Executes a remote PowerShell script directly in memory.

### With Arguments

Uses the call operator `&` and `[scriptblock]::Create` to download and run the script in memory, passing any trailing parameters directly to the script.

```powershell
& ([scriptblock]::Create((irm https://dat267.github.io/hello.ps1))) World
```

### Without Arguments

A minimal one-liner using `iex` (`Invoke-Expression`) and `irm` (`Invoke-RestMethod`) for immediate execution of parameterless scripts.

```powershell
iex (irm https://dat267.github.io/hello.ps1)
```

## System Tasks & Persistence

Automate environment persistence, session maintenance, and invisible payloads under Windows systems.

### Keep Computer Awake

#### Option 1

Launches a hidden background PowerShell instance that directly blocks system sleep and display timeouts using native Windows API calls.

```powershell
$code = @'
param([double]$For)
$a = Add-Type -MemberDefinition '[DllImport("kernel32.dll")]public static extern uint SetThreadExecutionState(uint f);' -Name S -Namespace W -PassThru
$end = (Get-Date).AddHours($For).AddMinutes((Get-Random -Min -5 -Max 5))
while ((Get-Date) -lt $end) {
    $a::SetThreadExecutionState(0x80000003)
    Start-Sleep -Seconds 60
}
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -EncodedCommand $encoded 10.5"
```

#### Option 2

Launches a hidden background PowerShell instance that simulates subtle key presses at randomized intervals to prevent screensaver locks or session disconnects.

```powershell
$code = @'
param([double]$For)
$w = New-Object -ComObject wscript.shell
$end = (Get-Date).AddHours($For).AddMinutes((Get-Random -Min -5 -Max 5))
while ((Get-Date) -lt $end) {
    $w.SendKeys('{F15}')
    Start-Sleep -Seconds (Get-Random -Min 33 -Max 183)
}
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -EncodedCommand $encoded 10.5"
```

### Register Logon Task (Non-Admin Persistence)

Registers a persistent scheduled task triggered on user logon without requiring local administrative rights by leveraging the Schedule.Service COM interface. The payload is base64-encoded and executed with `-WindowStyle Hidden` to avoid a visible console window.

```powershell
& {
    $Payload = {
        Write-Output "Logon Task executed at $(Get-Date)"
    }
    $User = (Get-Process -Name explorer -IncludeUserName -ErrorAction Ignore | Select-Object -First 1).UserName
    if (!$User) { return }
    $Guid = [guid]::NewGuid()
    $TaskName = "UserLogonTask_$Guid"
    $WrappedScript = @"
try {
    `$LogFile = Join-Path `$env:TEMP "$TaskName.log"
    & { $($Payload.ToString()) } *>&1 | Out-File -FilePath `$LogFile -Append -Encoding UTF8
} catch {
    `$LogFile = Join-Path `$env:TEMP "$TaskName.log"
    `$_ | Out-File -FilePath `$LogFile -Append -Encoding UTF8
}
"@
    $EncodedPayload = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($WrappedScript))
    $Scheduler = New-Object -ComObject Schedule.Service
    $Scheduler.Connect()
    $Task = $Scheduler.NewTask(0)
    $Task.Settings.ExecutionTimeLimit = "PT0S"
    $Task.Settings.DisallowStartIfOnBatteries = $false
    $Task.Settings.StopIfGoingOnBatteries = $false
    $Task.Triggers.Create(9).UserId = $User
    $Task.Principal.UserId = $User
    $Task.Principal.LogonType = 3
    $Action = $Task.Actions.Create(0)
    $Action.Path = "powershell.exe"
    $Action.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $EncodedPayload"
    $Scheduler.GetFolder("\").RegisterTaskDefinition($TaskName, $Task, 6, $null, $null, 3) | Out-Null
    Write-Host "Task registered for $User. Log: %TEMP%\$TaskName.log" -ForegroundColor Cyan
}
```

### Visible Payload Execution as Logged-On User

Launches a minimized interactive PowerShell instance inside a target user's active session. This allows administrators running under the SYSTEM context to display messages or tools to interactive users.

```powershell
& {
    $Payload = {
        Write-Output "Visible Execution Started at $(Get-Date)"
        Start-Sleep -Seconds 5
        Write-Output "Visible Execution Completed"
    }
    $User = (Get-Process -Name explorer -IncludeUserName -ErrorAction Ignore | Select-Object -First 1).UserName
    if (!$User) { throw "No active interactive user session found." }
    $Guid = [guid]::NewGuid()
    $TempScript = Join-Path ([System.IO.Path]::GetTempPath()) "$Guid.ps1"
    $LogFile = Join-Path ([System.IO.Path]::GetTempPath()) "$Guid.log"
    $WrappedScript = @"
Start-Transcript -Path '$LogFile' -Append -Force
try {
    & { $($Payload.ToString()) }
} finally {
    Stop-Transcript
    Remove-Item -Path `$MyInvocation.MyCommand.Path -ErrorAction Ignore
}
"@
    try {
        $WrappedScript | Out-File -FilePath $TempScript -Encoding UTF8
        $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Minimized -ExecutionPolicy Bypass -File `"$TempScript`""
        $Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive
        $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName $Guid -Action $Action -Principal $Principal -Settings $Settings -Force | Out-Null
        Start-ScheduledTask -TaskName $Guid
        $deadline = (Get-Date).AddMinutes(5)
        while ((Get-ScheduledTask -TaskName $Guid).State -in 'Running', 'Queued' -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 1
        }
        $TaskResult = (Get-ScheduledTaskInfo -TaskName $Guid).LastTaskResult
        Write-Host "Task Exit Code: $TaskResult" -ForegroundColor Yellow
    }
    catch {
        Write-Error $_
    }
    finally {
        Unregister-ScheduledTask -TaskName $Guid -Confirm:$false -ErrorAction Ignore
        if (Test-Path $TempScript) {
            Remove-Item -Path $TempScript -ErrorAction Ignore
        }
        if (Test-Path $LogFile) {
            Write-Host "Log Path: $LogFile" -ForegroundColor Cyan
            Write-Host "--- Log Contents ---" -ForegroundColor Gray
            Get-Content -Path $LogFile
        }
    }
}
```

## Multithreading with Runspace Pools

### Parallel Worker Pool

Run code in parallel across multiple threads with shared state, unlike `Start-Job` (heavyweight) or PowerShell 7 `-Parallel` (variable scoping limitations). Uses a synchronized hash table for thread-safe result collection.

```powershell
$results = [Hashtable]::Synchronized(@{ Items = @() })
$runspacePool = [RunspaceFactory]::CreateRunspacePool(1, 8)
$runspacePool.Open()
$handles = 1..20 | ForEach-Object -Parallel {
    $i = $_
    $ps = [PowerShell]::Create()
    $ps.RunspacePool = $using:runspacePool
    $null = $ps.AddScript({
        param($id, $out)
        Start-Sleep -Seconds (Get-Random -Min 1 -Max 3)
        $out.Items += "Processed item $id at $(Get-Date -Format 'HH:mm:ss')"
    }).AddArgument($i).AddArgument($using:results)
    [PSCustomObject]@{ Instance = $ps; Async = $ps.BeginInvoke() }
} -ThrottleLimit 1

$handles | ForEach-Object { $null = $_.Instance.EndInvoke($_.Async); $_.Instance.Dispose() }
$runspacePool.Close()
$runspacePool.Dispose()
$results.Items
```

The pool limits concurrency (here min 1, max 8). Each script instance runs in the pool and writes to the synchronized hash table, avoiding race conditions without explicit locking.

## Proxy Commands

### Wrap a Cmdlet to Inject Defaults

Create a proxy (wrapper) around any existing cmdlet to override default parameter values or transform output, without modifying the original command. The proxy supports tab completion, pipeline input, and `-Verbose` on the inner command.

```powershell
$metadata = [System.Management.Automation.CommandMetaData](Get-Command Select-Object)
$proxy = [System.Management.Automation.ProxyCommand]::Create($metadata)
$proxy = $proxy -replace "'[^']*'", "'-First 10 -Unique'"

$params = @{
    Name        = 'Select-Object'
    Value       = $proxy
    Option      = 'Local'
    Force       = $true
}
Set-Item @params
```

To override parameters individually instead of rewriting the proxy string, access `$metadata.Parameters` before calling `Create()` and set `.Attributes` on specific parameters to inject default values or make them mandatory.

## Event Log Forensics with ETW

### Extract Process Creation Events

Query the security event log for process creation events (Event ID 4688) using XPath filtering. Reveals command lines, parent PIDs, and the user who launched each process without external tools.

```powershell
$xpath = @'
*[System[(EventID=4688)]] and
*[EventData[Data[@Name="CommandLine"] and (Data!="")]]
'@ -replace '\s+', ' '

Get-WinEvent -LogName Security -FilterXPath $xpath -MaxEvents 50 -Oldest |
    Select-Object TimeCreated,
        @{n='User';e={$_.Properties[1].Value}},
        @{n='PID';e={$_.Properties[4].Value}},
        @{n='ParentPID';e={$_.Properties[6].Value}},
        @{n='Process';e={$_.Properties[5].Value}},
        @{n='CommandLine';e={$_.Properties[10].Value}} |
    Format-Table -AutoSize
```

### Monitor Network Connections

Query the Sysmon operational log for network connection events (Event ID 3), showing source and destination IPs, ports, and process IDs.

```powershell
$xpath = @'
*[System[(EventID=3)]] and
*[EventData[Data[@Name="DestinationIp"] and (Data!="-")]]
'@ -replace '\s+', ' '

Get-WinEvent -LogName 'Microsoft-Windows-Sysmon/Operational' -FilterXPath $xpath -MaxEvents 50 -Oldest |
    Select-Object TimeCreated,
        @{n='Process';e={$_.Properties[0].Value}},
        @{n='PID';e={$_.Properties[3].Value}},
        @{n='SrcIP';e={$_.Properties[4].Value}},
        @{n='SrcPort';e={$_.Properties[5].Value}},
        @{n='DestIP';e={$_.Properties[6].Value}},
        @{n='DestPort';e={$_.Properties[7].Value}},
        @{n='Proto';e={$_.Properties[9].Value}} |
    Format-Table -AutoSize
```

For systems without Sysmon, the built-in `Security` log with Event ID 5156 (Windows Firewall allowed connection) provides a similar, though less detailed, view.
