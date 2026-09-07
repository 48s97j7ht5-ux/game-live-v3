"""Small invariants for the independent CAD implementation; not a paper benchmark."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from cad_experiment import adaptive, box_rgba, rgb_to_lab, lab_to_rgb
import numpy as np

a=np.zeros((24,24,4),np.uint8)
a[4:20,4:20]=[230,120,90,255]
b=a.copy(); b[b[...,3]==0,:3]=[0,255,0]
before=a.copy()
x,m=adaptive(a,(6,6),8); y,n=adaptive(b,(6,6),8)
assert np.array_equal(a,before), 'Source modified'
assert np.array_equal(x,y), 'Invisible RGB changed output'
mask=box_rgba(a,(6,6))[1]>=.5
assert np.max(np.abs(x[mask].astype(int)-[230,120,90]))<=1
assert m['max_center_shift']<=.2500001
colors=np.array([[0,0,0],[255,255,255],[255,0,0],[0,255,0],[0,0,255],[230,120,90]])
assert np.max(np.abs(lab_to_rgb(rgb_to_lab(colors)).astype(int)-colors))<=1
transparent=np.zeros((5,7,4),np.uint8)
empty, info=adaptive(transparent,(3,2),8)
assert empty.shape==(2,3,3) and not empty.any() and info['converged']
print('PASS source immutability, transparent RGB invariance, constant colour, Lab conversion, empty input and movement bound')
