import{describeColor,paletteMatchScore,localContrastMatchScore}from'../core/color-metrics.js';
function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
export default{
  id:'reference-magic',
  mount(app){
    const ref=document.getElementById('ref');
    if(!ref)return;
    const ctx=ref.getContext('2d',{willReadFrequently:true});
    let enabled=false,original=null;

    function colors(){
      const rows=[];
      for(const family of app.palette?.families||[]){
        for(const hex of family.shades||[]){
          const [r,g,b]=rgb(hex);
          rows.push({hex,family:family.id,...describeColor(r,g,b)});
        }
      }
      const seen=new Set();
      return rows.filter(c=>!seen.has(c.hex)&&(seen.add(c.hex),true));
    }

    function refreshViews(){app.backgroundToggle?.renderMask?.();app.loupe?.draw();app.emit('reference:magic',{enabled})}
    function capture(){original=ctx.getImageData(0,0,ref.width,ref.height)}

    function buildIntegral(data,w,h){
      const stride=w+1,size=(w+1)*(h+1);
      const ir=new Float64Array(size),ig=new Float64Array(size),ib=new Float64Array(size),ic=new Uint32Array(size);
      for(let y=1;y<=h;y++){
        let rr=0,gg=0,bb=0,cc=0;
        for(let x=1;x<=w;x++){
          const p=((y-1)*w+(x-1))*4,a=data[p+3];
          if(a){rr+=data[p];gg+=data[p+1];bb+=data[p+2];cc++}
          const q=y*stride+x,up=q-stride;
          ir[q]=ir[up]+rr;ig[q]=ig[up]+gg;ib[q]=ib[up]+bb;ic[q]=ic[up]+cc;
        }
      }
      return{ir,ig,ib,ic,stride};
    }

    function rectSum(arr,stride,x0,y0,x1,y1){
      const a=y0*stride+x0,b=y0*stride+x1,c=y1*stride+x0,d=y1*stride+x1;
      return arr[d]-arr[b]-arr[c]+arr[a];
    }

    function localBase(integral,w,h,x,y,r=2){
      const x0=Math.max(0,x-r),y0=Math.max(0,y-r),x1=Math.min(w,x+r+1),y1=Math.min(h,y+r+1),s=integral.stride;
      const count=rectSum(integral.ic,s,x0,y0,x1,y1);
      if(!count)return null;
      const rr=rectSum(integral.ir,s,x0,y0,x1,y1)/count;
      const gg=rectSum(integral.ig,s,x0,y0,x1,y1)/count;
      const bb=rectSum(integral.ib,s,x0,y0,x1,y1)/count;
      return describeColor(rr,gg,bb);
    }

    function nearestBase(base,pal,cache){
      const key=`${Math.round(base.r/12)},${Math.round(base.g/12)},${Math.round(base.b/12)}`;
      if(cache.has(key))return cache.get(key);
      let best=pal[0],score=Infinity;
      for(const c of pal){const q=paletteMatchScore(base,c);if(q<score){score=q;best=c}}
      cache.set(key,best);return best;
    }

    function applyMagic(){
      if(!original)capture();
      const pal=colors();if(!pal.length)return;
      const out=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height),d=out.data;
      const w=original.width,h=original.height,integral=buildIntegral(original.data,w,h),baseCache=new Map();

      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=(y*w+x)*4;
        if(d[i+3]===0)continue;
        const source=describeColor(d[i],d[i+1],d[i+2]);
        const sourceBase=localBase(integral,w,h,x,y)||source;
        const paletteBase=nearestBase(sourceBase,pal,baseCache);
        let best=pal[0],score=Infinity;
        for(const c of pal){
          const q=localContrastMatchScore(source,sourceBase,c,paletteBase);
          if(q<score){score=q;best=c}
        }
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