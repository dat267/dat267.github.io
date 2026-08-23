#requires -Version 5.1
<#
.SYNOPSIS
    Terminal UI browser for the dat267.github.io knowledge base.
.DESCRIPTION
    Fetches the docs index of the Astro/Starlight site and opens an interactive
    terminal UI to search, browse, and read the documentation.
    Run remotely with:
        irm https://dat267.github.io/kb-tui.ps1 | iex
.PARAMETER List
    Print the doc index and exit without starting the TUI.
.PARAMETER Version
    Print the script version and exit.
.EXAMPLE
    pwsh -NoProfile -File kb-tui.ps1 -List
#>
param(
    [switch]$List,
    [switch]$Version
)

$ErrorActionPreference = 'Stop'
$esc = [string][char]27

# ---- config ----
$script:Repo = 'dat267/dat267.github.io'
$script:Ref  = 'main'
$script:Root = 'src/content/docs'
$script:Api  = "https://api.github.com/repos/$($script:Repo)/git/trees/$($script:Ref)?recursive=1"
$script:Raw  = "https://raw.githubusercontent.com/$($script:Repo)/$($script:Ref)/$($script:Root)"
$script:Agent = @{ 'User-Agent' = 'dat267-kb-tui' }

function Get-DocIndex {
    $res = Invoke-RestMethod -Uri $script:Api -Headers $script:Agent
    $items = $res.tree | Where-Object {
        $_.type -eq 'blob' -and
        $_.path.StartsWith($script:Root + '/') -and
        $_.path -match '\.(md|mdx)$'
    }
    $out = foreach ($it in $items) {
        $rel = $it.path.Substring($script:Root.Length + 1)
        $segs = $rel -split '/'
        $name = [IO.Path]::GetFileNameWithoutExtension($segs[-1])
        if ($name -eq 'index') { continue }
        [pscustomobject]@{
            Section = if ($segs.Count -gt 1) { $segs[0] } else { 'Top' }
            Title   = $name -replace '[_-]', ' '
            Path    = $it.path
        }
    }
    $out | Sort-Object Section, Title
}

