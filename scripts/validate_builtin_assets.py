from pathlib import Path
import json
from validate_assets import check
root=Path(__file__).resolve().parents[1]
result={}
for skin in ['redwhite','battle']:
    manifest,images=check(root/'src/inori/assets'/skin)
    folder=root/'src/inori/assets'/skin
    js=(folder/'manifest.js').read_text(encoding='utf-8-sig')
    assert json.loads(js.split('=',1)[1].strip().rstrip(';'))==manifest, 'Manifest JSON and JS differ: '+skin
    videos=manifest.get('videos',{})
    for name,video in videos.items():
        file=folder/video['file']
        assert file.resolve().is_relative_to(folder.resolve()) and not file.is_symlink(), 'Video escaped asset folder'
        assert file.suffix=='.webm' and file.is_file(), 'Missing WebM: '+name
        with file.open('rb') as stream:assert stream.read(4)==bytes.fromhex('1a45dfa3'), 'Invalid WebM: '+name
        assert isinstance(video['loop'],bool) and video['frameMs']>0, 'Invalid video timing: '+name
    result[skin]={'passed':True,'images':len(images),'videos':len(videos)}
print(json.dumps(result))
