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
        '$wshell = New-Object -ComObject wscript.shell; $end = (Get-Date "{0}").AddMinutes((Get-Random -Minimum -5 -Maximum 5)); while((Get-Date) -lt $end){{ $wshell.SendKeys("{{SCROLLLOCK}}"); Start-Sleep -Milliseconds (Get-Random -Minimum 103 -Maximum 153); $wshell.SendKeys("{{SCROLLLOCK}}"); Start-Sleep -Seconds (Get-Random -Minimum 33 -Maximum 183) }}',
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
    $TaskArgs = "--headless powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $EncodedPayload"
    $Scheduler = New-Object -ComObject Schedule.Service
    $Scheduler.Connect()
    $Task = $Scheduler.NewTask(0)
    $Task.Settings.ExecutionTimeLimit = "PT0S"
    $Task.Settings.DisallowStartIfOnBatteries = $false
    $Task.Settings.StopIfGoingOnBatteries = $false
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
        while ((Get-ScheduledTask -TaskName $Guid).State -in 'Running', 'Queued') { Start-Sleep -Seconds 1 }
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

### Hidden Payload Execution as Logged-On User

Launches an invisible background task that executes under the target interactive user's environment. Perfect for running silent tasks initiated from host-management or RMM software.

```powershell
& {
    $Payload = {
        Write-Output "Execution Started at $(Get-Date)"
	    Write-Output "Profile CurrentUserAllHosts: $($Profile.CurrentUserAllHosts)"
	    Write-Output "Profile Present: $(Test-Path $Profile.CurrentUserAllHosts)"
        Write-Output "Execution Completed Successfully"
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
        $Action = New-ScheduledTaskAction -Execute "conhost.exe" -Argument "--headless powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$TempScript`""
        $Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive
        $Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([timespan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName $Guid -Action $Action -Principal $Principal -Settings $Settings -Force | Out-Null
        Start-ScheduledTask -TaskName $Guid
        while ((Get-ScheduledTask -TaskName $Guid).State -in 'Running', 'Queued') { Start-Sleep -Seconds 1 }
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
            Write-Host "`nLog Path: $LogFile" -ForegroundColor Cyan
            Write-Host "--- Log Contents ---" -ForegroundColor Gray
            Get-Content -Path $LogFile
        }
    }
}
```
