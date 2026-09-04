"""Re-export the FastAPI OpenAPI contract to backend/openapi.json.

Drift gate: the committed openapi.json is the single contract snapshot. CI runs
`uv run python scripts/export_openapi.py && git diff --exit-code -- openapi.json`
so any route/schema change without a snapshot refresh fails the build.

Run from the backend/ directory:  uv run python scripts/export_openapi.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

spec = app.openapi()
out_path = Path(__file__).resolve().parents[1] / "openapi.json"
out_path.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")