function Get-DocContent {
    param([string]$Path)
    $rel = $Path.Substring($script:Root.Length + 1)
    $url = $script:Raw + '/' + (($rel -split '/' | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/')
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('dat267-' + [IO.Path]::GetFileName($Path))
    Invoke-WebRequest -Uri $url -Headers $script:Agent -UseBasicParsing -OutFile $tmp
    try {
        Get-Content -LiteralPath $tmp -Raw -Encoding UTF8
    } finally {
        Remove-Item -LiteralPath $tmp -Force
    }
}

function Get-DocBody {
    param([string]$Text)
    $lines = $Text -split "`n"
    if ($lines.Count -gt 0 -and $lines[0].Trim() -eq '---') {
        for ($i = 1; $i -lt $lines.Count; $i++) {
            if ($lines[$i].Trim() -eq '---') {
                return ($lines[($i + 1)..($lines.Count - 1)] -join "`n")
            }
        }
    }
    $Text
}

function ConvertTo-Ansi {
    param([string]$Body)
    $out = [System.Collections.Generic.List[string]]::new()
    $inCode = $false
    foreach ($line in ($Body -split "`n")) {
        $l = $line.TrimEnd("`r")
        $trimmed = $l.Trim()
        if ($trimmed.StartsWith('```')) {
            $inCode = -not $inCode
            continue
        }
        if ($inCode) {
            $out.Add("$esc[38;5;245m$l$esc[0m")
            continue
        }
        if ($trimmed -eq '') {
            $out.Add('')
            continue
        }
        if ($l -match '^#{1,6}\s+(.*)$') {
            $hash = ($Matches[0] -split ' ')[0]
            if ($hash.Length -le 2) { $out.Add("$esc[1;36m$($Matches[1])$esc[0m") }
            else { $out.Add("$esc[36m$($Matches[1])$esc[0m") }
            continue
        }
        if ($trimmed.StartsWith('- ') -or $trimmed.StartsWith('* ')) {
            $out.Add("  $esc[33m-$esc[0m " + $trimmed.Substring(2))
            continue
        }
        $render = [regex]::Replace($l, '`([^`]+)`', "$esc[38;5;220m`$1$esc[0m")
        $render = [regex]::Replace($render, '\[([^\]]+)\]\(([^)]+)\)', "`$1 ($esc[4;38;5;81m`$2$esc[0m)")
        $out.Add($render)
    }
    $out -join "`n"
}

function Write-Frame {
    param([string]$Text)
    [Console]::Out.Write($Text)
    [Console]::Out.Flush()
}

function Enable-VirtualTerminal {
    if ($env:OS -ne 'Windows_NT') { return }
    try {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $sig = '[DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr h, uint m);'
        $type = Add-Type -MemberDefinition $sig -Name Nt -Namespace K -PassThru
        $handle = [Console]::OpenStandardOutput().SafeFileHandle.DangerousGetHandle()
        $null = $type::SetConsoleMode($handle, 0x0004)
    } catch {
    }
}

function Show-Doc {
    param([pscustomobject]$Doc)
    try {
        $body = Get-DocBody (Get-DocContent -Path $Doc.Path)
    } catch {
        Write-Frame "$esc[2J$esc[H$esc[91mFailed to load `"$($Doc.Path)`": $($_.Exception.Message)$esc[0m"
        [Console]::ReadKey($true) | Out-Null
        return
    }
    $lines = (ConvertTo-Ansi $body) -split "`n"
    $off = 0
    while ($true) {
        $rows = [Math]::Max([Console]::WindowHeight - 3, 5)
        $width = [Math]::Max([Console]::WindowWidth, 20)
        $sb = [Text.StringBuilder]::new()
        [void]$sb.Append("$esc[H$esc[J")
        [void]$sb.Append("$esc[1;97m$($Doc.Title)  —  $($Doc.Section)$esc[0m`n")
        $last = [Math]::Min($off + $rows, $lines.Count)
        for ($i = $off; $i -lt $last; $i++) {
            $line = $lines[$i]
            if ($line.Length -gt $width) { $line = $line.Substring(0, $width - 1) }
            [void]$sb.Append("$line`n")
        }
        [void]$sb.Append("$esc[90m$($off + 1)-$last / $($lines.Count)   (arrows scroll, ← back, q quit)$esc[0m")
        Write-Frame $sb.ToString()

        $key = [Console]::ReadKey($true)
        if ($key.KeyChar -eq [char]3) { return }
        if ($key.Key -eq 'Escape' -or $key.KeyChar -eq 'q' -or $key.Key -eq 'LeftArrow') { return }
        if ($key.Key -eq 'UpArrow') { $off = [Math]::Max($off - 1, 0); continue }
        if ($key.Key -eq 'DownArrow') { $off = [Math]::Min($off + 1, [Math]::Max($lines.Count - $rows, 0)); continue }
        if ($key.Key -eq 'PageUp') { $off = [Math]::Max($off - $rows, 0); continue }
        if ($key.Key -eq 'PageDown') { $off = [Math]::Min($off + $rows, [Math]::Max($lines.Count - $rows, 0)); continue }
        if ($key.Key -eq 'Home') { $off = 0; continue }
        if ($key.Key -eq 'End') { $off = [Math]::Max($lines.Count - $rows, 0); continue }
    }
}

function Show-Tui {
    param([System.Collections.IList]$Docs)
    Enable-VirtualTerminal
    try {
        Write-Frame "$esc[?1049h$esc[?25l"
        [Console]::TreatControlCAsInput = $true
        $query = ''
        $sel = 0
        $top = 0
        while ($true) {
            $view = @($Docs | Where-Object { "$($_.Section) $($_.Title)" -like "*$query*" })
            $rows = [Math]::Max([Console]::WindowHeight - 4, 5)
            if ($sel -ge $view.Count) { $sel = [Math]::Max($view.Count - 1, 0) }
            if ($sel -lt $top) { $top = $sel }
            if ($sel -ge $top + $rows) { $top = $sel - $rows + 1 }

            $sb = [Text.StringBuilder]::new()
            [void]$sb.Append("$esc[H$esc[J")
            [void]$sb.Append("$esc[1;97m dat267.github.io knowledge base   (type to filter, ↑/↓ move, Enter read, q quit)$esc[0m`n")
            [void]$sb.Append("$esc[90m filter: $query$esc[0m`n")
            for ($i = $top; $i -lt $top + $rows - 1; $i++) {
                if ($i -ge $view.Count) { [void]$sb.Append("`n"); continue }
                $it = $view[$i]
                $label = "{0,-11} {1}" -f $it.Section, $it.Title
                if ($i -eq $sel) { [void]$sb.Append("$esc[7m $label $esc[0m`n") }
                else { [void]$sb.Append("  $label`n") }
            }
            [void]$sb.Append("$esc[90m $($view.Count) docs$esc[0m")
            Write-Frame $sb.ToString()

            $key = [Console]::ReadKey($true)
            if ($key.KeyChar -eq [char]3) { return }
            if ($key.Key -eq 'Escape' -or $key.KeyChar -eq 'q') { return }
            if ($key.Key -eq 'Enter') {
                if ($view.Count -gt 0) {
                    try { Show-Doc -Doc $view[$sel] } catch {
                        Write-Frame "$esc[H$esc[J$esc[91m$($_.Exception.Message)$esc[0m"
                        [Console]::ReadKey($true) | Out-Null
                    }
                }
                continue
            }
            if ($key.Key -eq 'UpArrow') { $sel = [Math]::Max($sel - 1, 0); continue }
            if ($key.Key -eq 'DownArrow') { $sel = [Math]::Min($sel + 1, $view.Count - 1); continue }
            if ($key.Key -eq 'PageUp') { $sel = [Math]::Max($sel - $rows, 0); continue }
            if ($key.Key -eq 'PageDown') { $sel = [Math]::Min($sel + $rows, $view.Count - 1); continue }
            if ($key.Key -eq 'Home') { $sel = 0; continue }
            if ($key.Key -eq 'End') { $sel = [Math]::Max($view.Count - 1, 0); continue }
            if ($key.Key -eq 'Backspace') {
                if ($query.Length -gt 0) { $query = $query.Substring(0, $query.Length - 1); $sel = 0 }
                continue
            }
            if ($key.KeyChar -ge ' ' -and $key.KeyChar -ne [char]0) {
                $query += $key.KeyChar
                $sel = 0
                continue
            }
        }
    } finally {
        Write-Frame "$esc[?25h$esc[?1049l"
        [Console]::TreatControlCAsInput = $false
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        if ($Version) { 'dat267 kb-tui 1.0.0'; return }
        $docs = @(Get-DocIndex)
        if ($docs.Count -eq 0) { throw 'No docs found; is the repository reachable?' }
        if ($List -or $env:DAT267_TUI_LIST -eq '1') {
            $docs | Format-Table Section, Title -AutoSize
            return
        }
        Show-Tui $docs
    } catch {
        Write-Error $_
        exit 1
    }
}