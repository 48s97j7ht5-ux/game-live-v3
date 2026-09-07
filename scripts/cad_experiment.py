"""Experimental Kopf/Shamir/Peers 2013 EM downscaler, pixel-art mode.

Independent implementation of the published equations, not author code.
See pixel-editor/cad-study/README.md for numerical choices and RGBA extension.
Requires numpy, scipy and Pillow. No neural model or remote service.
"""
from pathlib import Path
import argparse
import hashlib
from importlib.metadata import version
import json
import time
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree


def rgb_to_lab(rgb):
    v = np.asarray(rgb, dtype=np.float64) / 255
    v = np.where(v <= .04045, v / 12.92, ((v + .055) / 1.055) ** 2.4)
    xyz = v @ np.array([[.4124564, .3575761, .1804375],
                        [.2126729, .7151522, .0721750],
                        [.0193339, .1191920, .9503041]]).T
    xyz /= [.95047, 1, 1.08883]
    f = np.where(xyz > (6/29)**3, np.cbrt(xyz), xyz / (3*(6/29)**2) + 4/29)
    return np.stack([116*f[..., 1]-16, 500*(f[..., 0]-f[..., 1]),
                     200*(f[..., 1]-f[..., 2])], axis=-1) / 100


def lab_to_rgb(lab):
    lab = np.asarray(lab) * 100
    fy = (lab[..., 0]+16)/116
    f = np.stack([fy+lab[..., 1]/500, fy, fy-lab[..., 2]/200], axis=-1)
    xyz = np.where(f > 6/29, f**3, 3*(6/29)**2*(f-4/29)) * [.95047, 1, 1.08883]
    v = xyz @ np.linalg.inv(np.array([[.4124564, .3575761, .1804375],
                                     [.2126729, .7151522, .0721750],
                                     [.0193339, .1191920, .9503041]])).T
    v = np.where(v <= .0031308, 12.92*v, 1.055*np.maximum(v, 0)**(1/2.4)-.055)
    return np.uint8(np.clip(np.rint(v*255), 0, 255))


def box_rgba(src, size):
    """Fractional-area RGBA average, independent of hidden transparent RGB."""
    from scipy.sparse import csr_matrix
    h, w = src.shape[:2]
    ow, oh = size
    def axis(n, m):
        rows, cols, vals = [], [], []
        s = n/m
        for j in range(m):
            for i in range(int(j*s), min(n, int(np.ceil((j+1)*s)))):
                rows.append(j); cols.append(i)
                vals.append((min(i+1, (j+1)*s)-max(i, j*s))/s)
        return csr_matrix((vals, (rows, cols)), shape=(m, n))
    x, y = axis(w, ow), axis(h, oh)
    a = src[..., 3]/255.
    alpha = y @ a @ x.T
    rgb = np.stack([y @ (src[..., c]*a) @ x.T for c in range(3)], -1)
    rgb /= np.maximum(alpha[..., None], 1e-12)
    return rgb, alpha


