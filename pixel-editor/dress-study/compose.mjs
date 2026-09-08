export function compose(variants,meta,mode,disabled=new Set()){
 if(!['nearest','weak','outline'].includes(mode))throw Error('Unknown method');
 const out=new Uint8ClampedArray(variants[mode==='nearest'?'nearest':'weak']);
 if(mode==='outline')for(const p of meta.patches)if(!disabled.has(p.id))out.set(p.after,(p.y*meta.width+p.x)*4);
 return out;
}
