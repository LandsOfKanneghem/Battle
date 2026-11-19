"""Export the default JSON map as a classic script usable from file://."""
import json
from pathlib import Path


root = Path(__file__).resolve().parent.parent
source = root / "maps" / "MAP 1.json"
target = source.with_suffix(".js")
data = json.loads(source.read_text(encoding="utf-8"))
target.write_text(
    "// Generated from MAP 1.json by tools/build-default-map.py.\n"
    "// Classic scripts work locally without fetch or an HTTP server.\n"
    "window.DEFAULT_BATTLE_MAP = "
    + json.dumps(data, ensure_ascii=False, indent=2)
    + ";\n",
    encoding="utf-8",
)
print(f"Generated {target.relative_to(root)}")
