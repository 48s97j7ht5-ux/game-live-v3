function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function linear(v){const c=v/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
function oklab(r,g,b){
  const R=linear(r),G=linear(g),B=linear(b);
  const l=.4122214708*R+.5363325363*G+.0514459929*B;
  const m=.2119034982*R+.6806995451*G+.1073969566*B;
  const s=.0883024619*R+.2817188376*G+.6299787005*B;
  const L=Math.cbrt(Math.max(0,l)),M=Math.cbrt(Math.max(0,m)),S=Math.cbrt(Math.max(0,s));
  return{L:.2104542553*L+.7936177850*M-.0040720468*S,a:1.9779984951*L-2.4285922050*M+.4505937099*S,b:.0259040371*L+.7827717662*M-.8086757660*S};
}
function oklch(lab){const C=Math.hypot(lab.a,lab.b);let H=Math.atan2(lab.b,lab.a)*180/Math.PI;if(H<0)H+=360;return{L:lab.L,C,H}}
function hueDiff(a,b){let d=Math.abs(a-b)%360;return d>180?360-d:d}
const CFG={L_WEIGHT:1.8,NEUTRAL_C:.028,HUE_GUARD:22,HUE_FALLBACK:38,L_GUARD:.13,L_FALLBACK:.22,C_GUARD:.035,C_FALLBACK:.07,C_WEIGHT:2.2,LOW_C:.055,LOW_C_MAX_UP:.010,DIR_MIN_C:.012,DIR_AXIS_MIN:.003,DIR_AXIS_TOL:.002,LOW_C_UP_WEIGHT:6.0};
export default{
  id:'reference-magic',
  mount(app){
    const ref=document.getElementById('ref');if(!ref)return;
    const ctx=ref.getContext('2d',{willReadFrequently:true});
    let enabled=false,original=null;
    function colors(){
      const rows=[],seen=new Set();
      for(const family of app.palette?.families||[])for(const hex of family.shades||[]){
        if(seen.has(hex))continue;seen.add(hex);
        const [r,g,b]=rgb(hex),lab=oklab(r,g,b);rows.push({hex,r,g,b,lab,lch:oklch(lab)});
      }
      return rows;
    }
    function refreshViews(){app.backgroundToggle?.renderMask?.();app.loupe?.draw();app.emit('reference:magic',{enabled})}
    function capture(){original=ctx.getImageData(0,0,ref.width,ref.height)}
    function nearest(source,pal){
      const lab=oklab(source[0],source[1],source[2]),src=oklch(lab);
      const hueOk=(c,g)=>src.C<CFG.NEUTRAL_C||c.lch.C<CFG.NEUTRAL_C||hueDiff(src.H,c.lch.H)<=g;
      let candidates=pal.filter(c=>hueOk(c,CFG.HUE_GUARD));
      if(!candidates.length)candidates=pal.filter(c=>hueOk(c,CFG.HUE_FALLBACK));
      if(!candidates.length)candidates=pal;

      const axisSafe=candidates.filter(c=>{
        const aOk=Math.abs(lab.a)<CFG.DIR_AXIS_MIN||Math.abs(c.lab.a)<CFG.DIR_AXIS_TOL||lab.a*c.lab.a>=0;
        const bOk=Math.abs(lab.b)<CFG.DIR_AXIS_MIN||Math.abs(c.lab.b)<CFG.DIR_AXIS_TOL||lab.b*c.lab.b>=0;
        return aOk&&bOk;
      });
      if(axisSafe.length)candidates=axisSafe;

      let light=candidates.filter(c=>Math.abs(src.L-c.lch.L)<=CFG.L_GUARD);
      if(!light.length)light=candidates.filter(c=>Math.abs(src.L-c.lch.L)<=CFG.L_FALLBACK);
      if(light.length)candidates=light;

      if(src.C<CFG.LOW_C){
        let guarded=candidates.filter(c=>c.lch.C<=src.C+CFG.LOW_C_MAX_UP);
        if(src.C>=CFG.DIR_MIN_C){
          const sameDir=guarded.filter(c=>(lab.a*c.lab.a+lab.b*c.lab.b)>=0);
          if(sameDir.length)guarded=sameDir;
        }
        if(guarded.length)candidates=guarded;
      }

      let chroma=candidates.filter(c=>Math.abs(src.C-c.lch.C)<=CFG.C_GUARD);
      if(!chroma.length)chroma=candidates.filter(c=>Math.abs(src.C-c.lch.C)<=CFG.C_FALLBACK);
      if(chroma.length)candidates=chroma;

      let best=candidates[0],score=Infinity;
      for(const c of candidates){
        const dL=(lab.L-c.lab.L)*CFG.L_WEIGHT,da=lab.a-c.lab.a,db=lab.b-c.lab.b;
        const dC=src.C-c.lch.C;
        const cWeight=(src.C<CFG.LOW_C&&c.lch.C>src.C)?CFG.LOW_C_UP_WEIGHT:CFG.C_WEIGHT;
        const q=dL*dL+da*da+db*db+(dC*cWeight)*(dC*cWeight);
        if(q<score){score=q;best=c}
      }
      return best;
    }
    function applyMagic(){
      if(!original)capture();const pal=colors();if(!pal.length)return;
      const out=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),d=out.data,cache=new Map();
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]===0)continue;
        const key=(d[i]<<16)|(d[i+1]<<8)|d[i+2];let best=cache.get(key);
        if(!best){best=nearest([d[i],d[i+1],d[i+2]],pal);cache.set(key,best)}
        d[i]=best.r;d[i+1]=best.g;d[i+2]=best.b;
      }
      ctx.putImageData(out,0,0);refreshViews();
    }
    function restore(){if(original)ctx.putImageData(original,0,0);refreshViews()}
    function setEnabled(next){enabled=!!next;if(enabled)applyMagic();else restore()}
    function toggle(){setEnabled(!enabled)}
    app.on('reference:changed',()=>{capture();if(enabled)applyMagic();else refreshViews()});
    app.referenceMagic={get enabled(){return enabled},toggle,setEnabled,apply:applyMagic,restore};
  }
};