def adaptive(src, size, max_iter=60):
    h, w = src.shape[:2]
    ow, oh = size; nk = ow*oh; rx, ry = w/ow, h/oh
    rgba = src.reshape(-1, 4)
    visible = np.flatnonzero(rgba[:, 3] > 0)
    if not len(visible):
        return np.zeros((oh, ow, 3), np.uint8), {'iterations': 0, 'converged': True}
    a = rgba[visible, 3].astype(float)/255
    c = rgb_to_lab(rgba[visible, :3])
    p = np.stack([(visible % w+.5)/rx, (visible//w+.5)/ry], -1)
    gy, gx = np.mgrid[:oh, :ow]
    home = np.stack([gx.ravel()+.5, gy.ravel()+.5], -1)
    mu = home.copy(); cov = np.tile(np.eye(2)/3, (nk, 1, 1))
    initial, alpha = box_rgba(src, size)
    nu = rgb_to_lab(initial.reshape(-1, 3))
    sigma = np.full(nk, .03)
    # Static support: centres within two output cells, at most 16 kernels/pixel.
    ids, pix = [], []
    base = np.floor(p-.5).astype(int)
    for dy in (-1, 0, 1, 2):
        for dx in (-1, 0, 1, 2):
            q = base + [dx, dy]
            ok = (q[:, 0]>=0)&(q[:, 0]<ow)&(q[:, 1]>=0)&(q[:, 1]<oh)
            ids.append(q[ok, 1]*ow+q[ok, 0]); pix.append(np.flatnonzero(ok))
    kid, pid = np.concatenate(ids), np.concatenate(pix)
    order = np.argsort(kid, kind='stable'); kid, pid = kid[order], pid[order]
    active, starts = np.unique(kid, return_index=True)
    pos = p[pid]; color = c[pid]; weight = a[pid]
    def acc(v): return np.bincount(kid, weights=v, minlength=nk)
    near = []
    for dy, dx in ((0,1), (0,-1), (1,0), (-1,0)):
        xx, yy = gx.ravel()+dx, gy.ravel()+dy
        ok = (xx>=0)&(xx<ow)&(yy>=0)&(yy<oh)
        near.append((np.flatnonzero(ok), yy[ok]*ow+xx[ok]))
    stable = 0; converged = False; start = time.time()
    for iteration in range(max_iter):
        inv = np.linalg.inv(cov)
        delta = pos-mu[kid]
        spatial = inv[kid,0,0]*delta[:,0]**2 + 2*inv[kid,0,1]*delta[:,0]*delta[:,1] + inv[kid,1,1]*delta[:,1]**2
        dc = color-nu[kid]
        logw = -.5*spatial - (dc*dc).sum(1)/(2*sigma[kid]**2)
        # Per-kernel log-sum-exp keeps very sharp bilateral weights finite.
        peak = np.zeros(nk); peak[active] = np.maximum.reduceat(logw, starts)
        wk = np.exp(np.maximum(logw-peak[kid], -700))
        wk /= np.maximum(acc(wk*weight)[kid], 1e-300)
        denom = np.bincount(pid, weights=wk, minlength=len(p))
        gamma = wk/np.maximum(denom[pid], 1e-300)
        mass = gamma*weight
        sums = acc(mass); safe = np.maximum(sums, 1e-20); used = sums > 1e-12
        new_mu = np.stack([acc(mass*pos[:,i])/safe for i in range(2)], -1)
        new_nu = np.stack([acc(mass*color[:,i])/safe for i in range(3)], -1)
        new_cov = np.zeros_like(cov)
        for i in range(2):
            for j in range(2): new_cov[:,i,j] = acc(mass*delta[:,i]*delta[:,j])/safe
        new_mu[~used] = home[~used]; new_nu[~used] = nu[~used]
        # Spatial correction, synchronously using all four neighbours.
        smooth = np.zeros_like(mu); counts = np.zeros(nk)
        for k, n in near: smooth[k] += new_mu[n]; counts[k] += 1
        smooth /= np.maximum(counts[:,None], 1)
        new_mu = np.clip(.5*(new_mu+smooth), home-.25, home+.25)
        eigen, vectors = np.linalg.eigh(new_cov)
        eigen = np.clip(eigen, .05, .1)
        new_cov = (vectors*eigen[:,None,:]) @ vectors.swapaxes(1,2)
        # Locality correction in output-cell units (area-normalized integral).
        change = np.zeros(nk, bool)
        delta = pos-new_mu[kid]
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                if dx == dy == 0: continue
                s = acc(mass*np.maximum(0, delta[:,0]*dx+delta[:,1]*dy)**2)/(rx*ry)
                xx, yy = gx.ravel()+dx, gy.ravel()+dy
                ok = (s>.2)&used&(xx>=0)&(xx<ow)&(yy>=0)&(yy<oh)
                change[ok] = True; change[yy[ok]*ow+xx[ok]] = True
        new_sigma = sigma.copy(); new_sigma[change] *= 1.1
        shift = float(np.max(np.abs(new_mu[used]-mu[used])))
        drift = float(np.max(np.abs(new_nu[used]-nu[used])))
        stable = stable+1 if shift<.001 and drift<.0003 and not change.any() else 0
        mu, cov, nu, sigma = new_mu, new_cov, new_nu, new_sigma
        if iteration%10 == 0:
            print(f'{ow}x{oh} iteration {iteration+1}: color Δ={drift:.5f}, position Δ={shift:.5f}', flush=True)
        if stable >= 3: converged = True; break
    assert np.isfinite(nu).all() and np.isfinite(mu).all()
    assert np.max(np.abs(mu-home)) <= .2500001
    return lab_to_rgb(nu.reshape(oh,ow,3)), dict(iterations=iteration+1,
        converged=converged, seconds=round(time.time()-start, 2), color_delta=drift,
        position_delta=shift, max_center_shift=float(np.max(np.abs(mu-home))),
        sigma_range=[float(sigma.min()),float(sigma.max())])


def run(root, heights):
    src = np.array(Image.open(root/'pixel-editor/png-lab/assets/kat-original.png').convert('RGBA'))
    dest = root/'pixel-editor/cad-study/assets'; dest.mkdir(parents=True, exist_ok=True)
    # One fixed source palette for every method and every output size.
    visible = src[src[...,3]>127,:3]
    quant = Image.fromarray(visible[None,...]).quantize(colors=48, method=Image.Quantize.MEDIANCUT)
    palette = np.asarray(quant.getpalette(), np.uint8).reshape(-1,3)[:48]
    tree = cKDTree(rgb_to_lab(palette))
    meta = {'source': [src.shape[1],src.shape[0]],
            'source_sha256': hashlib.sha256((root/'pixel-editor/png-lab/assets/kat-original.png').read_bytes()).hexdigest(),
            'versions': {name:version(name) for name in ['numpy','scipy','Pillow']},
            'palette':palette.tolist(), 'results':{}}
    for height in heights:
        width = round(src.shape[1]*height/src.shape[0]); size=(width,height)
        rgb, alpha = box_rgba(src, size)
        mask = alpha >= .5
        cad, metrics = adaptive(src, size)
        sampled = np.array(Image.fromarray(src).resize(size, Image.Resampling.NEAREST))
        nn = sampled[...,:3].copy()
        # The common coverage mask can retain cells whose centre is transparent.
        # Use area colour there instead of exposing arbitrary hidden RGB.
        missing = sampled[...,3] == 0
        nn[missing] = np.uint8(np.clip(np.rint(rgb[missing]),0,255))
        # All methods share exactly the same coverage mask to isolate colour placement.
        colors = {}
        for name, result in [('nearest',nn),('area',rgb),('adaptive',cad)]:
            for reduced in (False,True):
                out = np.zeros((height,width,4),np.uint8)
                mapped = palette[tree.query(rgb_to_lab(result))[1]] if reduced else np.uint8(np.clip(np.rint(result),0,255))
                out[mask,:3] = mapped[mask]; out[mask,3] = 255
                suffix='48' if reduced else 'raw'
                Image.fromarray(out).save(dest/f'{height}-{name}-{suffix}.png')
                colors[name+'-'+suffix] = int(len(np.unique(out[mask,:3],axis=0)))
                assert out.shape == (height,width,4)
                if reduced: assert colors[name+'-'+suffix] <= 48
        meta['results'][str(height)] = {'width':width,'height':height, 'metrics':metrics,'colors':colors}
        print(json.dumps(meta['results'][str(height)]), flush=True)
    (dest/'results.json').write_text(json.dumps(meta, indent=2)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--heights', nargs='+', type=int, default=[208,256])
    args = parser.parse_args()
    run(Path(__file__).resolve().parents[1],args.heights)
