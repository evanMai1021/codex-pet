"""Read-only local lifecycle adapter. Never exports conversation bodies or raw tool data."""
from __future__ import annotations
import datetime
import glob
import hashlib
import json
import os
from pathlib import Path
from desktop_lifecycle import desktop_running
import queue
import sqlite3
import subprocess
import sys
import threading
import time

HOME = Path(os.environ.get('CODEX_HOME', str(Path.home()/'.codex')))
STARTED = time.time()
SOURCE_NAMES = ('Codex Desktop', 'codex_work_desktop')
INPUT_TOOLS = {'request_user_input','functions.request_user_input'}
events = queue.Queue()

def emit(value):
    print(json.dumps(value,ensure_ascii=False),flush=True)

def connect(name):
    path=HOME/name
    if not path.is_file(): raise FileNotFoundError(name)
    con=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True,timeout=0.3)
    con.row_factory=sqlite3.Row
    con.execute('PRAGMA query_only=ON')
    return con

class Tail:
    def __init__(self):
        self.offset=0;self.pending={};self.turn=None;self.last=0.0;self.tools=set();self.phase=None
    def update(self,path):
        path=Path(path)
        size=path.stat().st_size
        if size<self.offset: self.__init__()
        with path.open('rb') as stream:
            stream.seek(self.offset)
            # Bound bootstrap work to the most recent 2 MiB, then read incrementally.
            if self.offset==0 and size>2*1024*1024:
                stream.seek(size-2*1024*1024);stream.readline()
            while True:
                position=stream.tell();line=stream.readline()
                if not line or not line.endswith(b'\n'):
                    self.offset=position;break
                self.offset=stream.tell()
                try: record=json.loads(line)
                except (ValueError,UnicodeError):continue
                payload=record.get('payload') or {}
                if not isinstance(payload,dict):continue
                # Windows may keep st_mtime unchanged while the application holds
                # its log open. Use timestamps INSIDE structured records instead.
                try:
                    stamp=datetime.datetime.fromisoformat(str(record.get('timestamp','')).replace('Z','+00:00')).timestamp()
                    if 0<stamp<=time.time()+30:self.last=max(self.last,stamp)
                except (ValueError,OverflowError,OSError):pass
                kind=payload.get('type');record_type=record.get('type')
                if record_type=='event_msg' and kind=='task_started':
                    self.turn=payload.get('turn_id');self.pending.clear();self.tools.clear();self.phase='正在思考'
                elif record_type=='event_msg' and kind in ('task_complete','turn_aborted'):
                    self.pending.clear();self.tools.clear();self.phase=None
                elif (record_type=='event_msg' and kind=='agent_reasoning') or (record_type=='response_item' and kind=='reasoning'):
                    self.phase='正在使用工具' if self.tools else '正在思考'
                elif record_type=='event_msg' and kind=='agent_message':
                    self.phase='正在使用工具' if self.tools else '正在回复'
                elif record_type=='response_item' and kind in ('function_call','custom_tool_call'):
                    self.tools.add(str(payload.get('call_id') or payload.get('id')));self.phase='正在使用工具'
                    if payload.get('name') in INPUT_TOOLS:
                        self.pending[str(payload.get('call_id') or payload.get('id'))]='input'
                elif record_type=='response_item' and kind in ('function_call_output','custom_tool_call_output'):
                    self.pending.pop(str(payload.get('call_id')),None);self.tools.discard(str(payload.get('call_id')));self.phase='正在使用工具' if self.tools else '正在整理结果'
        return bool(self.pending)

