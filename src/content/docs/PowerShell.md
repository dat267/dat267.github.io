---
title: PowerShell
---

Advanced PowerShell snippets for automation, system administration, and network analysis.

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

Launches a hidden background PowerShell instance that simulates subtle Scroll Lock key presses at randomized intervals to prevent screensaver locks or session disconnects.

```powershell
& {
    param(
        [double]$For = 16.5
    )
    $target = (Get-Date).AddHours($For)
    $dateString = $target.ToString('yyyy-MM-dd HH:mm:ss')
    $command = [string]::Format(
        '`$wshell = New-Object -ComObject wscript.shell; `$end = (Get-Date "{0}").AddMinutes((Get-Random -Minimum -5 -Maximum 5)); while((Get-Date) -lt `$end){ `$wshell.SendKeys("{{SCROLLLOCK}}"); Start-Sleep -Milliseconds (Get-Random -Minimum 103 -Maximum 153); `$wshell.SendKeys("{{SCROLLLOCK}}"); Start-Sleep -Seconds (Get-Random -Minimum 33 -Maximum 183) }',
        $dateString
    )
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-Command", $command
    exit
}
```

### Register Logon Task (Non-Admin Persistence)

Registers a persistent scheduled task triggered on user logon without requiring local administrative rights by leveraging the Schedule.Service COM interface. The entire payload is base64-encoded and executed headless.

```powershell
& {
    $Payload = {
        Write-Output "Logon Task executed at $(Get-Date)"
    }
    $User = (Get-Process -Name explorer -IncludeUserName -ErrorAction Ignore | Select-Object -First 1).UserName
    if (!$User) { return }
    $Guid = New-Guid
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
    $TaskArgs = "--headless powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $EncodedPayload"
    $Scheduler = New-Object -ComObject Schedule.Service
    $Scheduler.Connect()
    $Task = $Scheduler.NewTask(0)
    $Task.Settings.ExecutionTimeLimit = "PT0S"
    $Task.Settings.AllowStartIfOnBatteries = $true
    $Task.Settings.DontStopIfGoingOnBatteries = $true
    $Task.Triggers.Create(9).UserId = $User
    $Principal = $Task.Principal
    $Principal.UserId = $User
    $Principal.LogonType = 3
    $Action = $Task.Actions.Create(0)
    $Action.Path = "conhost.exe"
    $Action.Arguments = $TaskArgs
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
    if (!$User) { return }
    $Guid = New-Guid
    $TempScript = Join-Path ([System.IO.Path]::GetTempPath()) "$Guid.ps1"
    $LogFile = Join-Path ([System.IO.Path]::GetTempPath()) "$Guid.log"
    $WrappedScript = @"
try {
    & { $($Payload.ToString()) } *>&1 | Out-File -FilePath '$LogFile' -Append -Encoding UTF8
} finally {
    Remove-Item -Path `$MyInvocation.MyCommand.Path -ErrorAction Ignore
}
"@
    $WrappedScript | Out-File -FilePath $TempScript -Encoding UTF8
    Write-Host "Temp Script: $TempScript" -ForegroundColor Gray
    Write-Host "Log File:    $LogFile" -ForegroundColor Cyan
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Minimized -ExecutionPolicy Bypass -File `"$TempScript`""
    $Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $Guid -Action $Action -Principal $Principal -Settings $Settings -Force | Out-Null
    Start-ScheduledTask -TaskName $Guid
    while ((Get-ScheduledTask -TaskName $Guid).State -in 'Running', 'Queued') { Start-Sleep -Seconds 1 }
    Unregister-ScheduledTask -TaskName $Guid -Confirm:$false
}
```

### Hidden Payload Execution as Logged-On User

Launches an invisible background task that executes under the target interactive user's environment. Perfect for running silent tasks initiated from host-management or RMM software.

```powershell
& {
    $Payload = {
        Write-Output "Execution Started at $(Get-Date)"
        Write-Output "Execution Completed Successfully"
    }
    $User = (Get-Process -Name explorer -IncludeUserName -ErrorAction Ignore | Select-Object -First 1).UserName
    if (!$User) { return }
    $Guid = New-Guid
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
    $WrappedScript | Out-File -FilePath $TempScript -Encoding UTF8
    Write-Host "Temp Script: $TempScript" -ForegroundColor Gray
    Write-Host "Log File:    $LogFile" -ForegroundColor Cyan
    $Action = New-ScheduledTaskAction -Execute "conhost.exe" -Argument "--headless powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$TempScript`""
    $Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive
    $Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([timespan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $Guid -Action $Action -Principal $Principal -Settings $Settings -Force | Out-Null
    Start-ScheduledTask -TaskName $Guid
    while ((Get-ScheduledTask -TaskName $Guid).State -in 'Running', 'Queued') { Start-Sleep -Seconds 1 }
    Unregister-ScheduledTask -TaskName $Guid -Confirm:$false
}
```

## System Analysis & Networking

Perform filesystem analytics and rapid network scans natively.

### Disk Usage Analyzer

Mimics standard disk-usage tools by traversing directories using high-performance.NET `EnumerateFiles` methods. Handles security access exceptions gracefully while aggregating folder space.

```powershell
& {
    param([string]$Path = ".")
    $FullRoot = Resolve-Path $Path
    Write-Host "Scanning: $FullRoot" -ForegroundColor Cyan
    $Results = Get-ChildItem $FullRoot | ForEach-Object {
        $Item = $_
        $TotalSize = 0
        try {
            if ($Item.PSIsContainer) {
                $Files = [System.IO.Directory]::EnumerateFiles($Item.FullName, "*", [System.IO.SearchOption]::AllDirectories)
                foreach ($f in $Files) { $TotalSize += (New-Object System.IO.FileInfo($f)).Length }
            } else {
                $TotalSize = $Item.Length
            }
        } catch { }
        [PSCustomObject]@{
            Name = $Item.Name
            Size = $TotalSize
            Type = if ($Item.PSIsContainer) { "Dir" } else { "File" }
        }
    }
    $Results | Sort-Object Size -Descending | ForEach-Object {
        $DisplaySize = if ($_.Size -gt 1GB) { "{0:N2} GB" -f ($_.Size / 1GB) }
                       elseif ($_.Size -gt 1MB) { "{0:N2} MB" -f ($_.Size / 1MB) }
                       else { "{0:N2} KB" -f ($_.Size / 1KB) }
        $_ | Select-Object Name, Type, @{N="Size"; E={$DisplaySize}}
    } | Format-Table -AutoSize
} .
```

### High-Performance Asynchronous TCP Port Scanner

An extremely rapid asynchronous port scanner leveraging PowerShell 7's Parallel Pipeline and.NET `TcpClient`. Initiates parallel connections with tiny custom timeouts to scan extensive ranges in milliseconds.

```powershell
& {
    param(
        [string]$IP = "127.0.0.1",
        [int[]]$Ports = (1..1024),
        [int]$TimeoutMs = 100
    )
    $Ports | ForEach-Object -Parallel {
        $c = New-Object System.Net.Sockets.TcpClient
        $t = $c.BeginConnect($using:IP, $_, $null, $null)
        if ($t.AsyncWaitHandle.WaitOne($using:TimeoutMs)) {
            try {
                $c.EndConnect($t)
                [PSCustomObject]@{Port=$_; Status="Open"}
            } catch {}
        }
        $c.Close()
    } -ThrottleLimit 100
}
```
