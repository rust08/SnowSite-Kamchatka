"""Compatibility launcher for older operator commands."""
from pathlib import Path
from runpy import run_path

if __name__ == '__main__':
    run_path(str(Path(__file__).resolve().parent.parent / 'workers' / 'milp-python' / 'worker.py'), run_name='__main__')
