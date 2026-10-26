"""Incremental numeric token accounting from local rollouts; no message export."""
import datetime as dt
import hashlib
import json
from pathlib import Path

HK=dt.timezone(dt.timedelta(hours=8))
FIELDS=('input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens','total_tokens')

def counts(value):
    if not isinstance(value,dict):return None
    result={key:value.get(key,0) for key in FIELDS}
    if any(not isinstance(v,int) or isinstance(v,bool) or v<0 for v in result.values()):return None
    if result['total_tokens']!=result['input_tokens']+result['output_tokens']:return None
    return result

class DailyUsageReader:
    def __init__(self,home,now=None):
        self.home=Path(home);self.now=now or (lambda:dt.datetime.now(dt.timezone.utc))
        self.day=None;self.files={};self.seen=set();self.total={key:0 for key in FIELDS};self.events=0;self.partial=False

    def snapshot(self):
        day=self.now().astimezone(HK).date().isoformat()
        if day!=self.day:
            self.day=day;self.files={};self.seen=set();self.total={key:0 for key in FIELDS};self.events=0;self.partial=False
        readable=0
        for root in (self.home/'sessions',self.home/'archived_sessions'):
            try:paths=list(root.rglob('*.jsonl')) if root.is_dir() else []
            except OSError:self.partial=True;continue
            for path in paths:
                try:
                    state=self.files.setdefault(str(path),{'offset':0,'previous':None})
                    if path.stat().st_size<state['offset']:
                        # Rebuild so truncated logs cannot leave over-counted history.
                        self.day=None;return self.snapshot()
                    with path.open('rb') as stream:
                        readable+=1;stream.seek(state['offset'])
                        while True:
                            position=stream.tell();line=stream.readline()
                            if not line or not line.endswith(b'\n'):state['offset']=position;break
                            state['offset']=stream.tell()
                            if b'"token_count"' not in line:continue
                            try:record=json.loads(line)
                            except (ValueError,UnicodeError):self.partial=True;continue
                            self.consume(record,state)
                except OSError:self.partial=True
        health='partial' if self.partial else 'ready' if self.events else 'empty' if readable else 'unavailable'
        return {'kind':'dailyUsage','health':health,'date':day,'timezone':'Asia/Hong_Kong',
                'inputTokens':self.total['input_tokens'],'cachedInputTokens':self.total['cached_input_tokens'],
                'outputTokens':self.total['output_tokens'],'reasoningOutputTokens':self.total['reasoning_output_tokens'],
                'totalTokens':self.total['total_tokens'] if readable else None,
                'recordedEvents':self.events,'scope':'local-rollout-records',
                'updatedAt':int(self.now().timestamp()*1000)}

    def consume(self,record,state):
        payload=record.get('payload') or {}
        if record.get('type')!='event_msg' or not isinstance(payload,dict) or payload.get('type')!='token_count':return
        info=payload.get('info') or {}
        if not isinstance(info,dict):return
        total=counts(info.get('total_token_usage'))
        if total is None:return
        previous=state['previous'];state['previous']=total
        try:
            stamp=dt.datetime.fromisoformat(str(record.get('timestamp','')).replace('Z','+00:00'))
            if stamp.tzinfo is None:return
            if stamp.astimezone(HK).date().isoformat()!=self.day:return
        except ValueError:return
        last=counts(info.get('last_token_usage'))
        key=hashlib.sha256(json.dumps([record.get('timestamp'),total,last],sort_keys=True).encode()).digest()
        if key in self.seen:return
        self.seen.add(key)
        if previous is not None and total['total_tokens']>=previous['total_tokens']:
            delta={k:max(0,total[k]-previous[k]) for k in FIELDS}
        else:
            # Reset/imported history without baseline: count only a known last call.
            delta=last or {k:0 for k in FIELDS}
            if previous is not None or last!=total:self.partial=True
        if delta['total_tokens']:
            self.events+=1
            for k in FIELDS:self.total[k]+=delta[k]
