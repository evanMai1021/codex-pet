"""Read desktop process presence only; no windows, chats, accounts or startup tasks."""
import ctypes
import os
from ctypes import wintypes

POLL_SECONDS = .2

def monitor_desktop(closing, publish, read=None):
    """Publish directly, independently of potentially slow status/usage reads."""
    read = read or desktop_running
    while not closing.is_set():
        try: running = read()
        except (OSError, ValueError): running = None
        publish({'kind': 'desktopLifecycle', 'running': running,
                 'mainPids': desktop_root_pids() if read is desktop_running else []})
        closing.wait(POLL_SECONDS)

def is_desktop_path(path):
    p=path.replace('/', '\\').lower()
    return p.rsplit('\\',1)[-1] in ('chatgpt.exe','codex.exe') and p.rsplit('\\',1)[0].endswith('\\app') and (
        ('\\windowsapps\\openai.codex_' in p and '\\app\\' in p)
        or '\\openai\\codex\\app\\' in p)

class DesktopProcessProbe:
    """Bind main-process handles once; orphaned renderers never replace them."""
    def __init__(self):
        self.kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        self.handles=None
        self.pids=[]
        kernel=self.kernel
        kernel.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD]
        kernel.WaitForSingleObject.restype=wintypes.DWORD
        kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
        kernel.OpenProcess.restype=wintypes.HANDLE
        kernel.CloseHandle.argtypes=[wintypes.HANDLE]
        kernel.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]

    def read(self):
        kernel=self.kernel
        if self.handles is not None:
            states=[kernel.WaitForSingleObject(handle,0) for handle in self.handles]
            if 258 in states:return True
            return False if all(state==0 for state in states) else None
        return self.bind()

    def bind(self):
        kernel=self.kernel
        return _bind_desktop(self,kernel)

    def close(self):
        for handle in self.handles or []:self.kernel.CloseHandle(handle)
        self.handles=None;self.pids=[]

def _bind_desktop(probe,kernel):
    class Entry(ctypes.Structure):
        _fields_=[('size',wintypes.DWORD),('usage',wintypes.DWORD),('pid',wintypes.DWORD),
            ('heap',ctypes.c_size_t),('module',wintypes.DWORD),('threads',wintypes.DWORD),
            ('parent',wintypes.DWORD),('priority',wintypes.LONG),('flags',wintypes.DWORD),
            ('name',wintypes.WCHAR*260)]
    kernel.CreateToolhelp32Snapshot.argtypes=[wintypes.DWORD,wintypes.DWORD]
    kernel.CreateToolhelp32Snapshot.restype=wintypes.HANDLE
    kernel.Process32FirstW.argtypes=[wintypes.HANDLE,ctypes.POINTER(Entry)]
    kernel.Process32NextW.argtypes=[wintypes.HANDLE,ctypes.POINTER(Entry)]
    kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
    kernel.OpenProcess.restype=wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]
    kernel.CloseHandle.argtypes=[wintypes.HANDLE]
    handle=kernel.CreateToolhelp32Snapshot(2,0)
    if handle==ctypes.c_void_p(-1).value:return None
    unknown=False;candidates={}
    try:
        entry=Entry();entry.size=ctypes.sizeof(Entry)
        if not kernel.Process32FirstW(handle,ctypes.byref(entry)):return None
        while True:
            if entry.name.lower() in ('chatgpt.exe','codex.exe'):
                proc=kernel.OpenProcess(0x1000,False,entry.pid)
                if proc:
                    try:
                        size=wintypes.DWORD(32768);buf=ctypes.create_unicode_buffer(size.value)
                        if kernel.QueryFullProcessImageNameW(proc,0,buf,ctypes.byref(size)):
                            if is_desktop_path(buf.value):
                                watched=kernel.OpenProcess(0x100000|0x1000,False,entry.pid)
                                if watched:candidates[entry.pid]=(entry.parent,watched)
                                else:unknown=True
                        else:unknown=True
                    finally:kernel.CloseHandle(proc)
                else:unknown=True
            if not kernel.Process32NextW(handle,ctypes.byref(entry)):
                # ERROR_NO_MORE_FILES is the only successful enumeration end.
                if ctypes.get_last_error()!=18:unknown=True
                break
        if unknown:
            for _,watched in candidates.values():kernel.CloseHandle(watched)
            return None
        roots={pid:watched for pid,(parent,watched) in candidates.items() if parent not in candidates}
        for pid,(_,watched) in candidates.items():
            if pid not in roots:kernel.CloseHandle(watched)
        if not roots:return False
        probe.pids=list(roots);probe.handles=list(roots.values())
        return probe.read()
    finally:kernel.CloseHandle(handle)

_desktop_probe=None

def desktop_running():
    """True=bound main process lives; False=exited; None=unknown."""
    global _desktop_probe
    if os.name!='nt':return None
    if _desktop_probe is None:_desktop_probe=DesktopProcessProbe()
    return _desktop_probe.read()

def desktop_root_pids():
    return list(_desktop_probe.pids) if _desktop_probe else []
