import importlib.util,unittest
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('desktop_lifecycle',Path(__file__).resolve().parents[1]/'src/inori/desktop_lifecycle.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class DesktopDetectionTests(unittest.TestCase):
    def test_orphaned_renderer_does_not_keep_desktop_alive(self):
        class Function:
            def __init__(self, fn):self.fn=fn
            def __call__(self,*args):return self.fn(*args)
        class Kernel:
            def __init__(self):
                self.rows=[(100,1),(101,100)];self.live={100,101};self.index=0
                for name,fn in [('CreateToolhelp32Snapshot',lambda *_:1),('OpenProcess',lambda access,inherit,pid:pid),('CloseHandle',lambda *_:1),('WaitForSingleObject',lambda handle,ms:258 if handle in self.live else 0),('Process32FirstW',self.first),('Process32NextW',self.next),('QueryFullProcessImageNameW',self.image)]:setattr(self,name,Function(fn))
            def fill(self,entry):
                pid,parent=self.rows[self.index];entry._obj.pid=pid;entry._obj.parent=parent;entry._obj.name='ChatGPT.exe';return 1
            def first(self,snapshot,entry):self.index=0;return self.fill(entry)
            def next(self,snapshot,entry):
                self.index+=1
                if self.index==len(self.rows):module.ctypes.set_last_error(18);return 0
                return self.fill(entry)
            def image(self,handle,flags,buf,size):buf.value=r'C:\Program Files\WindowsApps\OpenAI.Codex_26_x64\app\ChatGPT.exe';return 1
        kernel=Kernel()
        with patch.object(module.ctypes,'WinDLL',return_value=kernel),patch.object(module,'_desktop_probe',None,create=True):
            self.assertTrue(module.desktop_running())
            kernel.rows=[(101,100)];kernel.live={101}
            self.assertFalse(module.desktop_running(),'renderer with dead main process must not keep pet alive')
    def test_packaged_cli_is_not_the_desktop(self):
        self.assertFalse(module.is_desktop_path(r'C:\Program Files\WindowsApps\OpenAI.Codex_26_x64\app\resources\codex.exe'))
        self.assertFalse(module.is_desktop_path(r'C:\Program Files\WindowsApps\OpenAI.Codex_26_x64\app\bin\codex.exe'))
    def test_exit_monitor_two_confirmations_within_400ms_and_no_status_queue(self):
        class Clock:
            elapsed = 0
            def is_set(self):return self.elapsed >= .6
            def wait(self, seconds):self.elapsed += seconds
        clock=Clock();observations=[];states=iter([True,False,False])
        module.monitor_desktop(clock,lambda value:observations.append((clock.elapsed,value['running'])),lambda:next(states))
        self.assertEqual([v for _,v in observations],[True,False,False])
        self.assertLessEqual(observations[-1][0],.4)
    def test_monitor_reports_unknown_on_read_error(self):
        class Stop:
            stopped=False
            def is_set(self):return self.stopped
            def wait(self, seconds):self.stopped=True
        def broken():raise OSError('denied')
        observations=[];module.monitor_desktop(Stop(),observations.append,broken)
        self.assertIsNone(observations[0]['running'])
    def test_desktop_paths(self):
        self.assertTrue(module.is_desktop_path(r'C:\Program Files\WindowsApps\OpenAI.Codex_26_x64\app\ChatGPT.exe'))
        self.assertTrue(module.is_desktop_path(r'C:\Users\me\AppData\Local\OpenAI\Codex\app\Codex.exe'))
    def test_cli_and_other_chatgpt_are_not_desktop(self):
        self.assertFalse(module.is_desktop_path(r'C:\Users\me\AppData\Local\OpenAI\Codex\bin\hash\codex.exe'))
        self.assertFalse(module.is_desktop_path(r'C:\Users\me\.codex\plugins\.plugin-appserver\codex.exe'))
        self.assertFalse(module.is_desktop_path(r'C:\other\ChatGPT.exe'))
if __name__=='__main__':unittest.main()
