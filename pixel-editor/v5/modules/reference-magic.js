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
const CFG={NEUTRAL_C:.018,FAMILY_H_WEIGHT:1,FAMILY_C_WEIGHT:320,RAMP_L_WEIGHT:3.2,RAMP_C_WEIGHT:2.4,RAMP_H_WEIGHT:.0025};
export default{
  id:'reference-magic',
  mount(app){
    const ref=document.getElementById('ref');if(!ref)return;
    const ctx=ref.getContext('2d',{willReadFrequently:true});
    let enabled=false,original=null;

    function buildRamps(){
      const ramps=[];
      for(const family of app.palette?.families||[]){
        const colors=(family.shades||[]).map(hex=>{const [r,g,b]=rgb(hex),lab=oklab(r,g,b);return{hex,r,g,b,lab,lch:oklch(lab)}}).sort((a,b)=>a.lch.L-b.lch.L);
        if(!colors.length)continue;
        const colored=colors.filter(c=>c.lch.C>=CFG.NEUTRAL_C);
        const sample=colored.length?colored:colors;
        let sx=0,sy=0,sc=0;
        for(const c of sample){const rad=c.lch.H*Math.PI/180,w=Math.max(c.lch.C,.01);sx+=Math.cos(rad)*w;sy+=Math.sin(rad)*w;sc+=c.lch.C}
        let H=Math.atan2(sy,sx)*180/Math.PI;if(H<0)H+=360;
        ramps.push({id:family.id,colors,H,C:sc/sample.length});
      }
      return ramps;
    }

    function refreshViews(){app.backgroundToggle?.renderMask?.();app.loupe?.draw();app.emit('reference:magic',{enabled})}
    function capture(){original=ctx.getImageData(0,0,ref.width,ref.height)}

    function chooseRamp(src,ramps){
      if(src.C<CFG.NEUTRAL_C){
        const gray=ramps.find(r=>r.id==='gray');if(gray)return gray;
      }
      let best=ramps[0],score=Infinity;
      for(const ramp of ramps){
        if(ramp.id==='gray'&&src.C>=CFG.NEUTRAL_C)continue;
        const dh=hueDiff(src.H,ramp.H);
        const dc=src.C-ramp.C;
        const q=dh*dh*CFG.FAMILY_H_WEIGHT+dc*dc*CFG.FAMILY_C_WEIGHT;
        if(q<score){score=q;best=ramp}
      }
      return best;
    }

    function chooseShade(src,ramp){
      let best=ramp.colors[0],score=Infinity;
      for(const c of ramp.colors){
        const dL=src.L-c.lch.L,dC=src.C-c.lch.C;
        const dH=(src.C<CFG.NEUTRAL_C||c.lch.C<CFG.NEUTRAL_C)?0:hueDiff(src.H,c.lch.H);
        const q=dL*dL*CFG.RAMP_L_WEIGHT+dC*dC*CFG.RAMP_C_WEIGHT+dH*dH*CFG.RAMP_H_WEIGHT;
        if(q<score){score=q;best=c}
      }
      return best;
    }

    function nearest(source,ramps){
      const lab=oklab(source[0],source[1],source[2]),src=oklch(lab);
      return chooseShade(src,chooseRamp(src,ramps));
    }

    function applyMagic(){
      if(!original)capture();const ramps=buildRamps();if(!ramps.length)return;
      const out=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),d=out.data,cache=new Map();
      for(let i=0;i<d.length;i+=4){
        if(d[i+3]===0)continue;
        const key=(d[i]<<16)|(d[i+1]<<8)|d[i+2];let best=cache.get(key);
        if(!best){best=nearest([d[i],d[i+1],d[i+2]],ramps);cache.set(key,best)}
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