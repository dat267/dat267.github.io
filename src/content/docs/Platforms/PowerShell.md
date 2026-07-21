---
title: PowerShell
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

## AD User Summary

### Quick User Status Check

Returns account status, lockout state, password expiry, group membership, and key attributes in a single view. Commonly used by service desk to triage login issues.

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

    $locked = if ($user.LockedOut) { "YES" } else { "no" }
    $enabled = if ($user.Enabled) { "enabled" } else { "DISABLED" }
    $expired = if ($pwdExpiry -and (Get-Date) -gt $pwdExpiry) { "EXPIRED" } else { "ok" }
    $pwdDays = if ($pwdExpiry) { [math]::Round(($pwdExpiry - (Get-Date)).TotalDays) } else { $null }

    $groups = $user.MemberOf | ForEach-Object {
        (Get-ADGroup -Identity $_ -ErrorAction SilentlyContinue).SamAccountName
    } | Sort-Object

    [PSCustomObject]@{
        SamAccountName     = $user.SamAccountName
        DisplayName        = $user.DisplayName
        Status             = "$enabled | locked=$locked"
        UserPrincipalName  = $user.UserPrincipalName
        LastLogon          = $user.LastLogonDate
        PasswordLastSet    = $user.PasswordLastSet
        PasswordExpiry     = $pwdExpiry
        PasswordStatus     = $expired
        PasswordDaysLeft   = $pwdDays
        PasswordNeverExpires = $user.PasswordNeverExpires
        LockedOut          = $user.LockedOut
        BadLogonCount      = $user.BadLogonCount
        Department         = $user.Department
        Title              = $user.Title
        Manager            = $user.Manager
        Office             = $user.Office
        MemberOfCount      = @($groups).Count
        Groups             = $groups -join '; '
        DN                 = $user.DistinguishedName
    }
}

