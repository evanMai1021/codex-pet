"""Extract the pinned standalone Python runtime from the previous public release."""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import shutil
import urllib.request
import zipfile

URL = 'https://github.com/evanMai1021/codex-pet/releases/download/v0.1.10/inori-codex-pet-v0.1.10.zip'
SHA256 = 'e0dcbd5657d89d9f81a96ead9ca2129d7a33b303945339f8a035fe393e226a85'
PREFIX = 'inori-codex-pet-v0.1.10/resources/app/runtime/python/'

def prepare(archive, out):
    if out.exists():
        raise FileExistsError('Choose a new runtime directory; existing files are preserved')
    if not archive.exists():
        archive.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(URL, headers={'User-Agent': 'codex-pet-release'})
        with urllib.request.urlopen(request, timeout=120) as response, archive.open('xb') as target:
            shutil.copyfileobj(response, target)
    with archive.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    if digest != SHA256:
        raise ValueError('Pinned runtime archive checksum mismatch')
    with zipfile.ZipFile(archive) as bundle:
        members = [entry for entry in bundle.infolist() if entry.filename.startswith(PREFIX) and not entry.is_dir()]
        if not members:
            raise ValueError('Standalone runtime missing from archive')
        out.mkdir(parents=True)
        for entry in members:
            relative = PurePosixPath(entry.filename[len(PREFIX):])
            if relative.is_absolute() or '..' in relative.parts or any(':' in p or '\\' in p for p in relative.parts):
                raise ValueError('Unsafe runtime archive path')
            target = out.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(entry) as source, target.open('xb') as destination:
                shutil.copyfileobj(source, destination)
    for name in ['python.exe', 'LICENSE.txt']:
        if not (out / name).is_file():
            raise ValueError('Incomplete standalone runtime: ' + name)
    print('Pinned standalone Python runtime extracted and checksum verified')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    options = parser.parse_args()
    prepare(options.archive, options.out)
