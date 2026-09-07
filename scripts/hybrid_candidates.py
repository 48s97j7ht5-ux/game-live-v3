"""Precompute compatible Kat candidates; requires upstream PixelOE legacy.
See pixel-editor/hybrid/README.md for experiment boundaries.
"""
from pathlib import Path
import sys,os,json,subprocess,tempfile,hashlib
import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion
from scipy.spatial import cKDTree
import torch
import cv2
sys.path.insert(0,os.environ['PIXELOE_SRC'])
from pixeloe.legacy.outline import outline_expansion
from pixeloe.legacy.downscale.contrast_based import contrast_based_downscale
from cad_experiment import box_rgba,rgb_to_lab
torch.set_num_threads(2)
root=Path(__file__).resolve().parents[1]; dest=root/'pixel-editor/hybrid/assets';dest.mkdir(parents=True,exist_ok=True)
source_path=root/'pixel-editor/png-lab/assets/kat-original.png';src=np.array(Image.open(source_path).convert('RGBA'))
pal=np.array(json.loads((root/'pixel-editor/cad-study/assets/results.json').read_text())['palette'],np.uint8)
tree=cKDTree(rgb_to_lab(pal));size=(139,208);area,alpha=box_rgba(src,size);mask=alpha>=.5
ref=rgb_to_lab(area);edge=mask&~binary_erosion(mask)
regions=[{'id':'face','name':'Лицо','rect':[49,18,25,26]},
 {'id':'left_hand','name':'Кисть слева','rect':[36,106,13,18]},
 {'id':'right_hand','name':'Кисть справа','rect':[84,107,13,19]},
 {'id':'left_calf','name':'Икра слева','rect':[53,142,17,53]},
 {'id':'right_calf','name':'Икра справа','rect':[73,142,23,56]}]
names={'nearest':'Обычное','retro':'Retro','cad':'Адаптивное','soft':'PixelOE ½','weak':'PixelOE слабое','combined':'PixelOE + Retro'}
results={};statistics={}
def save(name,rgb):
 mapped=pal[tree.query(rgb_to_lab(np.asarray(rgb)))[1]]
 out=np.zeros((208,139,4),np.uint8);out[mask,:3]=mapped[mask];out[mask,3]=255
 Image.fromarray(out).save(dest/(name+'.png'));results[name]=out
 assert len(np.unique(out[mask,:3],axis=0))<=48
sample=np.array(Image.fromarray(src).resize(size,Image.Resampling.NEAREST));rgb=sample[...,:3].copy();bad=sample[...,3]==0;rgb[bad]=np.uint8(np.rint(area[bad]));save('nearest',rgb)
save('cad',np.array(Image.open(root/'pixel-editor/cad-study/assets/208-adaptive-raw.png'))[...,:3])
with tempfile.TemporaryDirectory() as tmp:
 tmp=Path(tmp);out=tmp/'retro.png'
 detection=json.loads(subprocess.check_output(['node',str(root/'scripts/hybrid-retro.cjs'),str(source_path),str(out)],text=True))
 save('retro',np.array(Image.open(out))[...,:3])
 a=src[...,3:4]/255;matte=np.uint8(np.rint(src[...,:3]*a+np.array([238,233,223])*(1-a)))
 work=np.array(Image.fromarray(matte).resize((1112,1664),Image.Resampling.BICUBIC))[...,::-1].copy()
 print('Expanding full Kat with upstream PixelOE',flush=True)
 expanded=outline_expansion(work,1,1,8,9,4)[0]
 for name,t in [('soft',.5),('weak',1)]:
  mix=np.uint8(np.rint(work*(1-t)+expanded*t));low=contrast_based_downscale(mix,np.sqrt(139*208)*(1+1e-10))
  assert low.shape==(208,139,3),low.shape
  save(name,low[...,::-1]);print(name,'ready',flush=True)
 high=np.zeros((1664,1112,4),np.uint8);high[...,:3]=expanded[...,::-1]
 high[...,3]=np.array(Image.fromarray(src[...,3]).resize((1112,1664),Image.Resampling.BILINEAR))
 hp=tmp/'expanded.png';Image.fromarray(high).save(hp)
 subprocess.check_output(['node',str(root/'scripts/hybrid-retro.cjs'),str(hp),str(out)],text=True)
 save('combined',np.array(Image.open(out))[...,:3])
# Heuristic ranking: mean Lab discrepancy plus missing dark boundary samples.
# This is a starting suggestion, not an aesthetic quality model.
def rank(rect):
 x,y,w,h=rect;sel=np.zeros(mask.shape,bool);sel[y:y+h,x:x+w]=True;sel&=mask
 boundary=sel&edge; scores={}
 for name,out in results.items():
  lab=rgb_to_lab(out[...,:3]);color=float(np.mean(np.sum((lab[sel]-ref[sel])**2,axis=1))) if sel.any() else 0
  missing=float(np.mean(np.maximum(lab[...,0][boundary]-.35,0))) if boundary.any() else 0
  scores[name]=round(color+missing*.35,6)
 return dict(sorted(scores.items(),key=lambda p:p[1]))
base_scores=rank([0,0,139,208]);auto={'base':next(iter(base_scores))};statistics['base']=base_scores
for region in regions:
 scores=rank(region['rect']);auto[region['id']]=next(iter(scores));statistics[region['id']]=scores
meta={'width':139,'height':208,'palette':pal.tolist(),'methods':names,'regions':regions,'auto':auto,'scores':statistics,'detection':detection,
 'source_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
 'pixeloe_commit':subprocess.check_output(['git','-C',str(Path(os.environ['PIXELOE_SRC']).parent),'rev-parse','HEAD'],text=True).strip()}
(dest/'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print('AUTO',auto,flush=True)
