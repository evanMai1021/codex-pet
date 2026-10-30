param([ValidateSet('probe','extract','plugin','stop')][string]$Mode,[string]$Archive,[string]$Destination,[string]$Source,[string]$Executable,[int]$PetPid)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
function FileSha256([string]$File){
 $stream=[IO.File]::OpenRead($File);$hash=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($hash.ComputeHash($stream))}finally{$hash.Dispose();$stream.Dispose()}
}
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
 $catalogText=& $command.Source plugin marketplace list --json
 if($LASTEXITCODE){exit $LASTEXITCODE}
 $registered=($catalogText | ConvertFrom-Json).marketplaces | Where-Object {$_.name -eq 'inori-pet-local'}
 $wanted=Get-Content -LiteralPath (Join-Path $Source 'plugins/codex-pet/plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 $restoreFiles=@()
 if($registered){
  $installedText=& $command.Source plugin list --marketplace inori-pet-local --json
  if($LASTEXITCODE){exit $LASTEXITCODE}
  $installed=($installedText | ConvertFrom-Json).installed | Where-Object {$_.pluginId -eq 'codex-pet@inori-pet-local'}
  $existingRoot=[IO.Path]::GetFullPath($registered.root)
  $manifestPath=Join-Path $existingRoot '.agents/plugins/marketplace.json'
  $entry=((Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json).plugins | Where-Object {$_.name -eq 'codex-pet'})
  if(!$entry -or $entry.source.source -ne 'local'){throw 'Existing plugin source requires manual review'}
  $pluginPath=[IO.Path]::GetFullPath((Join-Path $existingRoot $entry.source.path))
  if(!$pluginPath.StartsWith($existingRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Existing plugin source escaped marketplace'}
  $managed=$existingRoot -match '\\.codex\\|\\.cache\\' -or (Test-Path -LiteralPath (Join-Path $existingRoot '.git'))
  if($managed){
   & $command.Source plugin marketplace upgrade inori-pet-local --json
   if($LASTEXITCODE){exit $LASTEXITCODE}
   $available=Get-Content -LiteralPath (Join-Path $pluginPath 'plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
   if($available.version -ne $wanted.version){throw 'Marketplace is pinned or not refreshed to this release'}
  }else{
   $incoming=[IO.Path]::GetFullPath((Join-Path $Source 'plugins/codex-pet'))
   $backup=Join-Path $Source 'plugin-source-before'
   foreach($file in Get-ChildItem -LiteralPath $incoming -File -Recurse){
    $relative=$file.FullName.Substring($incoming.Length+1)
    $target=Join-Path $pluginPath $relative
    if(Test-Path -LiteralPath $target){
     $saved=Join-Path $backup $relative
     New-Item -ItemType Directory -Force (Split-Path $saved) | Out-Null
     Copy-Item -LiteralPath $target -Destination $saved
     $restoreFiles+=@{source=$saved;target=$target}
    }
    New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $target
   }
  }
 }else{
  & $command.Source plugin marketplace add $Source
  if($LASTEXITCODE){exit $LASTEXITCODE}
 }
 $resultText=& $command.Source plugin add codex-pet@inori-pet-local --json
 $installExit=$LASTEXITCODE
 if($installExit){foreach($item in $restoreFiles){Copy-Item -LiteralPath $item.source -Destination $item.target};exit $installExit}
 # A matching version alone is insufficient: verify the CLI-refreshed installed copy.
 $result=$resultText | ConvertFrom-Json
 if(!$result.installedPath){throw 'Plugin install returned no installed path'}
 $incoming=[IO.Path]::GetFullPath((Join-Path $Source 'plugins/codex-pet'))
 foreach($file in Get-ChildItem -LiteralPath $incoming -File -Recurse){
  $relative=$file.FullName.Substring($incoming.Length+1)
  $target=Join-Path $result.installedPath $relative
  if(!(Test-Path -LiteralPath $target) -or (FileSha256 $target) -ne (FileSha256 $file.FullName)){throw 'Installed plugin content does not match release; refresh its marketplace and retry'}
 }
 Write-Output 'Plugin installed and content verified'
 exit 0
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
