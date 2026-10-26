param([ValidateSet('probe','extract','plugin','stop')][string]$Mode,[string]$Archive,[string]$Destination,[string]$Source,[string]$Executable,[int]$PetPid)
$ErrorActionPreference='Stop'
if($Mode -eq 'stop'){
 $process=Get-CimInstance Win32_Process -Filter "ProcessId = $PetPid"
 if(!$process){exit 0}
 if(!$process.ExecutablePath -or $process.ExecutablePath -ne [IO.Path]::GetFullPath($Executable)){throw 'Desktop pet process identity mismatch'}
 & taskkill.exe /PID $PetPid /T /F | Out-Null
 exit $LASTEXITCODE
}
if($Mode -eq 'probe' -or $Mode -eq 'plugin'){
 $command=Get-Command codex -ErrorAction Stop
 if($Mode -eq 'probe'){Write-Output 'ready';exit 0}
 & $command.Source plugin marketplace add $Source
 if($LASTEXITCODE){exit $LASTEXITCODE}
 & $command.Source plugin add codex-pet@inori-pet-local --json
 exit $LASTEXITCODE
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$target=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $target){throw 'Extraction destination already exists'}
$archiveFile=[IO.Compression.ZipFile]::OpenRead($Archive)
try{
 $sum=0L
 if($archiveFile.Entries.Count -gt 15000){throw 'Archive has too many entries'}
 foreach($entry in $archiveFile.Entries){
  $name=$entry.FullName.Replace('/',[IO.Path]::DirectorySeparatorChar)
  $resolved=[IO.Path]::GetFullPath([IO.Path]::Combine($target,$name))
  if(!$resolved.StartsWith($target+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Archive path escaped destination'}
  if($name.Contains(':') -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000){throw 'Archive contains unsupported entries'}
  $sum+=$entry.Length
  if($sum -gt 2GB){throw 'Archive extraction limit exceeded'}
 }
}finally{$archiveFile.Dispose()}
[IO.Compression.ZipFile]::ExtractToDirectory($Archive,$target)
