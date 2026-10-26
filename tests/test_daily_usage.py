import datetime as dt,importlib.util,json,os,unittest,uuid
from pathlib import Path
spec=importlib.util.spec_from_file_location('daily_usage',Path(__file__).resolve().parents[1]/'src/inori/daily_usage.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def event(stamp,input,output,cached=0,last=None):
    total={'input_tokens':input,'output_tokens':output,'cached_input_tokens':cached,'reasoning_output_tokens':output//2,'total_tokens':input+output}
    return {'timestamp':stamp,'type':'event_msg','payload':{'type':'token_count','info':{'total_token_usage':total,'last_token_usage':last or total}}}
class UsageTests(unittest.TestCase):
    def setUp(self):
        self.home=Path(os.environ['INORI_USAGE_TEST_DIR'])/str(uuid.uuid4());(self.home/'sessions').mkdir(parents=True);self.file=self.home/'sessions/a.jsonl';self.now=dt.datetime(2026,10,23,10,tzinfo=dt.timezone.utc);self.reader=m.DailyUsageReader(self.home,lambda:self.now)
    def write(self,events,path=None):
        with (path or self.file).open('a',encoding='utf-8') as f:
            for e in events:f.write(json.dumps(e)+'\n')
    def test_midnight_baseline_and_subcategories_not_added_twice(self):
        self.write([event('2026-10-22T15:59:00Z',100,10,80),event('2026-10-22T16:01:00Z',300,30,160)])
        v=self.reader.snapshot();self.assertEqual(v['totalTokens'],220);self.assertEqual(v['cachedInputTokens'],80);self.assertEqual(v['outputTokens'],20)
    def test_repeated_snapshots_incremental_reads_and_fork_copies(self):
        e=event('2026-10-23T01:00:00Z',100,10,50);self.write([e,e]);self.assertEqual(self.reader.snapshot()['totalTokens'],110)
        self.write([e],self.home/'sessions/fork.jsonl');self.assertEqual(self.reader.snapshot()['totalTokens'],110)
        self.write([event('2026-10-23T02:00:00Z',200,30,100)]);self.assertEqual(self.reader.snapshot()['totalTokens'],230)
    def test_partial_append_and_day_change(self):
        e=event('2026-10-23T01:00:00Z',100,10);raw=json.dumps(e)
        self.file.write_text(raw,encoding='utf-8');self.assertEqual(self.reader.snapshot()['totalTokens'],0)
        with self.file.open('a') as f:f.write('\n')
        self.assertEqual(self.reader.snapshot()['totalTokens'],110);self.now+=dt.timedelta(days=1);self.assertEqual(self.reader.snapshot()['totalTokens'],0)
    def test_counter_reset_uses_last_call_and_marks_partial(self):
        self.write([event('2026-10-23T01:00:00Z',100,10),event('2026-10-23T02:00:00Z',50,5)])
        v=self.reader.snapshot();self.assertEqual(v['totalTokens'],165);self.assertEqual(v['health'],'partial')
    def test_no_logs_is_unknown_and_no_content_is_exported(self):
        v=self.reader.snapshot();self.assertIsNone(v['totalTokens']);self.assertNotIn('title',v);self.assertNotIn('messages',v)
if __name__=='__main__':unittest.main()
