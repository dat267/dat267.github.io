---
title: PowerShell
description: PowerShell scripts for remote execution, system administration, task persistence, and session management on Windows.
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
& { param([double]$For=16.5) conhost --headless powershell -c "`$a=Add-Type -M '[DllImport(`"kernel32.dll`")]public static extern uint SetThreadExecutionState(uint f);' -Name S -Namespace W -PassThru;`$e=(date).AddHours($For).AddMinutes((Get-Random -Min -5 -Max 5));while((date) -lt `$e){`$a::SetThreadExecutionState(0x80000003);sleep 60}" } 10.5
```

#### Option 2

Launches a hidden background PowerShell instance that simulates subtle key presses at randomized intervals to prevent screensaver locks or session disconnects.

```powershell
& { param([double]$For=16.5) conhost --headless powershell -c "`$w=New-Object -Com wscript.shell;`$e=(date).AddHours($For).AddMinutes((Get-Random -Min -5 -Max 5));while((date) -lt `$e){`$w.SendKeys('{F15}');sleep (Get-Random -Min 33 -Max 183)}" } 10.5
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
