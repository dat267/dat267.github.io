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

This script dynamically generates and registers a persistent Windows Scheduled Task that executes a PowerShell payload at user logon with absolute invisibility. It packages the execution logic entirely inside the task definition and captures all output to a log file. **Note: This task detects the current interactive user via the owner of `explorer.exe` to support execution from SYSTEM contexts (e.g., ScreenConnect).**

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
    $Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive
    $Action = New-ScheduledTaskAction -Execute "conhost.exe" -Argument $TaskArgs
    $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $User
    $Settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([timespan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
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

### Prevent system sleep

This script utilizes the Windows API to prevent the system from entering sleep or turning off the display. It supports a configurable duration in hours and is designed to run invisibly as a background payload.

```powershell
$DurationHours = 10
$Signature = @'
[DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
$ES_CONTINUOUS = 0x80000000
$ES_DISPLAY_REQUIRED = 0x00000002
$ES_SYSTEM_REQUIRED = 0x00000001
$Type = Add-Type -MemberDefinition $Signature -Name "Win32Sleep" -Namespace "Win32Functions" -PassThru
$StartTime = Get-Date
while ($DurationHours -eq 0 -or (Get-Date) -lt $StartTime.AddHours($DurationHours)) {
    $Type::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_DISPLAY_REQUIRED -bor $ES_SYSTEM_REQUIRED)
    Start-Sleep -Seconds 60
}
```
