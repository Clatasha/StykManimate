"""Download the two supported model pairs before packaging (not during use)."""
from pathlib import Path
import shutil
from rtmlib import Body
from rtmlib.tools.file import download_checkpoint

root = Path(__file__).resolve().parents[1] / 'build' / 'motion-models'
root.mkdir(parents=True, exist_ok=True)
for mode in ('lightweight', 'balanced'):
    for kind in ('det', 'pose'):
        source = download_checkpoint(Body.MODE[mode][kind])
        target = root / f'{mode}-{kind}.onnx'
        shutil.copyfile(source, target)
        print(f'Staged {target.name}: {target.stat().st_size} bytes')
