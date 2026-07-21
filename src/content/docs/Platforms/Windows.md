---
title: Windows
description: PowerShell scripts for remote execution, system administration, task persistence, AD user onboarding, multithreaded runspaces, proxy commands, and ETW event forensics on Windows.
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

## AD Recovery Framework

Every mutation function below exports a JSON recovery file before making changes. Use the companion `Undo-*` function to revert by reading that file.

```powershell
$ADRecoveryPath = ".\AD-Recovery"

function Export-ADRecovery {
    param([string] $Operation, [string] $SamAccountName, [object] $Before, [object] $After)
    if (-not (Test-Path $ADRecoveryPath)) { New-Item -ItemType Directory -Path $ADRecoveryPath -Force | Out-Null }
    $file = Join-Path $ADRecoveryPath "$Operation`_$SamAccountName`_$(Get-Date -Format yyyyMMdd_HHmmss).json"
    @{ Operation = $Operation; SamAccountName = $SamAccountName; Timestamp = (Get-Date -Format o); Before = $Before; After = $After } |
        ConvertTo-Json -Depth 10 | Out-File -FilePath $file -Encoding UTF8
    return $file
}

function Import-ADRecovery {
    param([Parameter(Mandatory)] [string] $Path)
    $fullPath = if ($Path -match '[\\/]') { $Path } else { Join-Path $ADRecoveryPath "$Path`_*.json" }
    $files = if ($fullPath -match '\*') { Get-ChildItem -Path $fullPath -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending }
             else { Get-Item -Path $fullPath -ErrorAction SilentlyContinue }
    if (-not $files) { throw "No recovery file found for '$Path'" }
    $file = $files | Select-Object -First 1
    Write-Host "Using recovery file: $($file.FullName)" -ForegroundColor Cyan
    Get-Content $file.FullName -Raw | ConvertFrom-Json
}
```

## AD User Summary

### Quick User Status Check

Returns account status, lockout state, password expiry, group membership, and key attributes. Commonly used by service desk to triage login issues.

```powershell
function Get-ADUserSummary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName
    )

    $user = Get-ADUser -Identity $SamAccountName -Properties * -ErrorAction Stop
    $pwdMaxAge = (Get-ADDefaultDomainPasswordPolicy).MaxPasswordAge
    $pwdExpiry = if ($user.PasswordNeverExpires) {
        $null
    } elseif ($user.PasswordLastSet -and $pwdMaxAge) {
        $user.PasswordLastSet.AddDays($pwdMaxAge.TotalDays)
    } else {
        $null
    }

    $groups = $user.MemberOf | ForEach-Object { (Get-ADGroup -Identity $_ -ErrorAction SilentlyContinue).SamAccountName } | Sort-Object

    [PSCustomObject]@{
        SamAccountName     = $user.SamAccountName
        DisplayName        = $user.DisplayName
        Enabled            = $user.Enabled
        LockedOut          = $user.LockedOut
        UserPrincipalName  = $user.UserPrincipalName
        LastLogon          = $user.LastLogonDate
        PasswordLastSet    = $user.PasswordLastSet
        PasswordExpiry     = $pwdExpiry
        BadLogonCount      = $user.BadLogonCount
        Department         = $user.Department
        Title              = $user.Title
        Manager            = $user.Manager
        Groups             = ($groups -join '; ')
        DN                 = $user.DistinguishedName
    }
}

