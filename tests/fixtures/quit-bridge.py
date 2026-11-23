import subprocess,sys,time,json
from pathlib import Path
root=Path(__import__('os').environ['INORI_TEST_OUT'])
child=subprocess.Popen([sys.executable,'-c','import time; time.sleep(120)'],creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
(root/'bridge-pids.json').write_text(json.dumps({'bridge':__import__('os').getpid(),'child':child.pid}))
# Deliberately stuck bridge: the real exit path must clean up its owned subtree.
while True:time.sleep(1)
