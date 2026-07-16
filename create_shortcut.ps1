$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$icoPath = Join-Path $scriptPath "redfire.ico"
$launchScript = Join-Path $scriptPath "launch_redfire.py"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "REDFIRE.lnk"

# Find pythonw.exe
$pythonw = (Get-Command "pythonw.exe" -ErrorAction SilentlyContinue).Source
if (-not $pythonw) {
    # Try common locations
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Python\Python314\pythonw.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\pythonw.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\pythonw.exe",
        "$env:ProgramFiles\Python314\pythonw.exe",
        "$env:ProgramFiles\Python313\pythonw.exe",
        "$env:ProgramFiles\Python312\pythonw.exe",
        "$env:USERPROFILE\AppData\Local\Microsoft\WindowsApps\pythonw.exe",
        "C:\Python314\pythonw.exe",
        "C:\Python313\pythonw.exe",
        "C:\Python312\pythonw.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $pythonw = $c; break }
    }
}

if (-not $pythonw) {
    Write-Output "[!] pythonw.exe not found. Trying python.exe as fallback..."
    $pythonw = (Get-Command "python.exe" -ErrorAction SilentlyContinue).Source
}

if (-not $pythonw) {
    Write-Output "[!] Python not found. Please install Python."
    exit 1
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $pythonw
$shortcut.Arguments = "`"$launchScript`""
$shortcut.Description = "REDFIRE - LLM Red Teaming Platform"
if (Test-Path $icoPath) {
    $shortcut.IconLocation = "$icoPath, 0"
}
$shortcut.WorkingDirectory = $scriptPath
$shortcut.Save()

Write-Output "[v] Shortcut created on desktop: $shortcutPath"
Write-Output "[v] Target: $pythonw"
Write-Output "[v] Icon: $icoPath"
Write-Output ""
Write-Output "Now you can:"
Write-Output "  - Pin to taskbar: right-click the desktop shortcut -> Pin to taskbar"
Write-Output "  - Or drag it to the taskbar to pin it"
