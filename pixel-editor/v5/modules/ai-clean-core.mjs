const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const colorKey=(r,g,b)=>((r>>3)<<10)|((g>>3)<<5)|(b>>3);
const colorDistance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;

function buildPalette(data,limit){
  const bins=new Map();
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]===0)continue;
    const key=colorKey(data[i],data[i+1],data[i+2]);
    let bin=bins.get(key);
    if(!bin){bin=[0,0,0,0,key];bins.set(key,bin)}
    bin[0]+=data[i];bin[1]+=data[i+1];bin[2]+=data[i+2];bin[3]++;
  }
  const points=[...bins.values()].map(bin=>[bin[0]/bin[3],bin[1]/bin[3],bin[2]/bin[3],bin[3],bin[4]]).sort((a,b)=>b[3]-a[3]||a[4]-b[4]);
  if(points.length<=limit)return null;
  const colors=[points[0].slice(0,3)],nearest=new Float64Array(points.length).fill(Infinity);
  while(colors.length<limit){
    let pick=0,score=-1;
    for(let i=0;i<points.length;i++){
      nearest[i]=Math.min(nearest[i],colorDistance(points[i],colors.at(-1)));
      const next=nearest[i]*Math.sqrt(points[i][3]);
      if(next>score){score=next;pick=i}
    }
    if(score<1)break;
    colors.push(points[pick].slice(0,3));
  }
  for(let pass=0;pass<5;pass++){
    const sums=colors.map(()=>[0,0,0,0]);
    for(const point of points){
      let best=0,distance=Infinity;
      for(let i=0;i<colors.length;i++){
        const next=colorDistance(point,colors[i]);
        if(next<distance){distance=next;best=i}
      }
      const sum=sums[best],weight=point[3];
      sum[0]+=point[0]*weight;sum[1]+=point[1]*weight;sum[2]+=point[2]*weight;sum[3]+=weight;
    }
    for(let i=0;i<colors.length;i++)if(sums[i][3])colors[i]=sums[i].slice(0,3).map(value=>value/sums[i][3]);
  }
  const lookup=new Uint8Array(32768);
  for(const point of points){
    let best=0,distance=Infinity;
    for(let i=0;i<colors.length;i++){
      const next=colorDistance(point,colors[i]);
      if(next<distance){distance=next;best=i}
    }
    lookup[point[4]]=best;
  }
  return{colors:colors.map(color=>color.map(Math.round)),lookup};
}

function applyPalette(data,limit){
  const palette=buildPalette(data,limit);
  if(!palette)return;
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]===0)continue;
    const color=palette.colors[palette.lookup[colorKey(data[i],data[i+1],data[i+2])]];
    data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];
  }
}

function visibleColors(data){
  const colors=new Set();
  for(let i=0;i<data.length;i+=4)if(data[i+3])colors.add((data[i]<<16)|(data[i+1]<<8)|data[i+2]);
  return colors.size;
}

function despeckleColors(data,width,height,strength){
  const source=new Uint8ClampedArray(data),minimumSupport=strength>=70?3:4;
  let changed=0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x,q=i*4;
    if(source[q+3]===0)continue;
    const colors=new Map();
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(dx===0&&dy===0)continue;
      const n=((y+dy)*width+x+dx)*4;
      if(source[n+3]===0)continue;
      const key=(source[n]<<16)|(source[n+1]<<8)|source[n+2];
      colors.set(key,(colors.get(key)||0)+1);
    }
    if(!colors.size)continue;
    const current=(source[q]<<16)|(source[q+1]<<8)|source[q+2],winner=[...colors].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
    if(winner[0]===current||winner[1]<minimumSupport||(colors.get(current)||0)>1)continue;
    data[q]=(winner[0]>>16)&255;data[q+1]=(winner[0]>>8)&255;data[q+2]=winner[0]&255;changed++;
  }
  return changed;
}

function neighborIndexes(x,y,width,height){
  const indexes=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(dx===0&&dy===0)continue;
    const nx=x+dx,ny=y+dy;
    if(nx>=0&&ny>=0&&nx<width&&ny<height)indexes.push(ny*width+nx);
  }
  return indexes;
}

function sampledConfidence(mask,maskWidth,maskHeight,x,y,width,height){
  if(!mask?.length||!maskWidth||!maskHeight)return 1;
  const mx=Math.min(maskWidth-1,Math.floor((x+.5)*maskWidth/width));
  const my=Math.min(maskHeight-1,Math.floor((y+.5)*maskHeight/height));
  return mask[my*maskWidth+mx]??0;
}

export function cleanSprite(source,options={}){
  const {width,height}=source;
  if(!Number.isInteger(width)||!Number.isInteger(height)||source.data?.length!==width*height*4)throw Error('Некорректные пиксели слоя');
  const rawStrength=Number(options.strength),strength=clamp(Number.isFinite(rawStrength)?rawStrength:45,0,100);
  const data=new Uint8ClampedArray(source.data),beforeColors=visibleColors(data),count=width*height;
  const alphaThreshold=Math.round(24+strength*1.04),solid=new Uint8Array(count),originalSolid=new Uint8Array(count);
  let occupied=0;
  for(let i=0;i<count;i++){
    const alpha=data[i*4+3];
    originalSolid[i]=alpha>=alphaThreshold?1:0;
    solid[i]=originalSolid[i];
    occupied+=originalSolid[i];
  }

  const neural=options.neuralMask;
  const neuralThreshold=.08+strength*.0018;
  let neuralRecall=0,neuralApplied=false;
  if(neural?.data?.length&&occupied){
    let remembered=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x;
      if(originalSolid[i]&&sampledConfidence(neural.data,neural.width,neural.height,x,y,width,height)>=neuralThreshold)remembered++;
    }
    neuralRecall=remembered/occupied;
    if(neuralRecall>=.68){
      neuralApplied=true;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const i=y*width+x;
        if(solid[i]&&sampledConfidence(neural.data,neural.width,neural.height,x,y,width,height)<neuralThreshold)solid[i]=0;
      }
    }
  }

  const removeBelow=strength>=70?2:1,cleaned=new Uint8Array(solid);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,neighbors=neighborIndexes(x,y,width,height),near=neighbors.reduce((sum,index)=>sum+solid[index],0);
    if(solid[i]&&near<=removeBelow)cleaned[i]=0;
    else if(!solid[i]&&near>=7){
      cleaned[i]=1;
      const colors=new Map();
      for(const index of neighbors)if(solid[index]){
        const q=index*4,key=(data[q]<<16)|(data[q+1]<<8)|data[q+2];
        colors.set(key,(colors.get(key)||0)+1);
      }
      const winner=[...colors].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]??0,q=i*4;
      data[q]=(winner>>16)&255;data[q+1]=(winner>>8)&255;data[q+2]=winner&255;
    }
  }

  let removed=0,filled=0;
  for(let i=0;i<count;i++){
    const q=i*4;
    if(cleaned[i]){if(!originalSolid[i])filled++;data[q+3]=255}
    else{if(originalSolid[i])removed++;data[q]=0;data[q+1]=0;data[q+2]=0;data[q+3]=0}
  }
  const paletteLimit=options.paletteLimit===false?0:clamp(Number(options.paletteLimit)||64,2,256);
  if(paletteLimit)applyPalette(data,paletteLimit);
  const colorChanged=despeckleColors(data,width,height,strength);
  return{width,height,data,stats:{beforeColors,afterColors:visibleColors(data),removed,filled,colorChanged,neuralApplied,neuralRecall}};
}
