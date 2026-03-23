import sqlite3
import time

conn = sqlite3.connect(':memory:')
conn.execute("CREATE TABLE test (id TEXT PRIMARY KEY, val INTEGER, updated_at TEXT)")
conn.execute("INSERT INTO test (id, val, updated_at) VALUES ('1', 0, datetime('now'))")

# Wait a second to ensure OLD.updated_at is strictly less than 'now' later
time.sleep(1)

conn.execute("""
CREATE TRIGGER trg_test_updated_at
AFTER UPDATE ON test
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE test SET updated_at = datetime('now') WHERE id = NEW.id;
END;
""")

try:
    conn.execute("UPDATE test SET val = 1 WHERE id = '1'")
    print("Update 1 ok")
    
    # Do it again immediately, so OLD.updated_at is indeed equal to datetime('now') 
    conn.execute("UPDATE test SET val = 2 WHERE id = '1'")
    print("Update 2 ok")
    
    # Try PRAGMA recursive_triggers = ON
    conn.execute("PRAGMA recursive_triggers = ON;")
    conn.execute("UPDATE test SET val = 3 WHERE id = '1'")
    print("Update 3 ok (with recursive_triggers = ON)")
    
except Exception as e:
    print("Error:", e)