Get-ADUserSummary -SamAccountName "jane.doe" | Format-List
```

## AD User Group Helper

### Get Groups of an Existing User

Returns group names as both an array and a semicolon-separated string for use with `New-ADOnboardedUser -GroupMembership`.

```powershell
function Get-ADUserGroupList {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName,
        [switch] $IncludeProtected
    )
    $user = Get-ADUser -Identity $SamAccountName -Properties MemberOf -ErrorAction Stop
    $groups = $user.MemberOf | ForEach-Object {
        if ($IncludeProtected -or $_ -notlike "*CN=Domain Users,*") {
            (Get-ADGroup -Identity $_ -ErrorAction SilentlyContinue).SamAccountName
        }
    } | Where-Object { $_ } | Sort-Object

    [PSCustomObject]@{ SamAccountName = $SamAccountName; GroupCount = @($groups).Count; GroupMembership = $groups -join ';'; Groups = $groups }
}
```

## Active Directory User Onboarding

### Create or Update AD User with All Attributes

Onboard a new user or update an existing one with the full set of standard AD attributes, group memberships, contact info, address, Exchange attributes, and a reset-required password. Exports a recovery file before mutating so changes can be undone.

```powershell
function New-ADOnboardedUser {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        # Identity — required fields that uniquely identify the user
        [Parameter(Mandatory)] [string] $GivenName,
        [Parameter(Mandatory)] [string] $Surname,
        [Parameter(Mandatory)] [string] $SamAccountName,
        [Parameter(Mandatory)] [string] $UserPrincipalName,
        [Parameter(Mandatory)] [string] $Path,
        [Parameter(Mandatory)] [string[]] $GroupMembership,

        # Job
        [string] $Title,             [string] $Department, [string] $Division,
        [string] $Company,           [string] $Manager,    [string] $EmployeeID,
        [string] $EmployeeNumber,    [string] $EmployeeType,

        # Contact
        [string] $EmailAddress,      [string] $OfficePhone, [string] $MobilePhone,
        [string] $HomePhone,         [string] $Fax,         [string] $Office,

        # Address
        [string] $StreetAddress,     [string] $City,  [string] $State,
        [string] $PostalCode,        [string] $Country, [string] $POBox,

        # Exchange / Mail
        [string] $mailNickname,      [string[]] $ProxyAddresses, [string] $TargetAddress,

        # Account
        [string] $Description,       [string] $HomeDirectory, [string] $HomeDrive,
        [string] $ScriptPath,        [string] $ProfilePath,   [string] $Initials,
        [string] $DisplayName,       [datetime] $AccountExpirationDate,
        [string] $LogonWorkstations, [switch] $SmartcardLogonRequired,
        [switch] $PasswordNeverExpires, [switch] $AccountNotDelegated,

        # Enterprise
        [string] $DepartmentNumber,  [string] $WwwHomePage,
        [string] $ExtensionAttribute1, [string] $ExtensionAttribute2,
        [string] $ExtensionAttribute3, [string] $ExtensionAttribute4,
        [string] $ExtensionAttribute5, [string] $ExtensionAttribute6,
        [string] $ExtensionAttribute7, [string] $ExtensionAttribute8,
        [string] $ExtensionAttribute9, [string] $ExtensionAttribute10,
        [string] $ExtensionAttribute11, [string] $ExtensionAttribute12,
        [string] $ExtensionAttribute13, [string] $ExtensionAttribute14,
        [string] $ExtensionAttribute15
    )

    if (-not (Get-Module -Name ActiveDirectory -ListAvailable)) { throw "ActiveDirectory module not found. Install RSAT tools and try again." }
    Import-Module ActiveDirectory -ErrorAction Stop

    if (-not $DisplayName) { $DisplayName = "$GivenName $Surname" }
    if (-not $mailNickname) { $mailNickname = $SamAccountName }

    $plainPwd = -join ((33..126) | Get-Random -Count 16 | ForEach-Object { [char]$_ })
    $securePwd = ConvertTo-SecureString -String $plainPwd -AsPlainText -Force

    $before = Get-ADUser -Filter "SamAccountName -eq '$SamAccountName'" -Properties MemberOf, Manager, DisplayName, UserPrincipalName -ErrorAction SilentlyContinue

    $attrs = @{
        GivenName = $GivenName; Surname = $Surname; DisplayName = $DisplayName; Name = $DisplayName
        SamAccountName = $SamAccountName; UserPrincipalName = $UserPrincipalName
        EmailAddress = $EmailAddress; Title = $Title; Department = $Department; Division = $Division
        Company = $Company; Description = $Description; EmployeeID = $EmployeeID
        EmployeeNumber = $EmployeeNumber; EmployeeType = $EmployeeType
        OfficePhone = $OfficePhone; MobilePhone = $MobilePhone; HomePhone = $HomePhone
        Fax = $Fax; Office = $Office; StreetAddress = $StreetAddress; City = $City; State = $State
        PostalCode = $PostalCode; Country = $Country; POBox = $POBox; mailNickname = $mailNickname
        ProxyAddresses = $ProxyAddresses; Initials = $Initials; HomeDirectory = $HomeDirectory
        HomeDrive = $HomeDrive; ScriptPath = $ScriptPath; ProfilePath = $ProfilePath
        DepartmentNumber = $DepartmentNumber; WwwHomePage = $WwwHomePage
        AccountPassword = $securePwd; Enabled = $true; PassThru = $true
        ChangePasswordAtLogon = -not $PasswordNeverExpires
    }

    for ($i = 1; $i -le 15; $i++) { $pn = "ExtensionAttribute$i"; if ($PSBoundParameters.ContainsKey($pn)) { $attrs[$pn] = Get-Variable -Name $pn -ValueOnly } }
    if ($SmartcardLogonRequired) { $attrs.SmartcardLogonRequired = $true }
    if ($AccountExpirationDate)  { $attrs.AccountExpirationDate = $AccountExpirationDate }
    if ($PasswordNeverExpires)   { $attrs.PasswordNeverExpires = $true }
    if ($AccountNotDelegated)    { $attrs.AccountNotDelegated = $true }
    if ($LogonWorkstations)      { $attrs.LogonWorkstations = $LogonWorkstations }
    if ($TargetAddress) { $attrs.TargetAddress = $TargetAddress; $null = $attrs.Remove('ProxyAddresses') }
    if ($ProxyAddresses -or $TargetAddress) { $combined = @($ProxyAddresses); if ($TargetAddress) { $combined += "SMTP:$TargetAddress" }; $attrs.ProxyAddresses = $combined }

    $emptyKeys = @($attrs.Keys | Where-Object { -not $attrs[$_] -and $attrs[$_] -is [string] })
    foreach ($k in $emptyKeys) { $null = $attrs.Remove($k) }

    if ($Manager) {
        try { $attrs.Manager = (Get-ADUser -Identity $Manager -ErrorAction Stop).DistinguishedName }
        catch { Write-Warning "Manager '$Manager' not found." }
    }
    try { $null = Get-ADOrganizationalUnit -Identity $Path -ErrorAction Stop }
    catch { Write-Warning "OU '$Path' not found." }

    if ($before) {
        $dn = $before.DistinguishedName
        $null = $attrs.Remove('AccountPassword'); $null = $attrs.Remove('Enabled')
        $null = $attrs.Remove('PassThru'); $null = $attrs.Remove('ChangePasswordAtLogon'); $null = $attrs.Remove('Name')
        if ($PSCmdlet.ShouldProcess($SamAccountName, "Update AD user")) {
            Set-ADUser -Identity $dn @attrs
            Set-ADAccountPassword -Identity $dn -NewPassword $securePwd -Reset
            Enable-ADAccount -Identity $dn
        }
    } else {
        if ($PSCmdlet.ShouldProcess($SamAccountName, "Create AD user")) {
            New-ADUser @attrs | Out-Null
            $dn = (Get-ADUser -Identity $SamAccountName).DistinguishedName
        }
    }

    if ($dn) {
        if ($PSCmdlet.ShouldProcess($SamAccountName, "Generate password")) { Write-Host "Temp password for $SamAccountName`: $plainPwd" -ForegroundColor Cyan }
        if ($PSCmdlet.ShouldProcess($SamAccountName, "Add to groups")) {
            foreach ($group in $GroupMembership) {
                try { Add-ADGroupMember -Identity $group -Members $dn -ErrorAction Stop }
                catch { Write-Warning "Failed to add to group '$group': $_" }
            }
        }
        if ($attrs.ContainsKey('Manager') -and $PSCmdlet.ShouldProcess($SamAccountName, "Set manager")) {
            Set-ADUser -Identity $dn -Manager $attrs.Manager
        }
    }

    $after = if ($dn) { @{ SamAccountName = $SamAccountName; DN = $dn; Groups = $GroupMembership } } else { $null }
    $recoveryFile = Export-ADRecovery -Operation "Onboard" -SamAccountName $SamAccountName -Before $before -After $after

    [PSCustomObject]@{ SamAccountName = $SamAccountName; DisplayName = $DisplayName; DN = $dn; Groups = ($GroupMembership -join ';'); Manager = $Manager; EmployeeID = $EmployeeID }
}
```

Onboard a user:

```powershell
New-ADOnboardedUser -GivenName Jane -Surname Doe -SamAccountName jane.doe -UserPrincipalName jane.doe@contoso.com `
    -Path "OU=Users,DC=contoso,DC=com" -GroupMembership "Domain Users","VPN-Users" -Title Engineer -Department Engineering
```

