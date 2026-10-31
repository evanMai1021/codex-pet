"""Package the self-contained creator skill without changing installed plugins."""
from pathlib import Path
import argparse, hashlib, zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parents[1] / 'plugins/codex-pet/skills/create-codex-pet'
    if not (source / 'SKILL.md').is_file():
        parser.error('Creator SKILL.md is missing')
    archive = args.out / 'create-codex-pet-skill.zip'
    checksum = args.out / 'create-codex-pet-skill.SHA256.txt'
    if archive.exists() or checksum.exists():
        parser.error('Choose a new output directory; existing packages are preserved')
    files = []
    for file in sorted(source.rglob('*')):
        if '__pycache__' in file.parts or file.suffix == '.pyc':
            continue
        if file.is_symlink():
            parser.error('Symlink not supported: ' + str(file.relative_to(source)))
        if file.is_file():
            if file.name == '.env' or file.name.startswith('.env.'):
                parser.error('Local environment files must not enter the skill package')
            files.append(file)
    args.out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as target:
        for file in files:
            name = 'create-codex-pet/' + file.relative_to(source).as_posix()
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            target.writestr(info, file.read_bytes())
    with zipfile.ZipFile(archive) as target:
        if target.testzip() is not None:
            raise ValueError('Skill ZIP integrity check failed')
    digest = hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest()
    checksum.write_text(digest + '  ' + archive.name + '\n', encoding='ascii')
    print(f'Creator skill packaged: {len(files)} files; SHA256 {digest}')


if __name__ == '__main__':
    main()
