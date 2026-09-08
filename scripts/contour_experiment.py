"""Source-guided, one-pixel calf cleanup experiment; see contour/README.md."""
from pathlib import Path
import json, hashlib, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
from scipy.ndimage import binary_erosion
from cad_experiment import box_rgba, rgb_to_lab
ROOT=Path(__file__).resolve().parents[1]
srcpath=ROOT/'pixel-editor/png-lab/assets/kat-original.png'
basepath=ROOT/'pixel-editor/hybrid/assets/weak.png'
src=np.array(Image.open(srcpath).convert('RGBA'));base=np.array(Image.open(basepath).convert('RGBA'))
palette=np.array(json.loads((ROOT/'pixel-editor/hybrid/assets/manifest.json').read_text())['palette'],np.uint8)
tree=cKDTree(rgb_to_lab(palette));area,coverage=box_rgba(src,(139,208));mask=base[...,3]>0
# A boundary color reference: mean source color restricted to dark opaque pixels.
darksrc=src.copy();dark=(rgb_to_lab(src[...,:3])[...,0]<.28)&(src[...,3]>127)
darksrc[...,3]=np.where(dark,src[...,3],0)
darkrgb,darkcoverage=box_rgba(darksrc,(139,208))
regions=[dict(id='left',name='Икра слева',bounds=[50,148,23,40],crop=[49,139,25,60]),dict(id='right',name='Икра справа',bounds=[73,148,23,40],crop=[72,139,26,63])]
shape=base.copy();outlines=base.copy();metrics=[]
# DP selects each row's left/right endpoint within +/-1 original pixel.
# Fidelity is exact fractional-area disagreement. Penalize changes of step length.
def optimize(original,ys,side):
 options=[[int(v)] if k in (0,len(ys)-1) else [int(v)-1,int(v),int(v)+1] for k,v in enumerate(original)]
 def fidelity(k,x):
  old=int(original[k]);y=int(ys[k]);a,b=sorted((x,old))
  cells=range(a,b) if side=='left' else range(a+1,b+1)
  adding=(x<old) if side=='left' else (x>old)
  cost=sum((1-2*coverage[y,c]) if adding else (2*coverage[y,c]-1) for c in cells)
  return float(cost)+.12*abs(x-old)
 states={(options[0][0],v):(fidelity(1,v),[options[0][0],v]) for v in options[1]}
 for k in range(2,len(ys)):
  nextstates={}
  for (a,b),(cost,path) in states.items():
   for c in options[k]:
    if abs(c-b)>2:continue
    total=cost+fidelity(k,c)+.22*abs((c-b)-(b-a))
    key=(b,c)
    if key not in nextstates or total<nextstates[key][0]:nextstates[key]=(total,path+[c])
  states=nextstates
 return min(states.values(),key=lambda v:v[0])[1]
for reg in regions:
 x,y,w,h=reg['bounds'];ys=np.arange(y,y+h);left=[];right=[]
 for row in ys:
  visible=np.flatnonzero(mask[row,x:x+w])+x
  assert len(visible)>2 and np.all(np.diff(visible)==1)
  left.append(visible[0]);right.append(visible[-1])
 lnew=optimize(left,ys,'left');rnew=optimize(right,ys,'right')
 for k,row in enumerate(ys):
  for col in range(x,x+w):
   new=lnew[k]<=col<=rnew[k]
   if new!=mask[row,col]:
    if new:
     color=darkrgb[row,col] if darkcoverage[row,col]>=.10 else area[row,col]
     shape[row,col]=[*palette[tree.query(rgb_to_lab(color))[1]],255]
    else:shape[row,col]=0
 # Outline repair only at original horizontal endpoints, never interior shading.
 count=0
 for k,row in enumerate(ys):
  for col in (left[k],right[k]):
   if darkcoverage[row,col]<.10:continue
   currentL=rgb_to_lab(base[row,col,:3])[0]
   chosen=palette[tree.query(rgb_to_lab(darkrgb[row,col]))[1]]
   if currentL>.30 and currentL-rgb_to_lab(chosen)[0]>.12:
    outlines[row,col,:3]=chosen;count+=1
 metrics.append(dict(region=reg['id'],outline_pixels=count))
