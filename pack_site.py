"""Compatibility entry point: builds dist/."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).resolve().parent/"scripts/build.py"),run_name="__main__")
