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

This script dynamically generates and registers a persistent Windows Scheduled Task that executes a pure PowerShell payload at user logon with absolute invisibility. It packages the execution logic entirely inside the task definition, without the need to create or maintain temporary files on disk.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $Guid = New-Guid
    $TaskName = "UserLogonTask_$Guid"
    $Payload = {
        Write-Output "Task executed successfully as current user at $(Get-Date)"
    }
    $TargetLog = Join-Path $env:TEMP "$TaskName.log"
    $WrappedScript = "& { $($Payload.ToString()) } *>&1 | Out-File -FilePath '$TargetLog' -Append -Encoding UTF8"
    $Bytes = [System.Text.Encoding]::Unicode.GetBytes($WrappedScript)
    $EncodedPayload = [Convert]::ToBase64String($Bytes)
    $ConhostPath = Join-Path $env:windir "System32\conhost.exe"
    $TaskArgs = "--headless powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand $EncodedPayload"
    $Scheduler = New-Object -ComObject Schedule.Service
    $Scheduler.Connect()
    $Folder = $Scheduler.GetFolder("\")
    $TaskDefinition = $Scheduler.NewTask(0)
    $RegistrationInfo = $TaskDefinition.RegistrationInfo
    $RegistrationInfo.Description = "Logon task for current user"
    $Principal = $TaskDefinition.Principal
    $Principal.LogonType = 3    # TASK_LOGON_INTERACTIVE_TOKEN
    $Principal.RunLevel = 0     # TASK_RUNLEVEL_LUA
    $Settings = $TaskDefinition.Settings
    $Settings.Enabled = $true
    $Settings.DisallowStartIfOnBatteries = $false
    $Settings.StopIfGoingOnBatteries = $false
    $Settings.ExecutionTimeLimit = "PT0S"
    $Triggers = $TaskDefinition.Triggers
    $Trigger = $Triggers.Create(9)  # TASK_TRIGGER_LOGON
    $Trigger.UserId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $Trigger.Enabled = $true
    $Actions = $TaskDefinition.Actions
    $Action = $Actions.Create(0)    # TASK_ACTION_EXEC_EXE
    $Action.Path = $ConhostPath
    $Action.Arguments = $TaskArgs
    $Folder.RegisterTaskDefinition($TaskName, $TaskDefinition, 6, $null, $null, 3) | Out-Null
    Write-Host "Task '$TaskName' has been registered for current user!" -ForegroundColor Green
}
```

### Execute script as logged on user

This script registers a temporary scheduled task to execute a PowerShell payload completely invisibly (avoiding console flashes via a VBScript wrapper) under the current user's interactive session. It streams the execution logs live to the host console, synchronously waits for the task to finish, and automatically cleans up by unregistering the task and removing temporary files.

```powershell
& {
    $Payload = {
        Write-Output "Execution Started..."
        Start-Sleep -Seconds 3
        Write-Output "Processing Data..."
        Start-Sleep -Seconds 3
        Write-Output "Execution Completed Successfully"
    }
    $Guid = New-Guid
    $TempScript = Join-Path $env:TEMP "$Guid.ps1"
    $TempOutput = Join-Path $env:TEMP "$Guid.log"
    $TempVbs = Join-Path $env:TEMP "$Guid.vbs"
    $TempOutput
    "& { $($Payload.ToString()) } *>&1 | Out-File -FilePath '$TempOutput' -Append -Encoding UTF8" | Out-File -FilePath $TempScript -Encoding UTF8
    'CreateObject("WScript.Shell").Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & WScript.Arguments(0) & """", 0, False' | Out-File -FilePath $TempVbs -Encoding ASCII
    Register-ScheduledTask -TaskName $Guid -Force -Action (
        New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B //Nologo `"$TempVbs`" `"$TempScript`""
    ) -Principal (
        New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive
    ) -Settings (
        New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([timespan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    ) | Out-Null
    Start-ScheduledTask -TaskName $Guid
    $Wait = 0
    $Reader = $null
    try {
        while ((Get-ScheduledTask -TaskName $Guid -ErrorAction Ignore).State -in 'Running', 'Queued' -or $Wait++ -lt 3) {
            if (-not $Reader -and (Test-Path $TempOutput)) {
                $Stream = [System.IO.FileStream]::new($TempOutput, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
                $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::UTF8)
            }
            while ($Reader -and -not $Reader.EndOfStream) {
                Write-Host $Reader.ReadLine()
            }
            Start-Sleep -Seconds 1
        }
        while ($Reader -and -not $Reader.EndOfStream) {
            Write-Host $Reader.ReadLine()
        }
    }
    finally {
        if ($Reader) { $Reader.Dispose() }
    }
    Unregister-ScheduledTask -TaskName $Guid -Confirm:$false -ErrorAction Ignore
    Remove-Item -Path $TempScript -Force -ErrorAction Ignore
    Remove-Item -Path $TempVbs -Force -ErrorAction Ignore
}
```