class StatusReader:
    def __init__(self):self.tails={}
    def snapshot(self):
        now=time.time()
        try:
            with connect('state_5.sqlite') as con:
                rows=con.execute("SELECT id,rollout_path,originator,title,name FROM threads WHERE archived=0 AND thread_source IN ('user','agent_created_thread') AND originator IN (?,?) ORDER BY updated_at_ms DESC LIMIT 64",SOURCE_NAMES).fetchall()
            with connect('thread_history_1.sqlite') as con:
                result=[]
                for meta in rows:
                    turn=con.execute('SELECT turn_id,status,started_at,completed_at,error_json IS NOT NULL AS has_error FROM thread_turns WHERE thread_id=? ORDER BY started_at DESC LIMIT 1',(meta['id'],)).fetchone()
                    if not turn:continue
                    status=turn['status'];completed=float(turn['completed_at'] or 0)
                    if status!='inProgress' and completed<STARTED:continue
                    path=meta['rollout_path']; pending=False;stamp=0
                    if path:
                        try:pending=self.tails.setdefault(meta['id'],Tail()).update(path);stamp=self.tails[meta['id']].last
                        except (OSError,ValueError):pass
                    state='unknown';label='状态未更新'
                    if status=='inProgress':
                        if pending:state='waiting';label='等待你回答'
                        elif max(stamp,float(turn['started_at'] or 0)) and 0<=now-max(stamp,float(turn['started_at'] or 0))<=180:state='working';label='工作中'
                    elif status=='completed':
                        if now-completed<=5:state='completed';label='本轮已结束'
                        else:state='idle';label='待机'
                    elif status=='failed':state='error';label='本轮失败'
                    elif status in ('interrupted','cancelled','canceled'):state='interrupted';label='本轮已中断'
                    title=' '.join(str(meta['name'] or meta['title'] or '未命名聊天').split())[:160]
                    phase=self.tails[meta['id']].phase if state=='working' and meta['id'] in self.tails else None
                    result.append({'title':title,'phase':phase,'threadId':meta['id'],'turnId':turn['turn_id'],'state':state,'label':label,'terminalAt':int(completed*1000) if status!='inProgress' and completed>0 else None,'updatedAt':int(max(stamp,completed,float(turn['started_at'] or 0))*1000)})
            return {'kind':'status','healthy':True,'threads':result,'capabilities':{'taskLifecycle':True,'inputTool':True,'approval':False},'updatedAt':int(now*1000)}
        except (OSError,sqlite3.Error,ValueError):
            return {'kind':'status','healthy':False,'threads':[],'reason':'本地状态源不可读','updatedAt':int(now*1000)}

def discover_codex():
    configured=os.environ.get('INORI_CODEX_EXE')
    if configured and Path(configured).is_file():return configured
    root=Path(os.environ.get('LOCALAPPDATA',''))/'OpenAI'/'Codex'/'bin'
    found=sorted(root.glob('*/codex.exe'),key=lambda p:p.stat().st_mtime,reverse=True)
    return str(found[0]) if found else None

