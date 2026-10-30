"""Snapshot the reviewed working tree and create source/plugin downloads, without committing."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess
import zipfile


def sha(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def prepare(project, output):
    project, output = project.resolve(), output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    stage = output / 'source-tree'
    if stage.exists():
        raise FileExistsError('Source staging already exists; use a new output directory')
    names = subprocess.check_output(['git', '-C', str(project), 'ls-files', '-z', '--cached', '--others', '--exclude-standard']).decode('utf-8').split('\0')
    names = sorted(set(n for n in names if n))
    roots = {'.agents', '.github', 'docs', 'plugins', 'scripts', 'src', 'tests'}
    root_files = {'.gitattributes', '.gitignore', 'ASSETS.md', 'CHANGELOG.md', 'LICENSE', 'README.md', 'THIRD-PARTY.md', 'package.json', 'package-lock.json', 'release-revision.json'}
    forbidden = {'run-data', 'node_modules', '__pycache__', '.git', 'before', 'runtime', 'cache'}
    for name in names:
        relative = Path(name)
        if (relative.parts[0] not in roots and name not in root_files) or forbidden.intersection(relative.parts) or relative.name.startswith('.env') or relative.suffix.lower() in {'.zip', '.log', '.pyc', '.db', '.sqlite'}:
            raise ValueError('Unreviewed or private source path: ' + name)
        file = project / relative
        if file.is_symlink() or not file.resolve().is_relative_to(project) or not file.is_file():
            raise ValueError('Invalid source file: ' + name)
    inventory = {name: sha(project / name) for name in names}
    for name in names:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(project / name, target)
        if sha(target) != inventory[name]:
            raise ValueError('Source changed during snapshot: ' + name)
    version = json.loads((stage / 'package.json').read_text(encoding='utf-8'))['version']
    for archive, selected, prefix in [
        (output / f'codex-pet-source-v{version}.zip', names, f'codex-pet-{version}/'),
        (output / f'codex-pet-plugin-v{version}.zip', [n for n in names if n == '.agents/plugins/marketplace.json' or n.startswith('plugins/codex-pet/')], ''),
    ]:
        with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=5) as bundle:
            for name in selected:
                bundle.write(stage / name, prefix + name)
        with zipfile.ZipFile(archive) as bundle:
            if bundle.testzip():
                raise ValueError('Archive CRC failed')
    (output / 'source-inventory.json').write_text(json.dumps({'baseCommit': subprocess.check_output(['git', '-C', str(project), 'rev-parse', 'HEAD']).decode().strip(), 'uncommittedSnapshot': True, 'files': inventory}, indent=2), encoding='utf-8')
    print(json.dumps({'version': version, 'files': len(names), 'sourceTree': str(stage)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--out-dir', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.project, args.out_dir)
