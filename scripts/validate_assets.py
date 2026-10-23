"""Check the current desktop renderer's asset format; optionally export a new pack.
Only Python's standard library is used. This does not evaluate artwork quality.
"""
from pathlib import Path
import argparse,json,math,shutil,struct
REQUIRED={'wave':16,'blink':8,'peace':16,'working':8,'waiting':8,'completed':48,'error':12,'interrupted':8,'unknown':8,'stretch':12,'sleep':12}
def check(folder):
    folder=Path(folder).resolve()
    m=json.loads((folder/'manifest.json').read_text(encoding='utf-8-sig'))
    assert m.get('version')==1, 'manifest version must be 1'
    clips=m['clips'];images={k:v['image'] for k,v in clips.items()}
    images.update(m.get('additionalImages',{}));dock=m['dock'];dock_images=dock.get('images') or {'dock':dock['image']}
    images.update(dock_images);sizes={}
    for filename in set(images.values()):
        assert isinstance(filename,str) and Path(filename).name==filename and filename.lower().endswith('.png'), 'Images must be flat PNG filenames'
        p=folder/filename
        assert p.resolve().parent==folder and not p.is_symlink(), 'Image must stay in the asset folder'
        with p.open('rb') as f:head=f.read(33)
        assert len(head)==33 and head[:8]==bytes([137,80,78,71,13,10,26,10]) and head[12:16]==b'IHDR', 'Invalid PNG: '+filename
        width,height=struct.unpack('>II',head[16:24]);assert 0<width<=16384 and 0<height<=16384, 'PNG dimensions out of range'
        sizes[filename]=(width,height)
    def numbers(v,n):
        assert isinstance(v,list) and len(v)==n and all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) for x in v), 'Invalid numeric rectangle'
        return v
    def frame(f,image,draw=True):
        x,y,width,height=numbers(f['source'],4);iw,ih=sizes[image]
        assert x>=0 and y>=0 and width>0 and height>0 and x+width<=iw+0.01 and y+height<=ih+0.01, 'Source rectangle outside '+image
        left,top,right,bottom=numbers(f['box'],4)
        assert 0<=left<right<=width+0.01 and 0<=top<bottom<=height+0.01, 'Crop rectangle outside source'
        if draw:
            dx,dy,dw,dh=numbers(f['draw'],4);assert dw>0 and dh>0, 'Empty draw rectangle'
        else:
            fx,fy,fr,fb=numbers(f['face'],4);assert fx<fr and fy<fb, 'Invalid face rectangle'
            scale=f.get('scale',dock.get('targetFaceWidth',0)/(fr-fx));assert isinstance(scale,(float,int)) and math.isfinite(scale) and scale>0, 'Invalid dock scale'
    for name,count in REQUIRED.items():
        assert name in clips and len(clips[name]['frames'])>=count, name+' needs at least '+str(count)+' frame slots'
    for name,clip in clips.items():
        assert clip['frames'], name+' has no frames'
        if 'frameMs' in clip:
            ms=clip['frameMs'];assert isinstance(ms,(int,float)) and not isinstance(ms,bool) and math.isfinite(ms) and ms>0, 'Invalid frame duration'
            assert isinstance(clip.get('loop'),bool), 'Timed clip requires boolean loop'
        if 'reducedFrame' in clip:assert isinstance(clip['reducedFrame'],int) and 0<=clip['reducedFrame']<len(clip['frames']), 'Reduced frame outside clip'
        if 'size' in clip:assert tuple(clip['size'])==sizes[clip['image']], 'Declared image size differs for '+name
        for f in clip['frames']:
            key=f.get('image',name);assert key in images, 'Unknown frame image key: '+key
            frame(f,images[key])
    for state,clip in m.get('stateMap',{}).items():
        assert isinstance(state,str) and clip in clips, 'State map references missing clip'
    for phase,clip in m.get('idlePhases',{}).items():
        assert phase in ['stretch','doze','sleep','sleepEnter'] and clip in clips, 'Idle phase references missing clip'
    for edge in ['left','right','bottom']+([] if dock.get('topDerivedFromBottom') else ['top']):
        f=dock['poses'][edge];key=f.get('imageKey','dock');assert key in dock_images, 'Unknown dock image key'
        frame(f,dock_images[key],False)
    for edge,sequence in dock.get('animations',{}).items():
        assert edge in ['left','right','top','bottom'] and sequence['frames'], 'Invalid dock animation'
        assert isinstance(sequence['frameMs'],(float,int)) and math.isfinite(sequence['frameMs']) and sequence['frameMs']>0, 'Invalid dock frame duration'
        for f in sequence['frames']:
            key=f.get('imageKey','dock');assert key in dock_images, 'Unknown dock animation image'
            frame(f,dock_images[key],False)
    return m,sorted(sizes)
def main():
    a=argparse.ArgumentParser(description=__doc__);a.add_argument('folder',type=Path);a.add_argument('--export',type=Path);args=a.parse_args()
    try:
        manifest,images=check(args.folder)
        if args.export:
            assert not args.export.exists(), 'Export target must not exist; existing pets will not be overwritten'
            # All checks finish before creating output.
            args.export.mkdir(parents=True)
            for name in images:shutil.copy2(args.folder/name,args.export/name)
            (args.export/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
            (args.export/'manifest.js').write_text('globalThis.InoriAssets = '+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
        print(json.dumps({'passed':True,'images':len(images),'exported':bool(args.export)}))
    except (AssertionError,KeyError,ValueError,TypeError,OSError) as e:
        a.exit(1,'Asset validation failed: '+str(e)+'\n')
if __name__=='__main__':main()
