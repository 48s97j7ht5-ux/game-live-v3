"""Second-image transfer test using the established weak PixelOE parameters."""
from pathlib import Path
import os,sys,json,hashlib
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import binary_closing,binary_fill_holes,label,binary_erosion
from scipy.spatial import cKDTree
import torch
sys.path.insert(0,os.environ['PIXELOE_SRC'])
from pixeloe.legacy.outline import outline_expansion
from pixeloe.legacy.downscale.contrast_based import contrast_based_downscale
from cad_experiment import box_rgba,rgb_to_lab
root=Path(__file__).resolve().parents[1];dest=root/'pixel-editor/dress-study/assets'
path=dest/'source.jpeg';rgb=np.array(Image.open(path).convert('RGB'))
# JPEG has no alpha. Approximate black-background extraction; never remove all
# dark pixels globally. Close small breaks, keep largest foreground, fill holes.
seed=np.max(rgb,axis=2)>8
closed=binary_closing(seed,structure=np.ones((3,3)))
labels,n=label(closed);counts=np.bincount(labels.ravel());counts[0]=0
mask=labels==counts.argmax()
# Keep enclosed negative spaces, e.g. the gap between arm and dress.
# Fill tiny JPEG pinholes, and enclosed hair holes above the neck only.
filled=binary_fill_holes(mask);holes,hn=label(filled&~mask)
for hid in range(1,hn+1):
 yy,xx=np.where(holes==hid)
 if len(yy)<=16 or (len(yy) and yy.max()<330):mask[yy,xx]=True
src=np.zeros((*mask.shape,4),np.uint8);src[mask,:3]=rgb[mask];src[mask,3]=255
# Save review proxy only; processing uses original-resolution recovered mask.
Image.fromarray(src).resize((512,768),Image.Resampling.NEAREST).save(dest/'cutout-preview.png')
area,coverage=box_rgba(src,(139,208));lowmask=coverage>=.5
visible=rgb[mask];q=Image.fromarray(visible[None]).quantize(colors=48,method=Image.Quantize.MEDIANCUT)
pal=np.array(q.getpalette(),np.uint8).reshape(-1,3)[:48];tree=cKDTree(rgb_to_lab(pal))
def output(name,color):
 out=np.zeros((208,139,4),np.uint8);mapped=pal[tree.query(rgb_to_lab(color))[1]];out[lowmask,:3]=mapped[lowmask];out[lowmask,3]=255;Image.fromarray(out).save(dest/(name+'.png'));return out
sample=np.array(Image.fromarray(src).resize((139,208),Image.Resampling.NEAREST));nn=sample[...,:3].copy();bad=sample[...,3]==0;nn[bad]=np.uint8(np.rint(area[bad]));nearest=output('nearest',nn)
a=mask[...,None];matte=np.where(a,rgb,np.array([238,233,223],np.uint8));work=np.array(Image.fromarray(matte).resize((1112,1664),Image.Resampling.BICUBIC))[...,::-1].copy()
torch.set_num_threads(2);expanded=outline_expansion(work,1,1,8,9,4)[0];low=contrast_based_downscale(expanded,np.sqrt(139*208)*(1+1e-10));assert low.shape==(208,139,3)
weak=output('weak',low[...,::-1]);fixed=weak.copy()
darksrc=src.copy();dark=(rgb_to_lab(rgb)[...,0]<.28)&mask;darksrc[...,3]=np.where(dark,255,0);darkrgb,darkcov=box_rgba(darksrc,(139,208))
# Reuse the approved body windows and guard, no thresholds fitted to this JPEG.
old=json.loads((root/'pixel-editor/contour/patches.json').read_text());regions=old['regions'];edge=lowmask&~binary_erosion(lowmask);patches=[]
for y,x in np.argwhere(edge):
 reg=next((r for r in regions if r['bounds'][0]<=x<r['bounds'][0]+r['bounds'][2] and r['bounds'][1]<=y<r['bounds'][1]+r['bounds'][3]),None)
 if reg is None:continue
 # Preserve original calf endpoint scope.
 if reg['id'] in ('left','right') and lowmask[y,x-1] and lowmask[y,x+1]:continue
 r,g,b=weak[y,x,:3].astype(float)
 if reg['id'] not in ('left','right') and not(r>1.15*g and r>1.2*b):continue
 if darkcov[y,x]<.10:continue
 beforeL=rgb_to_lab(weak[y,x,:3])[0];chosen=pal[tree.query(rgb_to_lab(darkrgb[y,x]))[1]]
 if beforeL>.30 and beforeL-rgb_to_lab(chosen)[0]>.12:
  fixed[y,x,:3]=chosen;patches.append(dict(id=f'{x}-{y}',x=int(x),y=int(y),region=reg['id'],before=weak[y,x].tolist(),after=fixed[y,x].tolist()))
Image.fromarray(fixed).save(dest/'outline.png')
meta=dict(width=139,height=208,source_size=[rgb.shape[1],rgb.shape[0]],source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),palette=pal.tolist(),patches=patches,regions=regions,mask_method='RGB max >8, 3x3 closing, largest 4-connected foreground component, fill holes <=16 source pixels or enclosed above y=330',mask_pixels=int(mask.sum()),pixeloe_commit='341aa85048338d4d26c62fba23176e2b70d9f61b')
(dest/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
board=Image.new('RGB',(139*3*3,208*3+30),'#eee9df');d=ImageDraw.Draw(board)
for i,(name,out) in enumerate([('Nearest',nearest),('Weak PixelOE',weak),('Outline',fixed)]):
 d.text((i*417+5,6),name,fill='black');im=Image.fromarray(out).resize((417,624),Image.Resampling.NEAREST);board.paste(im,(i*417,30),im)
board.save(root.parent/'dress-review.png')
print(json.dumps({'source_size':meta['source_size'],'outline_proposals':len(patches),'mask_pixels':meta['mask_pixels']}))
