// Browser adaptation of ideas in Retro-Diffusion/pixel-art-fixer:
// boundary-distance comb detection and two-stage reconstruction.
// Original: Copyright (c) 2026 Astropulse, LLC, MIT (vendor/LICENSE.txt).
// This reduced detector is NOT the full Retro Diffusion ensemble.
// Alpha-weighted votes/colours, separate coverage, deterministic histogram
// quantisation and final palette mapping are specific to this prototype.

export function validateImage({width,height,data}) {
  if (!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>4_000_000||data.length!==width*height*4) throw Error('Нужен PNG до 4 млн пикселей, со стороной не больше 4096 px.');
}
const key=(r,g,b)=>((r>>3)<<10)|((g>>3)<<5)|(b>>3);
const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;

function paletteFor(data, count) {
  const bins=new Map();
  for(let i=0;i<data.length;i+=4) {
    const a=data[i+3]/255;if(!a)continue;
    const k=key(data[i],data[i+1],data[i+2]);
    let v=bins.get(k);if(!v){v=[0,0,0,0,k];bins.set(k,v);}
    v[0]+=data[i]*a;v[1]+=data[i+1]*a;v[2]+=data[i+2]*a;v[3]+=a;
  }
  const points=[...bins.values()].map(v=>[v[0]/v[3],v[1]/v[3],v[2]/v[3],v[3],v[4]]).sort((a,b)=>b[3]-a[3]||a[4]-b[4]);
  if(!points.length)return {colors:[[0,0,0]],lookup:new Uint8Array(32768)};
  const colors=[points[0].slice(0,3)],nearest=new Float64Array(points.length).fill(Infinity);
  while(colors.length<Math.min(count,points.length)) {
    let pick=0,score=-1;
    for(let p=0;p<points.length;p++) {
      nearest[p]=Math.min(nearest[p],distance(points[p],colors.at(-1)));
      const s=nearest[p]*Math.sqrt(points[p][3]);if(s>score){score=s;pick=p;}
    }
    if(score<0.01)break;colors.push(points[pick].slice(0,3));
  }
  const lookup=new Uint8Array(32768);
  for(let iter=0;iter<8;iter++) {
    const sums=colors.map(()=>[0,0,0,0]);
    for(const p of points) {
      let best=0,d=Infinity;
      for(let c=0;c<colors.length;c++){const v=distance(p,colors[c]);if(v<d){d=v;best=c;}}
      lookup[p[4]]=best;const s=sums[best];for(let ch=0;ch<3;ch++)s[ch]+=p[ch]*p[3];s[3]+=p[3];
    }
    for(let c=0;c<colors.length;c++)if(sums[c][3])colors[c]=sums[c].slice(0,3).map(v=>v/sums[c][3]);
  }
  // Reassign after the last centroid update.
  for(const p of points){let best=0,d=Infinity;for(let c=0;c<colors.length;c++){const v=distance(p,colors[c]);if(v<d){d=v;best=c;}}lookup[p[4]]=best;}
  return {colors:colors.map(c=>c.map(Math.round)),lookup};
}

export function reconstruct(source, options, progress=()=>{}) {
  validateImage(source);
  const {width:sw,height:sh,data}=source;
  const {width,height,colors=48,coverage=0.5}=options;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>512||height>512||width>sw||height>sh)throw Error('Размер результата: от 1 до 512 px, без увеличения исходника.');
  if(!Number.isInteger(colors)||colors<2||colors>48||!Number.isFinite(coverage)||coverage<0.1||coverage>0.9)throw Error('Проверь палитру и порог прозрачности.');
  progress('Подбираю палитру…');
  const {colors:palette,lookup}=paletteFor(data,colors),k=palette.length;
  const result=new Uint8ClampedArray(width*height*4),nearest=new Uint8ClampedArray(result.length);
  const votes=new Float64Array(k),sums=new Float64Array(k*3);
  const sx=sw/width,sy=sh/height;
  for(let y=0;y<height;y++) {
    if(y%32===0)progress('Восстанавливаю пиксели…');
    const top=y*sy,bottom=(y+1)*sy;
    for(let x=0;x<width;x++) {
      votes.fill(0);sums.fill(0);let area=0,alpha=0;
      const left=x*sx,right=(x+1)*sx;
      for(let iy=Math.floor(top);iy<Math.ceil(bottom)&&iy<sh;iy++) {
        const wy=Math.min(iy+1,bottom)-Math.max(iy,top);
        for(let ix=Math.floor(left);ix<Math.ceil(right)&&ix<sw;ix++) {
          const wx=Math.min(ix+1,right)-Math.max(ix,left),w=wx*wy,i=(iy*sw+ix)*4;
          area+=w;const a=data[i+3]/255;alpha+=w*a;if(!a)continue;
          const cx=(Math.max(ix,left)+Math.min(ix+1,right))/2,cy=(Math.max(iy,top)+Math.min(iy+1,bottom))/2;
          const center=(1-2*Math.abs((cx-left)/sx-0.5))*(1-2*Math.abs((cy-top)/sy-0.5));
          const weight=w*a*(center+0.0001),label=lookup[key(data[i],data[i+1],data[i+2])];
          votes[label]+=weight;for(let c=0;c<3;c++)sums[label*3+c]+=weight*data[i+c];
        }
      }
      const out=(y*width+x)*4;
      if(alpha>0&&alpha/area>=coverage) {
        let winner=0;for(let c=1;c<k;c++)if(votes[c]>votes[winner])winner=c;
        const mean=[0,1,2].map(c=>sums[winner*3+c]/votes[winner]);
        let color=0,best=Infinity;for(let c=0;c<k;c++){const d=distance(mean,palette[c]);if(d<best){best=d;color=c;}}
        result.set([...palette[color],255],out);
      }
      const ni=(Math.min(sh-1,Math.floor((y+0.5)*sy))*sw+Math.min(sw-1,Math.floor((x+0.5)*sx)))*4;
      if(data[ni+3]>0&&data[ni+3]/255>=coverage)nearest.set([...palette[lookup[key(data[ni],data[ni+1],data[ni+2])]],255],out);
    }
  }
  const used=new Set();for(let i=0;i<result.length;i+=4)if(result[i+3])used.add((result[i]<<16)|(result[i+1]<<8)|result[i+2]);
  return {width,height,data:result,nearest,palette:[...used].map(v=>[(v>>16)&255,(v>>8)&255,v&255]),colors:used.size};
}

