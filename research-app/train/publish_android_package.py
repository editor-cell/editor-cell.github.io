"""Publish the verified phone package and check its anonymous download URL."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'app/src/main/assets/nli_model.json').read_text())
archive = Path(sys.argv[1]) / 'download/android-nli.zip'
assert archive.stat().st_size == manifest['bytes']
with archive.open('rb') as source:
    assert hashlib.file_digest(source, 'sha256').hexdigest() == manifest['sha256']
repo = 'editor-cell/editor-cell.github.io'
tag = 'android-reader-' + manifest['sha256'][:16]
url = f'https://github.com/{repo}/releases/download/{tag}/android-nli.zip'
assert manifest['url'] == url

def gh(*args, check=True):
    return subprocess.run(['gh', *args], check=check, capture_output=True, text=True)

release = gh('release', 'view', tag, '--repo', repo, '--json', 'assets', check=False)
if release.returncode:
    gh('release', 'create', tag, '--repo', repo, '--target', os.environ['GITHUB_SHA'],
       '--title', 'Orbis · son eğitilmiş paragraf modeli', '--latest=false',
       '--notes', f"Uygulama içinden tek düğmeyle indirilir. SHA-256: {manifest['sha256']}")
    assets = []
else:
    assets = json.loads(release.stdout)['assets']
if not any(asset['name'] == 'android-nli.zip' for asset in assets):
    gh('release', 'upload', tag, str(archive), '--repo', repo)

release = json.loads(gh('api', f'repos/{repo}/releases/tags/{tag}').stdout)
asset = next(a for a in release['assets'] if a['name'] == 'android-nli.zip')
assert not release['draft'] and asset['size'] == manifest['bytes']
assert asset['browser_download_url'] == url
if asset.get('digest'):
    assert asset['digest'] == 'sha256:' + manifest['sha256']

# No token or cookies: exercise the same public redirect used by Android.
request = urllib.request.Request(url, headers={'Range': 'bytes=0-1023'})
with urllib.request.urlopen(request, timeout=60) as response:
    assert response.status in (200, 206)
    if response.status == 206:
        assert response.headers['Content-Range'] == f"bytes 0-1023/{manifest['bytes']}"
    else:
        assert int(response.headers['Content-Length']) == manifest['bytes']
    with archive.open('rb') as source:
        assert response.read(1024) == source.read(1024)
print('Verified anonymous GitHub download:', url)