### Undo Onboarding

Reverses the last onboard for a user: removes from groups added during onboard, then disables the account. If the user was newly created, offers to delete.

```powershell
function Undo-ADOnboardedUser {
    [CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName,
        [switch] $Purge
    )
    $rec = Import-ADRecovery -Path "Onboard_$SamAccountName"
    $dn = $rec.After.DN
    if (-not $dn) { throw "No DN recorded for $SamAccountName" }

    if ($PSCmdlet.ShouldProcess($SamAccountName, "Remove from groups")) {
        foreach ($group in $rec.After.Groups) {
            try { Remove-ADGroupMember -Identity $group -Members $dn -Confirm:$false -ErrorAction SilentlyContinue }
            catch { Write-Warning "Failed to remove from group '$group': $_" }
        }
    }
    if ($PSCmdlet.ShouldProcess($SamAccountName, "Disable account")) { Disable-ADAccount -Identity $dn }
    if ($Purge -and $PSCmdlet.ShouldProcess($SamAccountName, "DELETE permanently")) { Remove-ADUser -Identity $dn -Confirm:$false }
    Write-Host "Undo onboarding completed for $SamAccountName" -ForegroundColor Yellow
}

Undo-ADOnboardedUser -SamAccountName "jane.doe"
```

### Bulk Onboard from CSV

