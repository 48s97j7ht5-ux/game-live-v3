import{W,H,makeLayer}from'../core/app.js?v=20260902-layer-schema1';

const colorKey=(data,q)=>(data[q]<<16)|(data[q+1]<<8)|data[q+2];
const saturation=key=>Math.max((key>>16)&255,(key>>8)&255,key&255)-Math.min((key>>16)&255,(key>>8)&255,key&255);

function edgeBackground(image){
  const{data,width,height}=image,counts=new Map();let opaque=0,transparent=0,minX=width,minY=height,maxX=-1,maxY=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=16){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
  if(maxX<0)return{transparent:true,key:null};
  const count=(x,y)=>{const q=(y*width+x)*4;if(data[q+3]<16){transparent++;return}opaque++;const key=colorKey(data,q);counts.set(key,(counts.get(key)||0)+1)};
  for(let x=minX;x<=maxX;x++){count(x,minY);if(maxY>minY)count(x,maxY)}
  for(let y=minY+1;y<maxY;y++){count(minX,y);if(maxX>minX)count(maxX,y)}
  if(transparent>=opaque)return{transparent:true,key:null};
  let key=null,best=0;for(const[item,n]of counts)if(n>best){key=item;best=n}
  return{transparent:false,key,confidence:opaque?best/opaque:0};
}

function removeEdgeBackground(image,key,tolerance){
  const{data,width,height}=image,total=width*height,seen=new Uint8Array(total),queue=new Int32Array(total);let head=0,tail=0,removed=0;
  const br=(key>>16)&255,bg=(key>>8)&255,bb=key&255,limit=tolerance*tolerance;
  const matches=index=>{const q=index*4;if(data[q+3]<16)return true;const dr=data[q]-br,dg=data[q+1]-bg,db=data[q+2]-bb;return dr*dr+dg*dg+db*db<=limit};
  const add=index=>{if(index<0||index>=total||seen[index]||!matches(index))return;seen[index]=1;queue[tail++]=index};
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x)}
  for(let y=1;y<height-1;y++){add(y*width);add(y*width+width-1)}
  while(head<tail){const i=queue[head++],q=i*4;if(data[q+3]>=16)removed++;data[q+3]=0;const x=i%width;if(x)add(i-1);if(x<width-1)add(i+1);if(i>=width)add(i-width);if(i<total-width)add(i+width)}
  return removed;
}

export default{
  id:'reference-to-body',
  mount(app){
    const desktopButton=document.getElementById('refToBody');
    function ensureLayer(){
      let layer=app.state.layers.find(item=>item.id==='body_base');if(layer)return layer;
      const parentId=app.layers.group('body')?.id||app.state.layerGroups[0]?.id||null;
      layer=makeLayer('body_base',{id:'body_base',parentId,slot:'body_base',z:90});
      const at=app.state.layers.findIndex(item=>(item.z??Infinity)>90);app.state.layers.splice(at<0?app.state.layers.length:at,0,layer);return layer;
    }
    function apply(){
      const ref=document.getElementById('ref');if(!ref)return false;
      const source=ref.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);
      let visible=0;for(let i=3;i<source.data.length;i+=4)if(source.data[i]>=16)visible++;
      if(!visible){app.emit('status','Сначала загрузите подложку Ref');return false}
      const background=edgeBackground(source);let removed=0;
      if(!background.transparent){
        if(background.key==null||background.confidence<.55){app.emit('status','Фон Ref неоднородный — нужна одноцветная подложка');return false}
        if(saturation(background.key)<48){app.emit('status','Для безопасного удаления нужна цветная контрастная подложка');return false}
        removed=removeEdgeBackground(source,background.key,app.referenceMagic?.enabled?4:24);
      }
      const current=app.state.layers.find(item=>item.id==='body_base');if(current&&!app.layers.canEdit(current))return false;
      app.history.push();const layer=ensureLayer(),ctx=layer.canvas.getContext('2d');ctx.clearRect(0,0,W,H);ctx.putImageData(source,0,0);
      app.layers.setActive(app.state.layers.indexOf(layer));app.emit('layers:changed');app.emit('composite:dirty');app.loupe?.draw();app.mobileLayout?.closeSheet?.();
      app.emit('status',`Ref перенесён в Цельное тело${removed?' · фон удалён: '+removed+' px':' · прозрачный фон сохранён'}`);return true;
    }
    if(desktopButton)desktopButton.onclick=apply;
    app.referenceToBody={apply};
  }
};

export{edgeBackground,removeEdgeBackground};
