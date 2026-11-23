"""Run an isolated Windows pet exit and check its owned process tree is gone."""
from pathlib import Path
import argparse,ctypes,json,os,subprocess,time

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--electron',type=Path,required=True)
p.add_argument('--python',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--main',type=Path)
p.add_argument('--trigger',choices=['menu','native','plugin'],required=True)
a=p.parse_args();source=Path(__file__).resolve().parents[1]
assert os.name=='nt','Windows process-tree regression'
assert not a.out.exists(),'Use a fresh isolated output directory'
a.out.mkdir(parents=True)
env={**os.environ,'INORI_TEST_OUT':str(a.out.resolve()),'INORI_DATA_DIR':str((a.out/'data').resolve()),'CODEX_PET_HOME':str((a.out/'home').resolve()),'INORI_PYTHON':str(a.python.resolve()),'INORI_QUIT_TRIGGER':a.trigger,'INORI_TEST_MAIN':str((a.main or source/'src/inori/main.cjs').resolve()),'INORI_TEST_PLUGIN_SERVER':str(source/'plugins/codex-pet/server/index.cjs')}
env.pop('ELECTRON_RUN_AS_NODE',None)
kernel=ctypes.WinDLL('kernel32',use_last_error=True)
kernel.OpenProcess.argtypes=[ctypes.c_uint32,ctypes.c_int,ctypes.c_uint32];kernel.OpenProcess.restype=ctypes.c_void_p
kernel.WaitForSingleObject.argtypes=[ctypes.c_void_p,ctypes.c_uint32];kernel.WaitForSingleObject.restype=ctypes.c_uint32
kernel.CloseHandle.argtypes=[ctypes.c_void_p]
def alive(pid):
    handle=kernel.OpenProcess(0x100000,False,pid)
    if not handle:return False
    try:return kernel.WaitForSingleObject(handle,0)==258
    finally:kernel.CloseHandle(handle)

with (a.out/'stdout.txt').open('wb') as stdout,(a.out/'stderr.txt').open('wb') as stderr:
    process=subprocess.Popen([str(a.electron),'--no-sandbox',str(source/'tests/quit-runtime-regression.cjs')],env=env,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        code=process.wait(timeout=12)
        pids=json.loads((a.out/'bridge-pids.json').read_text())
        config=json.loads((a.out/'home/runtime.json').read_text(encoding='utf-8-sig'))
        trigger=json.loads((a.out/'trigger.json').read_text())
        result={'trigger':a.trigger,'exitCode':code,'electronExited':not alive(process.pid),'bridgeExited':not alive(pids['bridge']),'ownedChildExited':not alive(pids['child']),'petStopped':config.get('petStopped') is True,'quitMilliseconds':round(time.time()*1000-trigger['at'])}
        result['passed']=code==0 and all(result[k] for k in ['electronExited','bridgeExited','ownedChildExited','petStopped'])
        (a.out/'report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps(result))
    finally:
        # Only terminate this fixture's own processes if the regression failed.
        ids=[process.pid]
        if (a.out/'bridge-pids.json').exists():ids+=list(json.loads((a.out/'bridge-pids.json').read_text()).values())
        for pid in ids:
            if alive(pid):subprocess.run(['taskkill.exe','/PID',str(pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
raise SystemExit(0 if result['passed'] else 1)
