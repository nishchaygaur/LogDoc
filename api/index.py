import sys
import os

# Add root directory to sys.path so backend package is discoverable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.types import ASGIApp, Scope, Receive, Send
from backend.app.main import app as fastapi_app

class VercelPathRewriteMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            decoded = {k.decode('utf-8', 'ignore'): v.decode('utf-8', 'ignore') for k, v in headers.items()}
            print("Vercel Request Headers:", decoded)
            # Vercel provides the original requested URL path in these headers:
            for header_name in [b"x-matched-path", b"x-forwarded-uri", b"x-real-path", b"x-original-uri", b"x-vercel-matched-path"]:
                raw_val = headers.get(header_name)
                if raw_val:
                    path_str = raw_val.decode("utf-8")
                    if "?" in path_str:
                        path_str = path_str.split("?")[0]
                    if path_str and path_str != "/api/index.py":
                        print("Setting scope path to:", path_str)
                        scope["path"] = path_str
                        break

        await self.app(scope, receive, send)

app = VercelPathRewriteMiddleware(fastapi_app)
