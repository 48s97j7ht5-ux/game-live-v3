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
const CFG={CONTEXT_RADIUS:3,CONTEXT_L:.18,RAMP_L_WEIGHT:4.2,RAMP_C_WEIGHT:1.5};
const HUE_RAMPS=[['red',10],['yellow',92],['green',145],['cyan',200],['blue',255],['purple',300],['pink',340]];
const OFFSETS=[];
for(let dy=-CFG.CONTEXT_RADIUS;dy<=CFG.CONTEXT_RADIUS;dy++)for(let dx=-CFG.CONTEXT_RADIUS;dx<=CFG.CONTEXT_RADIUS;dx++)OFFSETS.push({dx,dy,w:1/(1+Math.hypot(dx,dy))});
export default{
  id:'reference-magic',
  mount(app){
    const ref=document.getElementById('ref');if(!ref)return;
    const ctx=ref.getContext('2d',{willReadFrequently:true});
    let enabled=false,original=null;

    function buildRamps(){
      const ramps=new Map(),flat=[];
      for(const family of app.palette?.families||[]){
        const specs=family.ramps?.length?family.ramps:[{id:family.id,shades:family.shades||[]}];
        for(const spec of specs){
          const colors=[];
          for(const hex of spec.shades||[]){
            const [r,g,b]=rgb(hex),lab=oklab(r,g,b),color={hex,r,g,b,lab,lch:oklch(lab)};
            colors.push(color);flat.push(color);
          }
          if(colors.length)ramps.set(spec.id,colors);
        }
      }
      return{ramps,flat};
    }

    function refreshViews(){app.backgroundToggle?.renderMask?.();app.loupe?.draw();app.emit('reference:magic',{enabled})}
    function capture(){original=ctx.getImageData(0,0,ref.width,ref.height)}

    function analyze(data){
      const count=data.length/4,L=new Float32Array(count),A=new Float32Array(count),B=new Float32Array(count),C=new Float32Array(count),H=new Float32Array(count),alpha=new Uint8Array(count),cache=new Map();
      for(let i=0;i<count;i++){
        const q=i*4,a=data[q+3];alpha[i]=a;if(a===0)continue;
        const key=(data[q]<<16)|(data[q+1]<<8)|data[q+2];
        let color=cache.get(key);
        if(!color){const lab=oklab(data[q],data[q+1],data[q+2]);color={lab,lch:oklch(lab)};cache.set(key,color)}
        L[i]=color.lab.L;A[i]=color.lab.a;B[i]=color.lab.b;C[i]=color.lch.C;H[i]=color.lch.H;
      }
      return{L,A,B,C,H,alpha};
    }

    function rampId(light,chroma,hue){
      if(chroma<.014)return'gray';
      if(hue>=15&&hue<=90){
        if(light<.48)return'brown';
        if(chroma<.065)return'taupe';
        if(chroma<.085)return'skin-soft';
        if(chroma<.145)return'skin-gold';
        return'orange';
      }
      if(chroma<.045)return'gray';
      let best=HUE_RAMPS[0],distance=Infinity;
      for(const ramp of HUE_RAMPS){const d=hueDiff(hue,ramp[1]);if(d<distance){distance=d;best=ramp}}
      return best[0];
    }

    function contextRamp(i,x,y,width,height,info){
      const light=info.L[i];let sa=0,sb=0,sw=0;
      for(const offset of OFFSETS){
        const nx=x+offset.dx,ny=y+offset.dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
        const j=ny*width+nx;if(info.alpha[j]===0||Math.abs(light-info.L[j])>CFG.CONTEXT_L)continue;
        sa+=info.A[j]*offset.w;sb+=info.B[j]*offset.w;sw+=offset.w;
      }
      const a=sw?sa/sw:info.A[i],b=sw?sb/sw:info.B[i],chroma=Math.hypot(a,b);
      let hue=Math.atan2(b,a)*180/Math.PI;if(hue<0)hue+=360;
      return rampId(light,chroma,hue);
    }

    function chooseShade(i,colors,info){
      let best=colors[0],score=Infinity;
      for(const color of colors){
        const dL=info.L[i]-color.lab.L,da=info.A[i]-color.lab.a,db=info.B[i]-color.lab.b,dC=info.C[i]-color.lch.C;
        const q=dL*dL*CFG.RAMP_L_WEIGHT+da*da+db*db+dC*dC*CFG.RAMP_C_WEIGHT;
        if(q<score){score=q;best=color}
      }
      return best;
    }

    function applyMagic(){
      if(!original)capture();
      const palette=buildRamps();if(!palette.flat.length)return;
      const out=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),d=out.data,info=analyze(original.data),cache=new Map();
      for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){
        const i=y*out.width+x,q=i*4;if(d[q+3]===0)continue;
        const id=contextRamp(i,x,y,out.width,out.height,info),colors=palette.ramps.get(id)||palette.flat;
        const sourceKey=(d[q]<<16)|(d[q+1]<<8)|d[q+2],cacheKey=id+':'+sourceKey;
        let best=cache.get(cacheKey);if(!best){best=chooseShade(i,colors,info);cache.set(cacheKey,best)}
        d[q]=best.r;d[q+1]=best.g;d[q+2]=best.b;
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