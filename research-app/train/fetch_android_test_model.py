"""Verify the APK's pinned PRIVATE package before native runtime checks. No model fallback."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path
from huggingface_hub import HfApi, hf_hub_download

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'app/src/main/assets/nli_model.json').read_text())
latest = json.loads((root / 'train/latest_model.json').read_text())
assert manifest['source_repo'] == latest['repo'], 'APK model is not the latest trained checkpoint'
api = HfApi()
assert api.model_info(manifest['package_repo']).private, 'Private weights must remain private'
work = Path(sys.argv[1])
work.mkdir(parents=True, exist_ok=True)
archive = Path(hf_hub_download(manifest['package_repo'], 'android-nli.zip',
    revision=manifest['package_revision'], local_dir=work / 'download'))
def check(path, meta):
    assert path.stat().st_size == meta['bytes'], f'Wrong size: {path.name}'
    h = hashlib.sha256()
    with path.open('rb') as f:
        for data in iter(lambda: f.read(1024*1024), b''):
            h.update(data)
    assert h.hexdigest() == meta['sha256'], f'Wrong hash: {path.name}'
check(archive, manifest)
output = work / 'model'
output.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist()) == set(manifest['files']) == {'model.onnx','tokenizer.json','encoding.json'}
    for name, metadata in manifest['files'].items():
        z.extract(name, output)
        check(output / name, metadata)
print('Verified private package for', manifest['source_repo'], manifest['source_revision'])
