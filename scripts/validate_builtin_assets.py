from pathlib import Path
import json
from validate_assets import check
root=Path(__file__).resolve().parents[1]
result={}
for skin in ['redwhite','battle']:
    manifest,images=check(root/'src/inori/assets'/skin)
    result[skin]={'passed':True,'images':len(images)}
print(json.dumps(result))
