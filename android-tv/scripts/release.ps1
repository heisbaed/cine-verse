<#
.SYNOPSIS
Build and verify a personal TV release without changing its signing identity.
.EXAMPLE
powershell -NoProfile -File .\android-tv\scripts\release.ps1 -Notes 'Playback and TV controls fixes'

Outputs the signed APK, checksum and cine-verse-tv-release.json in android-tv/dist.
Version and versionCode come from the built APK. Uploading or publishing is separate.
Keep .signing/cineverse-tv.jks and signing.properties backed up for future updates.
#>
param(
    [string]$Notes = '',
    [ValidateRange(0, 100)][int]$RolloutPercent = 100
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskOriginalJava = $env:JAVA_HOME
$taskOriginalLocation = Get-Location

try {
    Set-Location -LiteralPath $taskRoot
    $taskKeystore = Join-Path $taskRoot '.signing\cineverse-tv.jks'
    $taskSigningProperties = Join-Path $taskRoot '.signing\signing.properties'
    if (!(Test-Path -LiteralPath $taskKeystore -PathType Leaf) -or !(Test-Path -LiteralPath $taskSigningProperties -PathType Leaf)) {
        throw 'The existing personal .jks signing identity is required. Recover it before releasing; never generate a replacement key for an update.'
    }
    if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
        $taskStudioJava = 'C:\Program Files\Android\Android Studio\jbr'
        if (!(Test-Path -LiteralPath (Join-Path $taskStudioJava 'bin\java.exe'))) { throw 'Set JAVA_HOME to a supported JDK before building.' }
        $env:JAVA_HOME = $taskStudioJava
    }
    $taskSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\sdk' }
    $taskBuildTools = Get-ChildItem -LiteralPath (Join-Path $taskSdk 'build-tools') -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
        Sort-Object { [version]$_.Name } -Descending |
        Where-Object { (Test-Path -LiteralPath (Join-Path $_.FullName 'aapt.exe')) -and (Test-Path -LiteralPath (Join-Path $_.FullName 'apksigner.bat')) } |
        Select-Object -First 1 -ExpandProperty FullName
    if (!$taskBuildTools) { throw 'Install Android SDK build-tools with aapt and apksigner.' }

    # Gradle uses the same .jks as installed personal builds. Do not sign again.
    & .\gradlew.bat :app:testLeanbackDebugUnitTest :app:assembleLeanbackRelease --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Release build or unit tests failed.' }
    $taskBuiltApk = Join-Path $taskRoot 'app\build\outputs\apk\leanback\release\app-leanback-release.apk'
    if (!(Test-Path -LiteralPath $taskBuiltApk -PathType Leaf)) { throw 'Gradle did not produce the signed leanback release APK.' }

    $taskBadging = (& (Join-Path $taskBuildTools 'aapt.exe') dump badging $taskBuiltApk | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the built APK.' }
    $taskPackage = [regex]::Match($taskBadging, "(?m)^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'")
    if (!$taskPackage.Success -or $taskPackage.Groups[1].Value -ne 'com.cineverse.tv') { throw 'The release is not the Cine-verse TV package.' }
    $taskVersionCode = [long]$taskPackage.Groups[2].Value
    $taskVersion = $taskPackage.Groups[3].Value
    if ($taskVersion -notmatch '^\d+\.\d+\.\d+$' -or $taskVersionCode -lt 1) { throw 'The APK must have a numeric semantic version and positive versionCode.' }
    if ($taskBadging -match '(?m)^application-debuggable') { throw 'A debuggable APK cannot be packaged as this release.' }

    $taskBuildConfigPath = Join-Path $taskRoot 'app\build\generated\source\buildConfig\leanback\release\com\cineverse\tv\BuildConfig.java'
    $taskBuildConfig = [IO.File]::ReadAllText($taskBuildConfigPath)
    $taskConfigVersion = [regex]::Match($taskBuildConfig, 'VERSION_NAME\s*=\s*"([^"]+)"').Groups[1].Value
    $taskConfigCode = [regex]::Match($taskBuildConfig, 'VERSION_CODE\s*=\s*(\d+)').Groups[1].Value
    if ($taskConfigVersion -ne $taskVersion -or $taskConfigCode -ne $taskVersionCode.ToString()) {
        throw 'APK version does not match the freshly generated release configuration. Refusing to package a stale artifact.'
    }
    $taskCoreMatch = [regex]::Match($taskBuildConfig, 'SCRAPER_BASE\s*=\s*"([^"]+)"')
    if (!$taskCoreMatch.Success -or $taskCoreMatch.Groups[1].Value -ne 'https://cineverse-core.onrender.com') {
        throw 'Release default Core must be the verified HTTPS Render endpoint. Check local.properties before rebuilding.'
    }
    $taskManifest = (& (Join-Path $taskBuildTools 'aapt.exe') dump xmltree $taskBuiltApk AndroidManifest.xml | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect release network security.' }
    if ($taskManifest -match 'android:networkSecurityConfig') { throw 'This release must use platform certificate trust, without the debug network-security override.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $taskZip = [IO.Compression.ZipFile]::OpenRead($taskBuiltApk)
    try {
        if ($taskZip.Entries.FullName -match '(?i)core_dev_cert|debug_network_security') { throw 'Development TLS resources leaked into the release APK.' }
    } finally { $taskZip.Dispose() }

    $taskSignature = (& (Join-Path $taskBuildTools 'apksigner.bat') verify --print-certs $taskBuiltApk | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    # SDK 37 labels schemes "V2 Signer:"; older tools use "Signer #1".
    # Several schemes may report the same certificate. Reject different identities.
    $taskSignerDigests = @([regex]::Matches($taskSignature, '(?m)^(?:Signer #\d+|V[1-4] Signer(?: #\d+)?):?\s+certificate SHA-256 digest:\s*([a-fA-F0-9]{64})\s*$') |
        ForEach-Object { $_.Groups[1].Value.ToLowerInvariant() } | Sort-Object -Unique)
    if ($taskSignerDigests.Count -ne 1) { throw 'Expected one verified APK signing identity.' }
    # signingReport reads the current Gradle identity without exposing passwords.
    $taskSigningReport = (& .\gradlew.bat :app:signingReport --no-daemon --console=plain --quiet | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'Could not confirm the Gradle personal signing identity.' }
    $taskReleaseSigning = ($taskSigningReport -split '(?m)^Variant:\s*') | Where-Object { $_ -match '^leanbackRelease\s' } | Select-Object -First 1
    if (!$taskReleaseSigning -or $taskReleaseSigning -notmatch '(?m)^Config:\s*personal\s*$') { throw 'Release is not using the existing Gradle personal signer.' }
    $taskStoreMatch = [regex]::Match($taskReleaseSigning, '(?m)^Store:\s*(.+)\s*$')
    if (!$taskStoreMatch.Success -or [IO.Path]::GetFullPath($taskStoreMatch.Groups[1].Value.Trim()) -ne [IO.Path]::GetFullPath($taskKeystore)) {
        throw 'Gradle release signer does not use .signing/cineverse-tv.jks.'
    }
    $taskExpectedSigner = [regex]::Match($taskReleaseSigning, '(?m)^SHA-256:\s*([a-fA-F0-9:]+)\s*$').Groups[1].Value.Replace(':', '').ToLowerInvariant()
    if ($taskExpectedSigner.Length -ne 64 -or $taskExpectedSigner -ne $taskSignerDigests[0]) {
        throw 'APK signer does not match the existing personal .jks identity.'
    }
    & (Join-Path $taskBuildTools 'zipalign.exe') -c -p 4 $taskBuiltApk
    if ($LASTEXITCODE -ne 0) { throw 'Signed APK alignment verification failed.' }

    $taskOutput = Join-Path $taskRoot 'dist'
    New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
    $taskFilename = "cine-verse-tv-v$taskVersion.apk"
    $taskApk = Join-Path $taskOutput $taskFilename
    Copy-Item -LiteralPath $taskBuiltApk -Destination $taskApk -Force
    $taskHash = (Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash.ToLowerInvariant()
    $taskSize = (Get-Item -LiteralPath $taskApk).Length
    if ($taskSize -lt 1 -or $taskSize -gt 500000000) { throw 'APK size is outside the updater supported range.' }
    $taskManifestPath = Join-Path $taskOutput 'cine-verse-tv-release.json'
    $taskRelease = [ordered]@{ version = $taskVersion; versionCode = $taskVersionCode; sha256 = $taskHash; size = $taskSize; notes = $Notes; rolloutPercent = $RolloutPercent }
    $taskUtf8 = New-Object Text.UTF8Encoding $false
    [IO.File]::WriteAllText("$taskApk.sha256", "$taskHash  $taskFilename`n", $taskUtf8)
    [IO.File]::WriteAllText($taskManifestPath, ($taskRelease | ConvertTo-Json) + "`n", $taskUtf8)
    Write-Output "Verified TV $taskVersion (versionCode $taskVersionCode), personal signer, Render HTTPS, platform TLS trust."
    Write-Output "APK: $taskApk"
    Write-Output "Manifest: $taskManifestPath"
    Write-Output "SHA-256: $taskHash"
    Write-Output "Size: $taskSize bytes"
    Write-Output 'No files were uploaded. Future updates must retain this .jks identity and increase versionCode.'
} finally {
    $env:JAVA_HOME = $taskOriginalJava
    Set-Location -LiteralPath $taskOriginalLocation.Path
}
