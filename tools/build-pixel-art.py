"""Compatibility entry point: prepare the current painted assets, not the retired flat art."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('build-homm2-assets.py')), run_name='__main__')