Get-ADUserSummary -SamAccountName "jane.doe" | Format-List
```

## Active Directory User Onboarding

### Create or Update AD User with All Attributes

Onboard a new user or update an existing one with the full set of standard AD attributes, group memberships, contact info, address, Exchange attributes, and a reset-required password. Uses splatting for readability and handles all common edge cases: existing user (updates), missing OU (warns), attribute type mismatches, and password validation.

```powershell
function New-ADOnboardedUser {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        # Identity — required fields that uniquely identify the user
        [Parameter(Mandatory)] [string] $GivenName,       # REQUIRED | First name
        [Parameter(Mandatory)] [string] $Surname,          # REQUIRED | Last name
        [Parameter(Mandatory)] [string] $SamAccountName,   # REQUIRED | Pre-Windows 2000 logon name (e.g. jane.doe)
        [Parameter(Mandatory)] [string] $UserPrincipalName,# REQUIRED | Modern logon name (e.g. jane.doe@contoso.com)
        [Parameter(Mandatory)] [string] $Path,             # REQUIRED | Distinguished name of the target OU (e.g. OU=Users,DC=contoso,DC=com)
        [Parameter(Mandatory)] [string[]] $GroupMembership,# REQUIRED | Security groups to add the user to (e.g. @("Domain Users", "VPN-Users"))

        # Job — role and organizational information
        [string] $Title,             # OPTIONAL | Job title (e.g. "Senior Engineer")
        [string] $Department,        # OPTIONAL | Department name (e.g. "Engineering")
        [string] $Division,          # OPTIONAL | Division within the company (e.g. "Product")
        [string] $Company,           # OPTIONAL | Organization name (e.g. "Contoso Ltd")
        [string] $Manager,           # OPTIONAL | SamAccountName or DN of the manager
        [string] $EmployeeID,        # OPTIONAL | Unique HR employee identifier (e.g. "EMP00421")
        [string] $EmployeeNumber,    # OPTIONAL | Alternative employee number
        [string] $EmployeeType,      # OPTIONAL | Employment classification (e.g. "Full-Time", "Contractor")

        # Contact — phone and location details
        [string] $EmailAddress,      # OPTIONAL | Primary SMTP address (maps to mail attribute)
        [string] $OfficePhone,       # OPTIONAL | Desk phone number (maps to telephoneNumber)
        [string] $MobilePhone,       # OPTIONAL | Mobile/cell number (maps to mobile)
        [string] $HomePhone,         # OPTIONAL | Home phone number (maps to homePhone)
        [string] $Fax,               # OPTIONAL | Fax number (maps to facsimileTelephoneNumber)
        [string] $Office,            # OPTIONAL | Physical office location (maps to physicalDeliveryOfficeName)

        # Address — postal address fields
        [string] $StreetAddress,     # OPTIONAL | Street or building address (e.g. "200 Tech Drive")
        [string] $City,              # OPTIONAL | City name
        [string] $State,             # OPTIONAL | State or province abbreviation
        [string] $PostalCode,        # OPTIONAL | ZIP or postal code
        [string] $Country,           # OPTIONAL | Country name or ISO code
        [string] $POBox,             # OPTIONAL | Post office box number

        # Exchange / Mail — email routing attributes
        [string] $mailNickname,      # OPTIONAL | Exchange alias (defaults to SamAccountName)
        [string[]] $ProxyAddresses,  # OPTIONAL | Additional email addresses (e.g. @("smtp:alias@contoso.com"))
        [string] $TargetAddress,     # OPTIONAL | External forwarding address for mail-enabled users

        # Account — login policy and profile settings
        [string] $Description,       # OPTIONAL | Free-text description (e.g. "Onboarded 2026-07-21")
        [string] $HomeDirectory,     # OPTIONAL | UNC path for home folder (e.g. "\\nas\home\jane.doe")
        [string] $HomeDrive,         # OPTIONAL | Drive letter mapped to HomeDirectory (convention is "H:" for Home)
        [string] $ScriptPath,        # OPTIONAL | Logon script path (maps to scriptPath)
        [string] $ProfilePath,       # OPTIONAL | Roaming profile UNC path (maps to profilePath)
        [string] $Initials,          # OPTIONAL | Middle initials (maps to initials)
        [string] $DisplayName,       # OPTIONAL | Full display name (defaults to "$GivenName $Surname")
        [datetime] $AccountExpirationDate,  # OPTIONAL | Account expiry (e.g. for contractors with fixed end dates)
        [string] $LogonWorkstations, # OPTIONAL | Comma-separated computer names the user may log into (e.g. "PC-01,PC-02")
        [switch] $SmartcardLogonRequired,   # OPTIONAL | Enforce smart card authentication
        [switch] $PasswordNeverExpires,     # OPTIONAL | Bypass password policy (use sparingly)
        [switch] $AccountNotDelegated,      # OPTIONAL | Mark account as sensitive — cannot be delegated (e.g. for privileged users)

        # Enterprise — custom extension attributes (common for HR/SSO integrations)
        [string] $DepartmentNumber,  # OPTIONAL | Cost centre or department code (e.g. "ENG-421")
        [string] $WwwHomePage,       # OPTIONAL | Personal web page URL
        [string] $ExtensionAttribute1,  [string] $ExtensionAttribute2,
        [string] $ExtensionAttribute3,  [string] $ExtensionAttribute4,
        [string] $ExtensionAttribute5,  [string] $ExtensionAttribute6,
        [string] $ExtensionAttribute7,  [string] $ExtensionAttribute8,
        [string] $ExtensionAttribute9,  [string] $ExtensionAttribute10,
        [string] $ExtensionAttribute11, [string] $ExtensionAttribute12,
        [string] $ExtensionAttribute13, [string] $ExtensionAttribute14,
        [string] $ExtensionAttribute15
    )

    # Module check
    if (-not (Get-Module -Name ActiveDirectory -ListAvailable)) {
        throw "ActiveDirectory module not found. Install RSAT tools and try again."
    }
    Import-Module ActiveDirectory -ErrorAction Stop

    if (-not $DisplayName) { $DisplayName = "$GivenName $Surname" }
    if (-not $mailNickname) { $mailNickname = $SamAccountName }

    # Generate a random 16-character printable password
    $plainPwd = -join ((33..126) | Get-Random -Count 16 | ForEach-Object { [char]$_ })
    $securePwd = ConvertTo-SecureString -String $plainPwd -AsPlainText -Force

    $attrs = @{
        GivenName           = $GivenName
        Surname             = $Surname
        DisplayName         = $DisplayName
        Name                = $DisplayName
        SamAccountName      = $SamAccountName
        UserPrincipalName   = $UserPrincipalName
        EmailAddress        = $EmailAddress
        Title               = $Title
        Department          = $Department
        Division            = $Division
        Company             = $Company
        Description         = $Description
        EmployeeID          = $EmployeeID
        EmployeeNumber      = $EmployeeNumber
        EmployeeType        = $EmployeeType
        OfficePhone         = $OfficePhone
        MobilePhone         = $MobilePhone
        HomePhone           = $HomePhone
        Fax                 = $Fax
        Office              = $Office
        StreetAddress       = $StreetAddress
        City                = $City
        State               = $State
        PostalCode          = $PostalCode
        Country             = $Country
        POBox               = $POBox
        mailNickname        = $mailNickname
        ProxyAddresses      = $ProxyAddresses
        Initials            = $Initials
        HomeDirectory       = $HomeDirectory
        HomeDrive           = $HomeDrive
        ScriptPath          = $ScriptPath
        ProfilePath         = $ProfilePath
        DepartmentNumber    = $DepartmentNumber
        WwwHomePage         = $WwwHomePage
        AccountPassword     = $securePwd
        Enabled             = $true
        PassThru            = $true
        ChangePasswordAtLogon = -not $PasswordNeverExpires
    }

    # Extension attributes 1-15
    for ($i = 1; $i -le 15; $i++) {
        $propName = "ExtensionAttribute$i"
        if ($PSBoundParameters.ContainsKey($propName)) {
            $attrs[$propName] = Get-Variable -Name $propName -ValueOnly
        }
    }

    if ($SmartcardLogonRequired)  { $attrs.SmartcardLogonRequired = $true }
    if ($AccountExpirationDate)   { $attrs.AccountExpirationDate = $AccountExpirationDate }
    if ($PasswordNeverExpires)    { $attrs.PasswordNeverExpires = $true }
    if ($AccountNotDelegated)     { $attrs.AccountNotDelegated = $true }
    if ($LogonWorkstations)       { $attrs.LogonWorkstations = $LogonWorkstations }
    if ($TargetAddress) {
        $attrs.TargetAddress = $TargetAddress
        $null = $attrs.ProxyAddresses
    }
    if ($ProxyAddresses -or $TargetAddress) {
        $combined = @($ProxyAddresses)
        if ($TargetAddress) { $combined += "SMTP:$TargetAddress" }
        $attrs.ProxyAddresses = $combined
    }

    # Remove empty strings to avoid AD attribute errors
    $emptyKeys = @($attrs.Keys | Where-Object { -not $attrs[$_] -and $attrs[$_] -is [string] })
    foreach ($k in $emptyKeys) { $null = $attrs.Remove($k) }

    if ($Manager) {
        try {
            $managerObj = Get-ADUser -Identity $Manager -ErrorAction Stop
            $attrs.Manager = $managerObj.DistinguishedName
        } catch {
            Write-Warning "Manager '$Manager' not found — skipping."
        }
    }

    # Validate OU exists
    try {
        $null = Get-ADOrganizationalUnit -Identity $Path -ErrorAction Stop
    } catch {
        Write-Warning "OU '$Path' not found — creating user may fail."
    }

    $existing = Get-ADUser -Filter "SamAccountName -eq '$SamAccountName'" -ErrorAction SilentlyContinue

    if ($existing) {
        $dn = $existing.DistinguishedName
        $null = $attrs.Remove('AccountPassword')
        $null = $attrs.Remove('Enabled')
        $null = $attrs.Remove('PassThru')
        $null = $attrs.Remove('ChangePasswordAtLogon')
        $null = $attrs.Remove('Name')

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

    if ($dn -and $PSCmdlet.ShouldProcess($SamAccountName, "Generate password")) {
        Write-Host "Temporary password for $SamAccountName: $plainPwd" -ForegroundColor Cyan
    }

    if ($dn -and $PSCmdlet.ShouldProcess($SamAccountName, "Add to groups")) {
        foreach ($group in $GroupMembership) {
            try {
                Add-ADGroupMember -Identity $group -Members $dn -ErrorAction Stop
            } catch {
                Write-Warning "Failed to add to group '$group': $_"
            }
        }
    }

    if ($dn -and $attrs.ContainsKey('Manager') -and $PSCmdlet.ShouldProcess($SamAccountName, "Set manager")) {
        Set-ADUser -Identity $dn -Manager $attrs.Manager
    }

    [PSCustomObject]@{
        SamAccountName = $SamAccountName
        DisplayName    = $DisplayName
        DN             = $dn
        Groups         = ($GroupMembership -join ';')
        Manager        = $Manager
        EmployeeID     = $EmployeeID
        Title          = $Title
        Department     = $Department
    }
}

