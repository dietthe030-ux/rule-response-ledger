import atexit
import os
import tempfile
from pathlib import Path


_task_tmp = Path(__file__).parents[1] / ".tmp"
_task_tmp.mkdir(exist_ok=True)
os.environ["TEMP"] = str(_task_tmp)
os.environ["TMP"] = str(_task_tmp)
tempfile.tempdir = str(_task_tmp)

from gltest.direct import sdk_loader


# Shared machine-level runtimes live under the governed tools root on drive E.
tools_root = Path(os.environ.get("GENLAYER_TOOLS_DIR", "E:/Genlayer-Tools"))
sdk_loader.CACHE_DIR = tools_root / "GenVM" / "v0.3.0-rc7"


# genlayer-test 0.29.2 unlinks its fd-0 temp file before Windows releases the
# duplicated handle. Defer deletion until process exit without editing the
# installed dependency.
_unlink = os.unlink
def _unlink_after_stdin_release(path) -> None:
    try:
        _unlink(path)
    except PermissionError:
        resolved = Path(path).resolve()
        if not resolved.is_relative_to(_task_tmp.resolve()):
            raise
        atexit.register(lambda: resolved.unlink(missing_ok=True))


os.unlink = _unlink_after_stdin_release
