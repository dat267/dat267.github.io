---
title: PowerShell
---

Remote script execution:

```powershell
& {
    param(
        [string]$Url,
        [Parameter(ValueFromRemainingArguments)]
        $ScriptArgs
    )
    try {
        $download = Invoke-RestMethod -Uri $Url -UserAgent "PowerShell"
        $code = $download -replace "^\uFEFF"
    }
    catch {
        Write-Error "Failed to download remote script: $_"
        return
    }
    $errors = $null
    $tokens = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($code, [ref]$tokens, [ref]$errors)
    if ($errors) {
        Write-Error "Remote script contains syntax errors and cannot be parsed."
        return
    }
    if ($ast.ScriptRequirements) {
        Write-Error "Execution blocked: Script contains '#Requires' statements which fail in raw memory blocks."
        return
    }
    $hasAdvancedFeatures = $ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.AttributeAst] -or 
        ($node -is [System.Management.Automation.Language.VariableExpressionAst] -and $node.VariablePath.UserPath -eq 'PSScriptRoot')
    }, $true)
    if ($hasAdvancedFeatures) {
        Write-Error "Execution blocked: Script utilizes advanced attributes ([CmdletBinding]/[Parameter]) or `$PSScriptRoot."
        return
    }
    & ([scriptblock]::Create($code)) @ScriptArgs
} dat267.github.io/hello.ps1 World
```

## Windows

Collection of Windows-only PowerShell snippets.

### Keep computer awake

This script fetches and executes a hidden background process that simulates brief Scroll Lock keypresses at irregular intervals for 16.5 hours to keep the computer awake without human interaction.

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

### Register a log on script

This script dynamically generates and registers a persistent Windows Scheduled Task that executes a PowerShell payload at user logon with absolute invisibility. It packages the execution logic entirely inside the task definition and captures all output to a log file. **Note: This uses the `Schedule.Service` COM object to allow registration without local administrator rights.**

```powershell
& {
    $Payload = {
        Write-Output "Logon Task executed at $(Get-Date)"
    }
    $User = (Get-Process -Name explorer -IncludeUserName -ErrorAction Ignore | Select-Object -First 1).UserName
    if (!$User) { return }
    $Guid = New-Guid
    $TaskName = "UserLogonTask_$Guid"
    $LogFile = Join-Path $env:TEMP "$TaskName.log"
    $WrappedScript = @"
try {
    & { $($Payload.ToString()) } *>&1 | Out-File -FilePath '$LogFile' -Append -Encoding UTF8
} catch {
    `$_ | Out-File -FilePath '$LogFile' -Append -Encoding UTF8
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
    $Task.Triggers.Create(9).UserId = $User # 9 = TASK_TRIGGER_LOGON
    $Principal = $Task.Principal
    $Principal.UserId = $User
    $Principal.LogonType = 3 # 3 = TASK_LOGON_INTERACTIVE_TOKEN
    $Action = $Task.Actions.Create(0) # 0 = TASK_ACTION_EXEC_EXE
    $Action.Path = "conhost.exe"
    $Action.Arguments = $TaskArgs
    $Scheduler.GetFolder("\").RegisterTaskDefinition($TaskName, $Task, 6, $null, $null, 3) | Out-Null
    Write-Host "Task registered for $User. Log: $LogFile" -ForegroundColor Cyan
}
```

### Execute script as logged on user (Visible)

This version executes a PowerShell payload as a temporary scheduled task that launches minimized to the taskbar. It uses the owner of `explorer.exe` to target the active interactive user, making it reliable when triggered from admin tools like ScreenConnect.

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

### Execute script as logged on user (Hidden)

This script executes a PowerShell payload invisibly under the current user's interactive session using a temporary scheduled task. It uses the owner of `explorer.exe` to detect the user, ensuring correct operation when run from admin tools (SYSTEM context).

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

### Disk Usage Analyzer

This script mimics the `dua` CLI tool by efficiently calculating and displaying the disk usage of immediate subdirectories and files. It uses the .NET `EnumerateFiles` method for significantly better performance than `Get-ChildItem -Recurse` and handles "Access Denied" errors gracefully.

```powershell
function Get-DiskUsage {
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
}
```