```csv
FirstName,LastName,Username,OU, Groups,Title,Department,Manager,EmployeeID
Jane,Doe,jane.doe,OU=Users,DC=contoso,DC=com,"Domain Users;VPN-Users;Eng-Team",Engineer,Engineering,john.smith,EMP0421
John,Smith,john.smith,OU=Users,DC=contoso,DC=com,"Domain Users;VPN-Users",Manager,Engineering,,EMP0422
```

```powershell
$users = Import-Csv -Path .\onboard-users.csv
foreach ($row in $users) {
    $params = @{
        GivenName = $row.FirstName; Surname = $row.LastName
        SamAccountName = $row.Username; UserPrincipalName = "$($row.Username)@contoso.com"
        Path = $row.OU; GroupMembership = $row.Groups -split ';'
        Title = $row.Title; Department = $row.Department; Manager = $row.Manager; EmployeeID = $row.EmployeeID
    }
    try { New-ADOnboardedUser @params } catch { Write-Warning "Failed to onboard $($row.Username): $_" }
}
```

## Active Directory User Offboarding

### Method 1: Disable and Rename

Disable the account, strip groups, clear manager, rename Sam/UPN/DisplayName with a date suffix. Exports a recovery file with the full before-state for undo.

```powershell
function Disable-ADUserAndRename {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName,
        [string[]] $GroupsToKeep,
        [string] $Description
    )

    if (-not (Get-Module -Name ActiveDirectory -ListAvailable)) { throw "ActiveDirectory module not found." }
    Import-Module ActiveDirectory -ErrorAction Stop

    $user = Get-ADUser -Identity $SamAccountName -Properties * -ErrorAction Stop

    $before = [PSCustomObject]@{
        SamAccountName = $user.SamAccountName; DisplayName = $user.DisplayName
        UserPrincipalName = $user.UserPrincipalName; Enabled = $user.Enabled
        Manager = $user.Manager; Description = $user.Description
        Groups = $user.MemberOf | Where-Object { $_ -notlike "*CN=Domain Users,*" }
    }

    $today = Get-Date -Format "yyyy-MM-dd"; $suffix = "_disabled_$today"
    $newSam = "$($user.SamAccountName)$suffix"
    $upnParts = $user.UserPrincipalName -split '@'; $newUPN = "$($upnParts[0])$suffix@$($upnParts[1])"

    $keepDNs = $GroupsToKeep | ForEach-Object {
        try { (Get-ADGroup -Identity $_ -ErrorAction Stop).DistinguishedName }
        catch { Write-Warning "Keep-group '$_' not found."; $null }
    } | Where-Object { $_ }

    if ($PSCmdlet.ShouldProcess($SamAccountName, "Disable and rename")) {
        $user.MemberOf | Where-Object { $_ -notlike "*CN=Domain Users,*" -and $_ -notin $keepDNs } | ForEach-Object {
            try { Remove-ADGroupMember -Identity $_ -Members $user.DistinguishedName -Confirm:$false -ErrorAction SilentlyContinue }
            catch { Write-Warning "Failed to remove from $_" }
        }
        Set-ADUser -Identity $user.DistinguishedName -Clear Manager
        Set-ADUser -Identity $user.DistinguishedName -DisplayName "$($user.DisplayName) [Disabled $today]"
        Set-ADUser -Identity $user.DistinguishedName -SamAccountName $newSam
        Set-ADUser -Identity $user.DistinguishedName -UserPrincipalName $newUPN
        Set-ADUser -Identity $user.DistinguishedName -Description $Description
        Disable-ADAccount -Identity $user.DistinguishedName
    }

    $after = @{ SamAccountName = $newSam; DisplayName = "$($user.DisplayName) [Disabled $today]"; UserPrincipalName = $newUPN; Enabled = $false }
    Export-ADRecovery -Operation "Disable" -SamAccountName $SamAccountName -Before $before -After $after

    [PSCustomObject]@{ OriginalSam = $SamAccountName; NewSam = $newSam; DisabledOn = $today }
}

Disable-ADUserAndRename -SamAccountName "jane.doe" -GroupsToKeep "All-Employees" -Description "Offboarded 2026-07-21"
```

