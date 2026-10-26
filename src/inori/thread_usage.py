"""Read only conversation metadata and numeric cumulative counters."""
import sqlite3
import time
from pathlib import Path


class ThreadUsageReader:
    def __init__(self, home):
        self.home = Path(home)

    def snapshot(self):
        path = self.home / 'state_5.sqlite'
        try:
            with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=.3) as con:
                con.execute('PRAGMA query_only=ON')
                rows = con.execute("""SELECT id,name,title,tokens_used,updated_at_ms FROM threads
                    WHERE archived=0 AND thread_source IN ('user','agent_created_thread')
                    AND originator IN ('Codex Desktop','codex_work_desktop')
                    ORDER BY updated_at_ms DESC LIMIT 100""").fetchall()
            threads = []
            for identifier, name, title, tokens, updated in rows:
                valid = isinstance(tokens, int) and tokens >= 0
                threads.append({'threadId': identifier,
                                'title': ' '.join(str(name or title or '未命名聊天').split())[:160],
                                'totalTokens': tokens if valid else None,
                                'updatedAt': updated, 'health': 'ready' if valid else 'unavailable'})
            return {'kind': 'threadUsage', 'health': 'ready', 'threads': threads,
                    'updatedAt': int(time.time() * 1000)}
        except (OSError, sqlite3.Error, ValueError):
            return {'kind': 'threadUsage', 'health': 'unavailable', 'threads': [],
                    'updatedAt': int(time.time() * 1000)}
