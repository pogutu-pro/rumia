import subprocess
import sys

import pytest

MODULES = [
    "app.features.tours.service",
    "app.features.zones.router",
    "app.features.inquiries.service",
    "app.features.listings.service",
    "app.worker",
]


@pytest.mark.parametrize("module", MODULES)
def test_module_imports_on_its_own(module):
    """Each module must import without relying on app.main having been imported first."""
    result = subprocess.run([sys.executable, "-c", f"import {module}"], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr[-800:]
