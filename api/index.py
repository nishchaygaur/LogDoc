import sys
import os
from urllib.parse import parse_qsl, urlencode, unquote

# Add root directory to sys.path so backend package is discoverable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.types import ASGIApp, Scope, Receive, Send
from backend.app.main import app as fastapi_app


class VercelPathRewriteMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            query_bytes = scope.get("query_string", b"")
            query_str = query_bytes.decode("utf-8", "ignore") if query_bytes else ""
            
            target_path = None
            
            # 1. Extract path parameter passed via Vercel rewrite
            if "__path" in query_str:
                params = parse_qsl(query_str, keep_blank_values=True)
                clean_params = []
                for k, v in params:
                    if k == "__path":
                        target_path = unquote(v).strip()
                    else:
                        clean_params.append((k, v))
                scope["query_string"] = urlencode(clean_params).encode("utf-8")

            # 2. Check header fallbacks if any
            if not target_path:
                headers = dict(scope.get("headers", []))
                for header_name in [b"x-matched-path", b"x-forwarded-uri", b"x-real-path", b"x-original-uri"]:
                    raw_val = headers.get(header_name)
                    if raw_val:
                        p = raw_val.decode("utf-8", "ignore").split("?")[0].strip()
                        if p and p != "/api/index.py":
                            target_path = p
                            break

            # 3. Rewrite scope path
            if target_path:
                if not target_path.startswith("/"):
                    target_path = "/" + target_path
                if not target_path.startswith("/api"):
                    target_path = "/api" + target_path
                # Normalize double slashes
                while "//" in target_path:
                    target_path = target_path.replace("//", "/")
                # Strip trailing slash unless root /api/
                if target_path.endswith("/") and len(target_path) > 5:
                    target_path = target_path.rstrip("/")
                scope["path"] = target_path
                scope["raw_path"] = target_path.encode("utf-8")
            elif scope.get("path") in ("/api/index.py", "/index.py"):
                scope["path"] = "/api"
                scope["raw_path"] = b"/api"

        await self.app(scope, receive, send)

app = VercelPathRewriteMiddleware(fastapi_app)