### Undo Disable

Reverses a `Disable-ADUserAndRename`: renames back to original, re-enables, restores groups and manager.

```powershell
function Undo-ADUserDisable {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName
    )
    $rec = Import-ADRecovery -Path "Disable_$SamAccountName"
    $b = $rec.Before
    $user = Get-ADUser -Filter "SamAccountName -eq '$SamAccountName'" -ErrorAction SilentlyContinue
    if (-not $user) { $user = Get-ADUser -Filter "DisplayName -eq '$($b.DisplayName)'" -ErrorAction Stop }
    $dn = $user.DistinguishedName

    if ($PSCmdlet.ShouldProcess($SamAccountName, "Restore SamAccountName and UPN")) {
        Set-ADUser -Identity $dn -SamAccountName $b.SamAccountName
        Set-ADUser -Identity $dn -UserPrincipalName $b.UserPrincipalName
        Set-ADUser -Identity $dn -DisplayName $b.DisplayName
    }
    if ($PSCmdlet.ShouldProcess($SamAccountName, "Restore groups")) {
        foreach ($gdn in $b.Groups) {
            try { Add-ADGroupMember -Identity $gdn -Members $dn -ErrorAction SilentlyContinue }
            catch { Write-Warning "Failed to restore group '$gdn': $_" }
        }
    }
    if ($b.Manager -and $PSCmdlet.ShouldProcess($SamAccountName, "Restore manager")) {
        Set-ADUser -Identity $dn -Manager $b.Manager
    }
    if ($PSCmdlet.ShouldProcess($SamAccountName, "Enable account")) { Enable-ADAccount -Identity $dn }
    Write-Host "Undo disable completed for $($b.SamAccountName)" -ForegroundColor Green
}

Undo-ADUserDisable -SamAccountName "jane.doe_disabled_2026-07-21"
```

### Method 2: Delete

Permanently removes the user from AD. Exports a full recovery snapshot before deletion.

```powershell
function Remove-ADUserWithCleanup {
    [CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName
    )

    if (-not (Get-Module -Name ActiveDirectory -ListAvailable)) { throw "ActiveDirectory module not found." }
    Import-Module ActiveDirectory -ErrorAction Stop

    $user = Get-ADUser -Identity $SamAccountName -Properties * -ErrorAction Stop
    $before = [PSCustomObject]@{
        SamAccountName = $user.SamAccountName; DisplayName = $user.DisplayName
        UserPrincipalName = $user.UserPrincipalName; Enabled = $user.Enabled
        GivenName = $user.GivenName; Surname = $user.Surname; DN = $user.DistinguishedName
        Manager = $user.Manager; Description = $user.Description
        Groups = $user.MemberOf | Where-Object { $_ -notlike "*CN=Domain Users,*" }
        Title = $user.Title; Department = $user.Department; Company = $user.Company
        EmailAddress = $user.EmailAddress; OfficePhone = $user.OfficePhone; MobilePhone = $user.MobilePhone
        StreetAddress = $user.StreetAddress; City = $user.City; State = $user.State; PostalCode = $user.PostalCode; Country = $user.Country
        Office = $user.Office; EmployeeID = $user.EmployeeID
    }

    if ($PSCmdlet.ShouldProcess($SamAccountName, "DELETE permanently")) {
        $user.MemberOf | ForEach-Object {
            try { Remove-ADGroupMember -Identity $_ -Members $user.DistinguishedName -Confirm:$false -ErrorAction SilentlyContinue }
            catch { Write-Warning "Failed to remove from $_" }
        }
        Remove-ADUser -Identity $user.DistinguishedName -Confirm:$false
    }

    Export-ADRecovery -Operation "Delete" -SamAccountName $SamAccountName -Before $before -After $null
    Write-Host "Deleted $SamAccountName — recovery data saved for manual restore from backup" -ForegroundColor Red
}

Remove-ADUserWithCleanup -SamAccountName "jane.doe"
```

Deletion cannot be automatically undone. The recovery file preserves the full user snapshot so an admin can manually restore from AD Recycle Bin or backup using the recorded attributes.
