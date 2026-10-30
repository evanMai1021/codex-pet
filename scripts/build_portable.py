"""Build a new local Windows portable directory without modifying installed apps."""
from pathlib import Path
import argparse,json,shutil,zipfile
from validate_assets import check
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--python-runtime',required=True,type=Path);p.add_argument('--electron-dist',type=Path);p.add_argument('--out-dir',type=Path);a=p.parse_args()
r=Path(__file__).resolve().parents[1];version=json.loads((r/'package.json').read_text(encoding='utf-8'))['version'];electron=a.electron_dist or r/'node_modules/electron/dist';runtime=a.python_runtime.resolve()
for f in [electron/'electron.exe',runtime/'python.exe',runtime/'LICENSE.txt']:
    if not f.is_file():p.error('Missing runtime file: '+str(f))
if (runtime/'Lib/site-packages').exists() and any((runtime/'Lib/site-packages').iterdir()):p.error('Use a standalone Python runtime without site-packages')
for skin in ['redwhite','battle']:check(r/'src/inori/assets'/skin)
out=(a.out_dir or r/'dist')/('inori-codex-pet-v'+version);archive=out.parent/(out.name+'.zip')
if out.exists() or archive.exists():p.error('Output already exists; preserve it or choose a new version')
out.mkdir(parents=True)
shutil.copytree(electron,out,dirs_exist_ok=True,ignore=shutil.ignore_patterns('electron.exe'))
shutil.copy2(electron/'electron.exe',out/'楪祈桌宠.exe');app=out/'resources/app';app.mkdir(parents=True,exist_ok=True)
shutil.copytree(r/'src',app/'src',ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
(app/'package.json').write_text(json.dumps({'name':'inori-codex-pet','version':version,'main':'src/inori/main.cjs','private':True}),encoding='utf-8')
revision=json.loads((r/'release-revision.json').read_text(encoding='utf-8'))
if revision['version']!=version or not isinstance(revision['revision'],int):raise ValueError('Invalid release revision')
shutil.copy2(r/'release-revision.json',app/'release-revision.json')
py=app/'runtime/python';py.mkdir(parents=True)
for f in runtime.iterdir():
    if f.is_file() and (f.name in ['python.exe','pythonw.exe','LICENSE.txt'] or f.suffix.lower() in ['.dll','.zip','._pth']):shutil.copy2(f,py/f.name)
for name in ['Lib','DLLs']:
    if (runtime/name).is_dir():shutil.copytree(runtime/name,py/name,ignore=shutil.ignore_patterns('site-packages','__pycache__','*.pyc','test','tests','ensurepip'))
shutil.copy2(r/'LICENSE',app/'LICENSE')
for name in ['README.md','ASSETS.md','THIRD-PARTY.md','CHANGELOG.md']:shutil.copy2(r/name,out/name)
shutil.copytree(r/'docs',out/'docs')
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
    for f in out.rglob('*'):
        if f.is_file():z.write(f,Path(out.name)/f.relative_to(out))
with zipfile.ZipFile(archive) as z:
    if z.testzip():raise RuntimeError('ZIP integrity check failed')
print(json.dumps({'version':version,'zip':str(archive),'crcPassed':True}))