# usage
$params = @{
    GivenName           = "Jane"
    Surname             = "Doe"
    SamAccountName      = "jane.doe"
    UserPrincipalName   = "jane.doe@contoso.com"
    EmailAddress        = "jane.doe@contoso.com"
    mailNickname        = "jane.doe"
    ProxyAddresses      = @("smtp:jane@contoso.com", "smtp:jane.doe@contoso.net")
    Path                = "OU=Users,OU=HQ,DC=contoso,DC=com"
    GroupMembership     = @("Domain Users", "VPN-Users", "Engineering-Team")

    Title               = "Senior Engineer"
    Department          = "Engineering"
    Division            = "Product"
    Company             = "Contoso Ltd"
    Manager             = "john.smith"
    EmployeeID          = "EMP00421"
    EmployeeType        = "Full-Time"

    OfficePhone         = "+1 555-0123"
    MobilePhone         = "+1 555-0199"
    Office              = "HQ-4F"

    StreetAddress       = "200 Tech Drive"
    City                = "San Francisco"
    State               = "CA"
    PostalCode          = "94105"
    Country             = "US"

    HomeDirectory       = "\\nas\home\jane.doe"
    HomeDrive           = "H:"
    LogonWorkstations   = "PC-001,PC-002"
    AccountNotDelegated = $true
    Description         = "Onboarded $(Get-Date -Format yyyy-MM-dd)"

    DepartmentNumber    = "ENG-421"
    ExtensionAttribute1 = "Badge-8842"
    ExtensionAttribute4 = "UK-Region"
}
New-ADOnboardedUser @params
```

### Bulk Onboard from CSV

Iterate over a CSV with the same parameter names, piping each row through the single-user function. Multi-valued fields like groups are delimited by `;` in the CSV.

```csv
FirstName,LastName,Username,OU, Groups,Title,Department,Manager,EmployeeID
Jane,Doe,jane.doe,OU=Users,DC=contoso,DC=com,"Domain Users;VPN-Users;Eng-Team",Engineer,Engineering,john.smith,EMP0421
John,Smith,john.smith,OU=Users,DC=contoso,DC=com,"Domain Users;VPN-Users",Manager,Engineering,,EMP0422
```

```powershell
$users = Import-Csv -Path .\onboard-users.csv
foreach ($row in $users) {
    $params = @{
        GivenName        = $row.FirstName
        Surname          = $row.LastName
        SamAccountName   = $row.Username
        UserPrincipalName = "$($row.Username)@contoso.com"
        Path             = $row.OU
        GroupMembership  = $row.Groups -split ';'
        Title            = $row.Title
        Department       = $row.Department
        Manager          = $row.Manager
        EmployeeID       = $row.EmployeeID
    }
    try {
        New-ADOnboardedUser @params
    } catch {
        Write-Warning "Failed to onboard $($row.Username): $_"
    }
}
```

## AD User Helper

### Get Group Memberships of an Existing User

Returns the distinguished names of all non-protected groups a user belongs to, formatted as a semicolon-separated string ready to pass to `New-ADOnboardedUser -GroupMembership`.

```powershell
function Get-ADUserGroupList {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName
    )

    $user = Get-ADUser -Identity $SamAccountName -Properties MemberOf -ErrorAction Stop
    $groups = $user.MemberOf |
        Where-Object { $_ -notlike "*Domain Users*" } |
        ForEach-Object { (Get-ADGroup -Identity $_).SamAccountName }

    [PSCustomObject]@{
        SamAccountName   = $SamAccountName
        GroupCount       = @($groups).Count
        GroupMembership  = $groups -join ';'
        Groups           = $groups
    }
}

