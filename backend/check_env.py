from dotenv import load_dotenv
import os

load_dotenv()
url = os.getenv('DATABASE_URL', 'NOT FOUND')
print("DATABASE_URL:", url)
print()

if 'channel_binding' in url:
    print("❌ channel_binding found - this is the problem!")
    url_fixed = url.replace('&channel_binding=require', '')
    print("Fixed URL:", url_fixed)
else:
    print("✅ URL looks clean")