# Extend color-only repair to skin at a four-connected silhouette boundary.
# Keep the established calf proposals exactly as before.
extra_regions=[
 dict(id='shoulder_left',name='Плечо слева',bounds=[46,48,11,14],crop=[44,45,17,21]),
 dict(id='shoulder_right',name='Плечо справа',bounds=[78,47,14,16],crop=[75,44,20,23]),
 dict(id='arm_left',name='Рука слева',bounds=[36,62,20,58],crop=[34,60,24,62]),
 dict(id='arm_right',name='Рука справа',bounds=[80,63,17,60],crop=[78,61,21,64]),
 dict(id='thigh_left',name='Бедро слева',bounds=[47,120,20,22],crop=[45,116,24,29]),
 dict(id='thigh_right',name='Бедро справа',bounds=[67,123,18,19],crop=[65,119,23,27])]
boundary=mask&~binary_erosion(mask)
for reg in extra_regions:
 x,y,w,h=reg['bounds'];count=0
 for row,col in np.argwhere(boundary):
  if not(x<=col<x+w and y<=row<y+h):continue
  r,g,b=base[row,col,:3].astype(float)
  # Protect dark features and pale clothing trim from being mistaken for skin.
  if not(r>1.15*g and r>1.2*b):continue
  if darkcoverage[row,col]<.10:continue
  currentL=rgb_to_lab(base[row,col,:3])[0]
  chosen=palette[tree.query(rgb_to_lab(darkrgb[row,col]))[1]]
  if currentL>.30 and currentL-rgb_to_lab(chosen)[0]>.12:
   outlines[row,col,:3]=chosen;count+=1
 metrics.append(dict(region=reg['id'],outline_pixels=count))
regions.extend(extra_regions)
patches=[]
for kind,arr in [('shape',shape),('outline',outlines)]:
 for y,x in np.argwhere(np.any(arr!=base,axis=2)):
  patches.append(dict(id=f'{kind}-{x}-{y}',kind=kind,x=int(x),y=int(y),before=base[y,x].tolist(),after=arr[y,x].tolist(),source_coverage=round(float(coverage[y,x]),4),source_dark_coverage=round(float(darkcoverage[y,x]),4)))
meta=dict(width=139,height=208,regions=regions,patches=patches,metrics=metrics,source_sha256=hashlib.sha256(srcpath.read_bytes()).hexdigest(),base_sha256=hashlib.sha256(basepath.read_bytes()).hexdigest(),palette=palette.tolist())
(ROOT/'pixel-editor/contour/patches.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
# Review-only contact sheet, outside repository. Pixel rendering, no smoothing.
combined=shape.copy()
for p in patches:
 if p['kind']=='outline' and combined[p['y'],p['x'],3]:combined[p['y'],p['x']]=p['after']
board=Image.new('RGB',(26*7*4,65*7*2+30),'#eee9df');draw=ImageDraw.Draw(board)
for i,(name,arr) in enumerate([('Weak',base),('Shape',shape),('Outline',outlines),('Both',combined)]):
 draw.text((i*182+6,5),name,fill='black')
 for j,r in enumerate(regions[:2]):
  x,y,w,h=r['crop'];im=Image.fromarray(arr).crop((x,y,x+w,y+h)).resize((w*7,h*7),Image.Resampling.NEAREST);board.paste(im,(i*182,30+j*455),im)
board.save(ROOT.parent/'contour-review.png')
print(json.dumps({'shape':sum(p['kind']=='shape' for p in patches),'outline':sum(p['kind']=='outline' for p in patches),'metrics':metrics}))

# Additional region comparison contact sheet for visual review.
board=Image.new('RGB',(420, len(extra_regions)*340),'#eee9df');draw=ImageDraw.Draw(board)
for j,r in enumerate(extra_regions):
 draw.text((5,j*340+5),r['id'],fill='black')
 x,y,w,h=r['crop'];scale=min(190//w,300//h)
 for i,arr in enumerate([base,outlines]):
  im=Image.fromarray(arr).crop((x,y,x+w,y+h)).resize((w*scale,h*scale),Image.Resampling.NEAREST)
  board.paste(im,(i*210+5,j*340+30),im)
board.save(ROOT.parent/'outline-body-review.png')
