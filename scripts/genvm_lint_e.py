"""Run the installed GenVM linter with its governed runtime on drive E."""

import os
from pathlib import Path

from genvm_linter import stubs
from genvm_linter.validate import artifacts


TOOLS_ROOT = Path(os.environ.get("GENLAYER_TOOLS_DIR", "E:/Genlayer-Tools"))
CACHE_DIR = TOOLS_ROOT / "GenVM" / "v0.3.0-rc7"

artifacts.CACHE_DIR = CACHE_DIR
stubs.CACHE_DIR = CACHE_DIR / "stubs"

from genvm_linter.cli import cli  # noqa: E402


if __name__ == "__main__":
    cli()