// Limited boundary/run-length detector: coherent gradients, NMS, multi-lag
// distances, cosine comb and fundamental support. Unlike upstream it does
// not use the FFT ensemble, median filtering or local drift integration.
function axisEstimate({width,height,data},vertical) {
  const length=vertical?height:width,lines=vertical?width:height;
  const hist=new Float64Array(257);let total=0;
  const sampleStride=Math.max(1,Math.floor(lines/192));
  const at=(line,pos)=>vertical?(pos*width+line)*4:(line*width+pos)*4;
  for(let line=0;line<lines;line+=sampleStride) {
    const gradient=new Float64Array(length);
    for(let p=1;p<length;p++) {
      let sum=0,n=0;
      for(let off=-2;off<=2;off++) {
        const l=line+off;if(l<0||l>=lines)continue;
        const a=at(l,p-1),b=at(l,p),aa=data[a+3]/255,ba=data[b+3]/255;
        for(let c=0;c<3;c++)sum+=Math.abs(data[a+c]*aa-data[b+c]*ba);
        sum+=Math.abs(data[a+3]-data[b+3]);n++;
      }
      gradient[p]=sum/n;
    }
    const peaks=[];
    for(let p=1;p<length-1;p++)if(gradient[p]>20&&gradient[p]>gradient[p-1]&&gradient[p]>=gradient[p+1]) {
      const denom=gradient[p-1]-2*gradient[p]+gradient[p+1];
      const offset=Math.abs(denom)>1e-6?Math.max(-0.5,Math.min(0.5,0.5*(gradient[p-1]-gradient[p+1])/denom)):0;
      peaks.push(p+offset);
    }
    for(let i=0;i<peaks.length;i++)for(let lag=1;lag<=4&&i+lag<peaks.length;lag++) {
      const d=peaks[i+lag]-peaks[i];if(d>=2&&d<=64){hist[Math.round(d*4)]++;total++;}
    }
  }
  if(total<50)return null;
  const score=s=>{let sum=0;for(let i=8;i<hist.length;i++)sum+=hist[i]*Math.cos(2*Math.PI*i/4/s);return sum/total;};
  const scored=[];for(let s=2.05;s<=26;s+=0.05)scored.push({step:s,score:score(s)});
  const peaks=scored.filter((p,i)=>i>0&&i<scored.length-1&&p.score>scored[i-1].score&&p.score>=scored[i+1].score).sort((a,b)=>b.score-a.score);
  if(!peaks.length||peaks[0].score<0.12)return null;
  const support=s=>{let sum=0;for(let i=8;i<hist.length;i++)if(Math.abs(i/4-s)<Math.max(.6,.18*s))sum+=hist[i];return sum/total;};
  const tied=peaks.filter(p=>p.score>=peaks[0].score*.7&&support(p.step)>=.04).sort((a,b)=>b.step-a.step);
  let best=tied[0]||peaks[0],fine=best;
  for(let s=best.step*.96;s<best.step*1.04;s+=.002){const v=score(s);if(v>fine.score)fine={step:s,score:v};}
  return {...fine,total};
}

export function detectGrid(source) {
  validateImage(source);
  const x=axisEstimate(source,false),y=axisEstimate(source,true);
  if(!x||!y)return {reliable:false,message:'Уверенная сетка не найдена. Если PNG уже в настоящих пикселях, оставь его размер.'};
  const close=Math.abs(Math.log(x.step/y.step))<.15;
  const step=Math.sqrt(x.step*y.step),width=Math.max(1,Math.round(source.width/step)),height=Math.max(1,Math.round(source.height/step));
  const reliable=close&&Math.min(x.score,y.score)>.35;
  return {width,height,step:Number(step.toFixed(2)),reliable,scores:[x.score,y.score],message:reliable?'Сетка выглядит регулярной. Проверь лицо и контур.':'Сетка неоднородная: это только пробный размер. Сравни детали.'};
}
