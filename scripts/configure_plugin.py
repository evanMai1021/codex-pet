"""Point the local settings plugin at a user-chosen portable executable."""
from pathlib import Path
import argparse,datetime,json,os,shutil
p=argparse.ArgumentParser(description=__doc__);p.add_argument('executable',type=Path);p.add_argument('--config-dir',type=Path);a=p.parse_args()
exe=a.executable.resolve()
if not exe.is_file() or exe.suffix.lower()!='.exe':p.error('Provide the full path to an existing desktop pet .exe')
folder=a.config_dir or Path(os.environ.get('APPDATA',str(Path.home())))/'CodexPet'
folder.mkdir(parents=True,exist_ok=True);file=folder/'runtime.json';data={}
if file.exists():
    try:data=json.loads(file.read_text(encoding='utf-8-sig'))
    except (ValueError,OSError):p.error('Existing runtime.json is invalid; inspect it before changing it')
    if not isinstance(data,dict):p.error('Existing runtime.json must be an object')
    backup=folder/('runtime.'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.backup.json');shutil.copy2(file,backup)
data['inoriExecutable']=str(exe)
file.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('Local executable configured. No account settings were changed and no program was started.')
