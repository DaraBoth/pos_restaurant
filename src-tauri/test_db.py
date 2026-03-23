import sqlite3
conn = sqlite3.connect('local.db')
cursor = conn.cursor()
cursor.execute("SELECT id, name FROM floor_tables")
for row in cursor.fetchall():
    print(row)
