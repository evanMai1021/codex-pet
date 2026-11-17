"""Verify every runtime source file, including renderer files, in a portable build."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

TEXT = {'.cjs', '.js', '.css', '.html', '.json', '.py', '.md', '.txt'}


def digest(data, name):
    # Git archives use LF while Windows work copies may use CRLF.
    if Path(name).suffix.lower() in TEXT:
        data = data.replace(b'\r\r\n', b'\n').replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()


def runtime_files(source):
    return sorted(p for p in (source / 'src').rglob('*')
                  if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')


def verify(source, portable, reference=None, program_zip=None, plugin_zip=None):
    app = portable / 'resources/app'
    results = []

    def record(name, passed):
        results.append({'file': name, 'pass': passed})

    expected = runtime_files(source) + [source / 'release-revision.json']
    for file in expected:
        rel = file.relative_to(source)
        value = digest(file.read_bytes(), rel)
        target = app / rel
        record('portable/' + rel.as_posix(), target.is_file() and digest(target.read_bytes(), rel) == value)
        if reference:
            other = reference / rel
            record('reference/' + rel.as_posix(), other.is_file() and digest(other.read_bytes(), rel) == value)

    revision = json.loads((source / 'release-revision.json').read_text(encoding='utf-8'))
    plugin_revision = json.loads((source / 'plugins/codex-pet/release-revision.json').read_text(encoding='utf-8'))
    package = json.loads((app / 'package.json').read_text(encoding='utf-8'))
    record('program-plugin-revision', revision == plugin_revision)
    record('package-version', package['version'] == revision['version'])

    if program_zip:
        with zipfile.ZipFile(program_zip) as archive:
            record('program-zip-crc', archive.testzip() is None)
            names = set(archive.namelist())
            for file in expected:
                rel = file.relative_to(source)
                name = portable.name + '/resources/app/' + rel.as_posix()
                record('program-zip/' + rel.as_posix(), name in names and digest(archive.read(name), rel) == digest(file.read_bytes(), rel))

    if plugin_zip:
        with zipfile.ZipFile(plugin_zip) as archive:
            record('plugin-zip-crc', archive.testzip() is None)
            names = set(archive.namelist())
            plugin = source / 'plugins/codex-pet'
            for file in sorted(plugin.rglob('*')):
                if not file.is_file() or '__pycache__' in file.parts or file.suffix == '.pyc':
                    continue
                rel = file.relative_to(plugin)
                candidates = ['plugins/codex-pet/' + rel.as_posix(), 'codex-pet/' + rel.as_posix()]
                matches = [name for name in candidates if name in names]
                record('plugin-zip/' + rel.as_posix(), len(matches) == 1 and digest(archive.read(matches[0]), rel) == digest(file.read_bytes(), rel))

    return {'passed': all(r['pass'] for r in results), 'checks': len(results),
            'revision': revision, 'failures': [r for r in results if not r['pass']]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--portable', type=Path, required=True)
    parser.add_argument('--reference-source', type=Path)
    parser.add_argument('--program-zip', type=Path)
    parser.add_argument('--plugin-zip', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = verify(args.source, args.portable, args.reference_source, args.program_zip, args.plugin_zip)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.report:
        args.report.write_text(text + '\n', encoding='utf-8')
    print(text)
    raise SystemExit(0 if result['passed'] else 1)
