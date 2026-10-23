import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('desktop_lifecycle',Path(__file__).resolve().parents[1]/'src/inori/desktop_lifecycle.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class DesktopDetectionTests(unittest.TestCase):
    def test_desktop_paths(self):
        self.assertTrue(module.is_desktop_path(r'C:\Program Files\WindowsApps\OpenAI.Codex_26_x64\app\ChatGPT.exe'))
        self.assertTrue(module.is_desktop_path(r'C:\Users\me\AppData\Local\OpenAI\Codex\app\Codex.exe'))
    def test_cli_and_other_chatgpt_are_not_desktop(self):
        self.assertFalse(module.is_desktop_path(r'C:\Users\me\AppData\Local\OpenAI\Codex\bin\hash\codex.exe'))
        self.assertFalse(module.is_desktop_path(r'C:\Users\me\.codex\plugins\.plugin-appserver\codex.exe'))
        self.assertFalse(module.is_desktop_path(r'C:\other\ChatGPT.exe'))
if __name__=='__main__':unittest.main()
