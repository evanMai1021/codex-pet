"""Bounded, read-only desktop/pet exit timing observer; no accounts or chats."""
import argparse, ctypes, json, sys, time
from ctypes import wintypes
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'src/inori'))
from desktop_lifecycle import desktop_running

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pid',type=int,required=True)
    parser.add_argument('--exe',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--seconds',type=int,default=600)
    args=parser.parse_args()
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];kernel.OpenProcess.restype=wintypes.HANDLE
    kernel.CloseHandle.argtypes=[wintypes.HANDLE]
    kernel.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD];kernel.WaitForSingleObject.restype=wintypes.DWORD
    kernel.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)]
    handle=kernel.OpenProcess(0x100000|0x1000,False,args.pid)
    if not handle:raise OSError('Cannot observe chosen pet process')
    try:
        buf=ctypes.create_unicode_buffer(32768);size=wintypes.DWORD(len(buf))
        if not kernel.QueryFullProcessImageNameW(handle,0,buf,ctypes.byref(size)) or Path(buf.value).resolve()!=args.exe.resolve():raise ValueError('Pet executable does not match')
        report={'mode':'actual desktop process presence and fixed pet process handle', 'pid':args.pid,'state':'observing','events':[], 'visualHideMeasured':False}
        args.out.parent.mkdir(parents=True,exist_ok=True)
        def save():args.out.write_text(json.dumps(report,indent=2),encoding='utf-8')
        save();start=time.monotonic();previous='initial';missing_at=None;seen=False
        while time.monotonic()-start<args.seconds:
            elapsed=time.monotonic()-start;desktop=desktop_running();ended=kernel.WaitForSingleObject(handle,0)==0
            if desktop is True:seen=True;missing_at=None
            elif desktop is False and seen and missing_at is None:missing_at=elapsed
            elif desktop is None:missing_at=None
            state=(desktop,ended)
            if state!=previous:
                report['events'].append({'elapsedSeconds':round(elapsed,3),'desktopRunning':desktop,'petExited':ended});previous=state;save()
            if ended:
                report['state']='exit-observed' if missing_at is not None else 'pet-exited-before-confirmed-desktop-exit'
                report['processExitAfterDesktopAbsenceMs']=round((elapsed-missing_at)*1000,1) if missing_at is not None else None
                save();return
            time.sleep(.1)
        report['state']='timeout-no-complete-exit-observed';save()
    finally:kernel.CloseHandle(handle)

if __name__=='__main__':main()
