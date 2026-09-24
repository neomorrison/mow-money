"""Build every world model (houses, big buildings, nature, props) into public/models/<key>.glb.

Idempotent: each model is rebuilt from a fresh empty scene, so running it twice gives identical files.

Build all:        blender --background --factory-startup --python art/blender/world/build.py
Build some:       blender --background --factory-startup --python art/blender/world/build.py -- house_ prop_gnome
Verify:           blender --background --factory-startup --python art/blender/world/verify.py
Preview tiles:    blender --background --factory-startup --python art/blender/world/sheet.py -- house_ [--back]
Contact sheet:    python art/blender/world/compose_sheet.py out/world_sheet_houses.png house_ --cols 3

Per-category scripts (houses.py, buildings.py, nature.py, props.py) can also be run on their own.
Stats (tris, size, bytes) accumulate in out/world_stats.json.
"""
import os
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402
import houses  # noqa: E402
import buildings  # noqa: E402
import nature  # noqa: E402
import props  # noqa: E402

MODELS = {}
for mod in (houses, buildings, nature, props):
    MODELS.update(mod.MODELS)

if __name__ == "__main__":
    lib.run(MODELS)
    print("BUILD DONE %d models" % len(MODELS))
