import sys
import os

# Add root directory to sys.path so backend package is discoverable by Vercel
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
