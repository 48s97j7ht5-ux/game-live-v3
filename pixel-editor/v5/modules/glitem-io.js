const FORMAT='game-live-item';
const VERSION=1;
const IMAGE_NAME='sprite.png';
const MANIFEST_NAME='manifest.json';
const MIME='application/vnd.game-live.item+zip';
const MAX_BYTES=60*1024*1024;
const encoder=new TextEncoder();
const decoder=new TextDecoder();

const safeName=value=>String(value||'item').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'')||'item';

let crcTable;
function crc32(bytes){
  if(!crcTable)crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
  let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;
}

function set16(view,offset,value){view.setUint16(offset,value,true)}
function set32(view,offset,value){view.setUint32(offset,value>>>0,true)}
function dosDateTime(date=new Date()){
  return{time:(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),date:((date.getFullYear()-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};
}

export function createStoredZip(records){
  const entries=records.map(record=>({name:encoder.encode(record.name),data:record.data instanceof Uint8Array?record.data:new Uint8Array(record.data)}));
  const now=dosDateTime(),locals=[],centrals=[];let offset=0;
  for(const entry of entries){
    const crc=crc32(entry.data),local=new Uint8Array(30+entry.name.length),lv=new DataView(local.buffer);
    set32(lv,0,0x04034b50);set16(lv,4,20);set16(lv,6,0x0800);set16(lv,8,0);set16(lv,10,now.time);set16(lv,12,now.date);
    set32(lv,14,crc);set32(lv,18,entry.data.length);set32(lv,22,entry.data.length);set16(lv,26,entry.name.length);set16(lv,28,0);local.set(entry.name,30);
    locals.push(local,entry.data);
    const central=new Uint8Array(46+entry.name.length),cv=new DataView(central.buffer);
    set32(cv,0,0x02014b50);set16(cv,4,20);set16(cv,6,20);set16(cv,8,0x0800);set16(cv,10,0);set16(cv,12,now.time);set16(cv,14,now.date);
    set32(cv,16,crc);set32(cv,20,entry.data.length);set32(cv,24,entry.data.length);set16(cv,28,entry.name.length);set16(cv,30,0);set16(cv,32,0);
    set16(cv,34,0);set16(cv,36,0);set32(cv,38,0);set32(cv,42,offset);central.set(entry.name,46);centrals.push(central);
    offset+=local.length+entry.data.length;
  }
  const centralSize=centrals.reduce((sum,part)=>sum+part.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
  set32(ev,0,0x06054b50);set16(ev,4,0);set16(ev,6,0);set16(ev,8,entries.length);set16(ev,10,entries.length);set32(ev,12,centralSize);set32(ev,16,offset);set16(ev,20,0);
  const total=offset+centralSize+end.length,out=new Uint8Array(total);let at=0;
  for(const part of[...locals,...centrals,end]){out.set(part,at);at+=part.length}return out;
}

export function readStoredZip(source){
  const bytes=source instanceof Uint8Array?source:new Uint8Array(source),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break}
  if(end<0)throw new Error('это не контейнер .glitem');
  const count=view.getUint16(end+10,true),centralOffset=view.getUint32(end+16,true);if(!count||count>32)throw new Error('неверное содержимое .glitem');
  const files=new Map();let at=centralOffset,total=0;
  for(let n=0;n<count;n++){
    if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw new Error('повреждён каталог .glitem');
    const method=view.getUint16(at+10,true),crc=view.getUint32(at+16,true),size=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extraLength=view.getUint16(at+30,true),commentLength=view.getUint16(at+32,true),localOffset=view.getUint32(at+42,true);
    if(method!==0)throw new Error('неподдерживаемое сжатие .glitem');
    const name=decoder.decode(bytes.slice(at+46,at+46+nameLength));
    if(localOffset+30>bytes.length||view.getUint32(localOffset,true)!==0x04034b50)throw new Error('повреждён файл внутри .glitem');
    const localName=view.getUint16(localOffset+26,true),localExtra=view.getUint16(localOffset+28,true),dataStart=localOffset+30+localName+localExtra,dataEnd=dataStart+size;
    if(dataEnd>bytes.length)throw new Error('обрезан файл внутри .glitem');
    const data=bytes.slice(dataStart,dataEnd);if(crc32(data)!==crc)throw new Error('контрольная сумма .glitem не совпала');
    total+=data.length;if(total>MAX_BYTES)throw new Error('.glitem слишком большой');files.set(name,data);at+=46+nameLength+extraLength+commentLength;
  }
  return files;
}

function canvasPng(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(async blob=>blob?resolve(new Uint8Array(await blob.arrayBuffer())):reject(new Error('PNG слоя не удалось создать')),'image/png'));
}
function decodePng(bytes){
  return new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'})),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('PNG внутри .glitem повреждён'))};image.src=url});
}
function download(bytes,name){
  const url=URL.createObjectURL(new Blob([bytes],{type:MIME})),link=document.createElement('a');link.download=name;link.href=url;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default{
  id:'glitem-io',
  mount(app){
    const input=document.getElementById('glItemFile'),openButton=document.getElementById('openGlItem'),saveButton=document.getElementById('saveGlItem');

    async function build(){
      const layer=app.layers.active();if(!layer){app.emit('status','Сначала выберите слой');return null}
      const now=new Date().toISOString(),old=layer.itemMeta&&typeof layer.itemMeta==='object'?layer.itemMeta:{};
      const manifest={...old,format:FORMAT,version:VERSION,id:old.id||layer.id,name:old.name||app.layerLabels?.get(layer.name)||layer.name,kind:old.kind||'sprite',slot:layer.slot||layer.id,tags:Array.isArray(old.tags)?old.tags:[],image:IMAGE_NAME,canvas:{width:layer.canvas.width,height:layer.canvas.height},layer:{id:layer.id,parentId:layer.parentId,z:layer.z},createdAt:old.createdAt||now,updatedAt:now};
      layer.itemMeta=manifest;
      const bytes=createStoredZip([{name:MANIFEST_NAME,data:encoder.encode(JSON.stringify(manifest,null,2))},{name:IMAGE_NAME,data:await canvasPng(layer.canvas)}]);
      return{manifest,bytes,fileName:`${safeName(manifest.id)}.glitem`,layer};
    }

    async function save(){
      const item=await build();if(!item)return null;
      download(item.bytes,item.fileName);app.mobileLayout?.closeSheet?.();app.emit('status',`.glitem сохранён · ${app.layers.pathLabel(item.layer)}`);return item;
    }

    async function loadFile(file){
      if(!file)return false;if(file.size>MAX_BYTES)throw new Error('файл больше 60 МБ');
      const files=readStoredZip(await file.arrayBuffer()),manifestBytes=files.get(MANIFEST_NAME),png=files.get(IMAGE_NAME);
      if(!manifestBytes||!png)throw new Error('нужны manifest.json и sprite.png');
      let manifest;try{manifest=JSON.parse(decoder.decode(manifestBytes))}catch{throw new Error('manifest.json повреждён')}
      if(manifest?.format!==FORMAT||manifest?.version!==VERSION)throw new Error('версия .glitem не поддерживается');
      const image=await decodePng(png),width=app.layers.active()?.canvas?.width,height=app.layers.active()?.canvas?.height;
      if(image.naturalWidth!==width||image.naturalHeight!==height)throw new Error(`элемент ${image.naturalWidth}×${image.naturalHeight}, холст ${width}×${height}`);
      let target=app.state.layers.find(layer=>layer.id===manifest.layer?.id)||app.state.layers.find(layer=>layer.slot===manifest.slot)||app.layers.active();
      if(!target)throw new Error('слой для элемента не найден');if(!app.layers.canEdit(target))return false;
      app.history.push();const ctx=target.canvas.getContext('2d');ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0);target.itemMeta=manifest;
      app.layers.setActive(app.state.layers.indexOf(target));app.emit('layers:changed');app.emit('composite:dirty');app.loupe?.draw();app.mobileLayout?.closeSheet?.();
      app.emit('status',`.glitem загружен · ${manifest.name||manifest.id} → ${app.layers.pathLabel(target)}`);return true;
    }

    function openPicker(){if(input){input.value='';input.click()}}
    if(input)input.onchange=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{await loadFile(file)}catch(error){app.emit('status','Ошибка .glitem: '+error.message)}};
    if(openButton)openButton.onclick=openPicker;
    if(saveButton)saveButton.onclick=()=>save().catch(error=>app.emit('status','Ошибка .glitem: '+error.message));
    app.glItemIO={build,save,loadFile,openPicker,format:FORMAT,version:VERSION};
  }
};