class QuotaClient:
    """Allowlisted official RPC only; never reads auth.json or exports identity tokens."""
    METHODS={'initialize','account/read','account/rateLimits/read'}
    def __init__(self):self.proc=None;self.messages=queue.Queue();self.counter=0;self.last_hint_signature=None
    def start(self):
        exe=discover_codex()
        if not exe:raise RuntimeError('official-component-unavailable')
        self.proc=subprocess.Popen([exe,'app-server','--stdio'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,encoding='utf-8',creationflags=0x08000000 if os.name=='nt' else 0)
        def read():
            for line in self.proc.stdout:
                try:value=json.loads(line)
                except ValueError:continue
                if value.get('method')=='account/rateLimits/updated':
                    signature=json.dumps(safe_limits(value.get('params') or {}),sort_keys=True)
                    if signature!=self.last_hint_signature:
                        self.last_hint_signature=signature
                        events.put({'kind':'quota-refresh'})
                if isinstance(value.get('result'),dict) and ('rateLimits' in value['result'] or 'rateLimitsByLimitId' in value['result']):
                    self.last_hint_signature=json.dumps(safe_limits(value['result']),sort_keys=True)
                # Drop all other notifications/requests. This process owns no chats.
                if 'id' in value and ('result' in value or 'error' in value):self.messages.put(value)
        threading.Thread(target=read,daemon=True).start()
        self.request('initialize',{'clientInfo':{'name':'inori_quota_reader','title':'Inori quota','version':'0.1.0'},'capabilities':{'experimentalApi':False}})
        self.send({'method':'initialized'})
    def send(self,value):
        if not self.proc or self.proc.poll() is not None:raise RuntimeError('official-component-exited')
        self.proc.stdin.write(json.dumps(value)+'\n');self.proc.stdin.flush()
    def request(self,method,params=None):
        if method not in self.METHODS:raise ValueError('RPC not allowed')
        self.counter+=1;number=self.counter;value={'id':number,'method':method}
        if params is not None:value['params']=params
        self.send(value);end=time.monotonic()+20
        while time.monotonic()<end:
            if self.proc.poll() is not None:raise RuntimeError('official-component-exited')
            try:message=self.messages.get(timeout=.2)
            except queue.Empty:continue
            if message.get('id')==number:
                if 'error' in message:raise RuntimeError('official-query-failed')
                return message.get('result') or {}
        raise RuntimeError('official-query-timeout')
    def query(self):
        if not self.proc or self.proc.poll() is not None:self.start()
        account=self.request('account/read',{'refreshToken':False}).get('account') or {}
        if account.get('type')!='chatgpt':raise RuntimeError('chatgpt-account-required')
        email=account.get('email') or ''
        if not email:raise RuntimeError('account-identity-unavailable')
        fingerprint=hashlib.sha256(('inori-account-v1:'+email.lower()).encode()).hexdigest()
        local,_,domain=email.partition('@');masked=(local[:1]+'***@'+domain) if domain else '已登录账户'
        raw=self.request('account/rateLimits/read')
        safe=safe_limits(raw)
        return {'kind':'quota','healthy':True,'rateLimitsByLimitId':safe,'fingerprint':fingerprint,'accountLabel':masked,'updatedAt':int(time.time()*1000)}
    def close(self):
        if self.proc and self.proc.poll() is None:
            try:self.proc.stdin.close();self.proc.wait(timeout=3)
            except (OSError,subprocess.TimeoutExpired):self.proc.terminate()

def safe_limits(raw):
    buckets=raw.get('rateLimitsByLimitId') or {'codex':raw.get('rateLimits')}
    safe={}
    for key,bucket in buckets.items():
        if not isinstance(bucket,dict):continue
        safe[key]={}
        for name in ('primary','secondary'):
            window=bucket.get(name)
            if isinstance(window,dict):safe[key][name]={k:window.get(k) for k in ('usedPercent','windowDurationMins','resetsAt')}
    return safe

def main():
    reader=StatusReader();quota=QuotaClient();closing=threading.Event();refresh=threading.Event();refresh.set()
    def input_loop():
        for line in sys.stdin:
            try:command=json.loads(line)
            except ValueError:continue
            if command.get('command')=='refreshQuota':refresh.set()
            if command.get('command')=='quit':break
        closing.set()
    def quota_loop():
        while not closing.is_set():
            if refresh.wait(timeout=.5):
                refresh.clear()
                try:events.put(quota.query())
                except (OSError,ValueError,RuntimeError):
                    quota.close();quota.proc=None
                    events.put({'kind':'quota','healthy':False,'reason':'官方额度查询不可用','updatedAt':int(time.time()*1000)})
        quota.close()
    def desktop_loop():
        while not closing.is_set():
            try:running=desktop_running()
            except (OSError,ValueError):running=None
            events.put({'kind':'desktopLifecycle','running':running})
            closing.wait(2)
    threading.Thread(target=input_loop,daemon=True).start();threading.Thread(target=quota_loop,daemon=True).start()
    threading.Thread(target=desktop_loop,daemon=True).start()
    next_quota=time.monotonic()+120;next_status=0
    try:
        while not closing.wait(.1):
            now=time.monotonic()
            if now>=next_status:emit(reader.snapshot());next_status=now+.25
            if now>=next_quota:refresh.set();next_quota=now+120
            while not events.empty():
                value=events.get_nowait()
                if value.get('kind')=='quota-refresh':refresh.set()
                else:emit(value)
    finally:
        closing.set();quota.close()

if __name__=='__main__':main()
