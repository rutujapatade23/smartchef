from dotenv import load_dotenv
import os, psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()
url = os.getenv('DATABASE_URL')

# Remove channel_binding parameter (not supported by psycopg2)
url = url.replace('&channel_binding=require', '')

print("Connecting to Neon...")
conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
cur = conn.cursor()

# Insert test user
cur.execute("""
    INSERT INTO users (name, email, password, height, weight, goal) 
    VALUES ('Test User', 'test@test.com', 'hashed123', 165, 60, 'maintenance')
    ON CONFLICT (email) DO NOTHING
""")
conn.commit()

# Check users
cur.execute('SELECT id, name, email, height, weight, goal FROM users')
rows = cur.fetchall()
print(f'Users in Neon: {len(rows)}')
for r in rows:
    print(dict(r))

cur.close()
conn.close()
print("Done!")