# usage — pipe GroupMembership string back into onboarding
$ref = Get-ADUserGroupList -SamAccountName "jane.doe"
New-ADOnboardedUser -SamAccountName "jane.doe" -GroupMembership ($ref.GroupMembership -split ';')
```

## Active Directory User Offboarding

### Method 1: Disable and Rename

Disable the account, strip group memberships, clear the manager field, and rename the display name so a re-hired user with the same name won't conflict. Keeps the object in AD for auditing.

```powershell
function Disable-ADUserAndRename {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName,
        [string[]] $GroupsToKeep,   # OPTIONAL | Group SAM names to preserve (e.g. @("Domain Users", "All-Employees"))
        [string] $Description
    )

    if (-not (Get-Module -Name ActiveDirectory -ListAvailable)) {
        throw "ActiveDirectory module not found. Install RSAT tools and try again."
    }
    Import-Module ActiveDirectory -ErrorAction Stop

    $user = Get-ADUser -Identity $SamAccountName -Properties MemberOf, Manager -ErrorAction Stop
    $today = Get-Date -Format "yyyy-MM-dd"
    $suffix = "_disabled_$today"
    $newSam = "$($user.SamAccountName)$suffix"

    # Resolve kept groups to DNs for comparison (filter out any that failed lookup)
    $keepDNs = $GroupsToKeep | ForEach-Object {
        try { (Get-ADGroup -Identity $_ -ErrorAction Stop).DistinguishedName }
        catch { Write-Warning "Keep-group '$_' not found — skipping."; $null }
    } | Where-Object { $_ }

    if ($PSCmdlet.ShouldProcess($SamAccountName, "Disable and rename")) {
        # Remove from all groups except Domain Users and the keep list
        $user.MemberOf | Where-Object {
            $_ -notlike "*CN=Domain Users,*" -and
            $_ -notin $keepDNs
        } | ForEach-Object {
            try { Remove-ADGroupMember -Identity $_ -Members $user.DistinguishedName -Confirm:$false -ErrorAction SilentlyContinue }
            catch { Write-Warning "Failed to remove from $_" }
        }

        $upnParts = $user.UserPrincipalName -split '@'
        $newUPN = "$($upnParts[0])$suffix@$($upnParts[1])"

        Set-ADUser -Identity $user.DistinguishedName -Clear Manager
        Set-ADUser -Identity $user.DistinguishedName -DisplayName "$($user.DisplayName) [Disabled $today]"
        Set-ADUser -Identity $user.DistinguishedName -SamAccountName $newSam
        Set-ADUser -Identity $user.DistinguishedName -UserPrincipalName $newUPN
        Set-ADUser -Identity $user.DistinguishedName -Description $Description
        Disable-ADAccount -Identity $user.DistinguishedName

        Write-Host "Disabled and renamed $SamAccountName → $newSam" -ForegroundColor Yellow
    }

    [PSCustomObject]@{
        OriginalSam = $SamAccountName
        NewSam      = $newSam
        DisabledOn  = $today
    }
}

