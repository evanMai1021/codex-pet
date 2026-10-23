"""Read desktop process presence only; no windows, chats, accounts or startup tasks."""
import ctypes
import os
from ctypes import wintypes

def is_desktop_path(path):
    p=path.replace('/', '\\').lower()
    return p.rsplit('\\',1)[-1] in ('chatgpt.exe','codex.exe') and (
        ('\\windowsapps\\openai.codex_' in p and '\\app\\' in p)
        or '\\openai\\codex\\app\\' in p)

def desktop_running():
    """True=desktop exists, False=confirmed absent, None=unknown/unsupported."""
    if os.name!='nt':return None
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
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
    unknown=False
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
                            if is_desktop_path(buf.value):return True
                        else:unknown=True
                    finally:kernel.CloseHandle(proc)
                else:unknown=True
            if not kernel.Process32NextW(handle,ctypes.byref(entry)):
                # ERROR_NO_MORE_FILES is the only successful enumeration end.
                if ctypes.get_last_error()!=18:unknown=True
                break
        return None if unknown else False
    finally:kernel.CloseHandle(handle)
