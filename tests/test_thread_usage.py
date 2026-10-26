import importlib.util, os, sqlite3, unittest, uuid
from pathlib import Path
spec=importlib.util.spec_from_file_location('thread_usage',Path(__file__).resolve().parents[1]/'src/inori/thread_usage.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ThreadUsageTests(unittest.TestCase):
    def setUp(self):
        self.home=Path(os.environ['INORI_USAGE_TEST_DIR'])/str(uuid.uuid4());self.home.mkdir(parents=True)
        self.db=self.home/'state_5.sqlite';self.reader=m.ThreadUsageReader(self.home)
    def seed(self):
        with sqlite3.connect(self.db) as c:
            c.execute('create table threads(id text,name text,title text,tokens_used integer,updated_at_ms integer,archived integer,thread_source text,originator text)')
            c.executemany('insert into threads values(?,?,?,?,?,?,?,?)',[
                ('a','','聊天 A',12345678,10,0,'user','Codex Desktop'),
                ('b','聊天 B','旧名',87654321,20,0,'user','codex_work_desktop'),
                ('c','','归档',999,30,1,'user','Codex Desktop'),
                ('d','','其他来源',999,40,0,'user','unknown'),
                ('e','','未知',None,5,0,'user','Codex Desktop')])
    def test_conversations_are_not_combined_and_titles_are_metadata_only(self):
        self.seed();v=self.reader.snapshot();self.assertEqual(v['health'],'ready')
        self.assertEqual([t['threadId'] for t in v['threads']],['b','a','e'])
        self.assertEqual(v['threads'][0]['title'],'聊天 B');self.assertEqual(v['threads'][1]['totalTokens'],12345678)
        self.assertEqual(set(v['threads'][0]),{'threadId','title','totalTokens','health','updatedAt'})
    def test_updates_are_read_only_and_unknown_is_not_zero(self):
        self.seed();self.assertIsNone(self.reader.snapshot()['threads'][-1]['totalTokens'])
        with sqlite3.connect(self.db) as c:c.execute('update threads set tokens_used=120 where id="a"')
        self.assertEqual(next(t for t in self.reader.snapshot()['threads'] if t['threadId']=='a')['totalTokens'],120)
    def test_missing_database_is_unavailable_without_creating_one(self):
        self.assertEqual(self.reader.snapshot()['health'],'unavailable');self.assertFalse(self.db.exists())

if __name__=='__main__':unittest.main()