Disable-ADUserAndRename -SamAccountName "jane.doe" -Description "Offboarded 2026-07-21"
```

### Method 2: Delete

Permanently remove the user from AD. Use only when retention policies allow immediate deletion.

```powershell
function Remove-ADUserWithCleanup {
    [CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
    param(
        [Parameter(Mandatory)] [string] $SamAccountName
    )

    if (-not (Get-Module -Name ActiveDirectory -ListAvailable)) {
        throw "ActiveDirectory module not found. Install RSAT tools and try again."
    }
    Import-Module ActiveDirectory -ErrorAction Stop

    $user = Get-ADUser -Identity $SamAccountName -Properties MemberOf -ErrorAction Stop

    if ($PSCmdlet.ShouldProcess($SamAccountName, "DELETE permanently")) {
        # Strip group memberships first so the deletion doesn't leave orphaned ACL references
        $user.MemberOf | ForEach-Object {
            try { Remove-ADGroupMember -Identity $_ -Members $user.DistinguishedName -Confirm:$false -ErrorAction SilentlyContinue }
            catch { Write-Warning "Failed to remove from $_" }
        }
        Remove-ADUser -Identity $user.DistinguishedName -Confirm:$false
        Write-Host "Deleted $SamAccountName" -ForegroundColor Red
    }
}

Remove-ADUserWithCleanup -SamAccountName "jane.doe"
```
