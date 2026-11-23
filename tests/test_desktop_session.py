import importlib.util,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('desktop_session_under_test',Path(__file__).resolve().parents[1]/'src/inori/desktop_lifecycle.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class SessionIdentityTests(unittest.TestCase):
    def test_identity_includes_pid_and_exact_creation_time(self):
        def times(handle,created,*unused):
            created._obj.dwHighDateTime=3;created._obj.dwLowDateTime=42
            return 1
        probe=SimpleNamespace(pids=[123],handles=[10],kernel=SimpleNamespace(GetProcessTimes=times))
        with patch.object(module,'desktop_running',return_value=True),patch.object(module,'_desktop_probe',probe):
            self.assertEqual(module.desktop_session(),[f'123:{(3<<32)|42}'])

    def test_unknown_is_not_a_new_session(self):
        with patch.object(module,'desktop_running',return_value=None):self.assertIsNone(module.desktop_session())

    def test_confirmed_absent_host_is_an_empty_session(self):
        with patch.object(module,'desktop_running',return_value=False):self.assertEqual(module.desktop_session(),[])

    def test_creation_time_failure_stays_unknown(self):
        probe=SimpleNamespace(pids=[123],handles=[10],kernel=SimpleNamespace(GetProcessTimes=lambda *args:0))
        with patch.object(module,'desktop_running',return_value=True),patch.object(module,'_desktop_probe',probe):self.assertIsNone(module.desktop_session())

if __name__=='__main__':unittest.main()
