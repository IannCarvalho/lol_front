"""Pytest configuration for the data_retrival test suite.

Ensures the parent directory (which contains ``setup_database.py``) is on
``sys.path`` so the module can be imported regardless of where pytest is
invoked from.
"""

import os
import sys

# Directory that holds setup_database.py (one level above /tests).
DATA_RETRIVAL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if DATA_RETRIVAL_DIR not in sys.path:
    sys.path.insert(0, DATA_RETRIVAL_DIR)
