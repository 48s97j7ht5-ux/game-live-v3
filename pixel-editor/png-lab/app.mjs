import {validateImage} from './engine.mjs';
const $=id=>document.getElementById(id);
let source=null,original=null,result=null,resultCanvas=null,nearestCanvas=null,worker=null;
let sourceName='kat-original',loading=false,loadVersion=0,region='full',box=null,holding=false,detected=null,fresh=false;
const params=['width','height','colors','coverage','aspect'];
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function controls(){const busy=!!worker||loading;for(const id of [...params,'detect','process','apply-grid'])$(id).disabled=busy||!source;$('cancel').hidden=!worker;$('download').disabled=busy||!fresh;document.querySelectorAll('[data-height]').forEach(b=>b.disabled=busy||!source);}
function cancel(){if(worker){worker.terminate();worker=null;controls();status('Обработка отменена.');}}
function stale(){fresh=false;$('stale').textContent=result?'· пересчитай':'';controls();}
function dimensions(axis){if(source&&$('aspect').checked){const ratio=source.width/source.height;if(axis==='height')$('width').value=Math.max(1,Math.round(Number($('height').value)*ratio));else $('height').value=Math.max(1,Math.round(Number($('width').value)/ratio));}stale();}
function bounds(image){let x0=image.width,y0=image.height,x1=-1,y1=-1;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.data[(y*image.width+x)*4+3]>127){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return x1<0?{x:0,y:0,w:image.width,h:image.height}:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
function makeCanvas(data,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),w,h),0,0);return c;}
async function decode(file){
  if(file.size>15_000_000)throw Error('Этот файл слишком большой. Выбери PNG до 15 МБ.');
  const header=new Uint8Array(await file.slice(0,8).arrayBuffer());
  if(header.join(',')!=='137,80,78,71,13,10,26,10')throw Error('Нужен именно PNG. Скриншот JPEG не подойдёт.');
  const url=URL.createObjectURL(file);
  try{const img=new Image();img.src=url;await img.decode();if(img.naturalWidth>4096||img.naturalHeight>4096||img.naturalWidth*img.naturalHeight>4_000_000)throw Error('Нужен PNG до 4 млн пикселей, со стороной не больше 4096 px.');const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const im=ctx.getImageData(0,0,c.width,c.height);const s={width:im.width,height:im.height,data:im.data};validateImage(s);return {source:s,canvas:c};}finally{URL.revokeObjectURL(url);}
}
async function loadFile(file,name){
  const version=++loadVersion;cancel();loading=true;controls();status('Читаю PNG…');
  try{const decoded=await decode(file);if(version!==loadVersion)return;source=decoded.source;original=decoded.canvas;sourceName=name.replace(/\.png$/i,'');result=null;resultCanvas=null;nearestCanvas=null;fresh=false;detected=null;box=bounds(source);region='full';$('zoom').value=1;selectRegion('full');$('filename').textContent=name;$('source-size').textContent=`${source.width} × ${source.height} px`;$('height').value=Math.min(208,source.height,Math.floor(512*source.height/source.width));$('height').value=Math.max(1,Number($('height').value));$('aspect').checked=true;dimensions('height');$('detection').hidden=true;$('palette').replaceChildren();$('result-info').textContent='Результат появится после обработки.';$('stale').textContent='';status('Исходник загружен. Выбери размер и собери пиксели.');draw();}catch(e){if(version===loadVersion)status(e.message||'Не удалось открыть PNG.',true);}finally{if(version===loadVersion){loading=false;controls();}}
}
async function loadSample(){const version=++loadVersion;cancel();loading=true;controls();status('Загружаю исходную Катю…');try{const response=await fetch('assets/kat-original.png');if(!response.ok)throw Error('Не удалось загрузить Катю. Можно открыть свой PNG.');const blob=await response.blob();if(version===loadVersion)await loadFile(blob,'kat-original.png');}catch(e){if(version===loadVersion){loading=false;controls();status(e.message,true);}}}
function run(kind){
  if(!source||loading)return;cancel();
  const options={width:Number($('width').value),height:Number($('height').value),colors:Number($('colors').value),coverage:Number($('coverage').value)};
  if(kind!=='detect')stale();
  try{worker=new Worker('./worker.mjs',{type:'module'});}catch{status('Не удалось запустить обработку в этом браузере.',true);controls();return;}
  const current=worker;controls();status(kind==='detect'?'Ищу повторяющуюся сетку…':'Подготавливаю обработку…');
  worker.onmessage=({data})=>{
    if(worker!==current)return;
    if(data.kind==='progress'){status(data.message);return;}
    current.terminate();worker=null;
    if(data.kind==='error')status(data.message,true);
    else if(data.kind==='detected'){
      detected=data.result;$('detection').hidden=false;
      $('detection-text').textContent=(detected.width?`Предположительно ${detected.width} × ${detected.height} px, шаг ${detected.step} px. `:'')+detected.message;
      $('apply-grid').hidden=!detected.width||detected.width>512||detected.height>512;
      status('Поиск завершён. Размер пока не изменён.');
    }else{
      result=data.result;fresh=true;resultCanvas=makeCanvas(result.data,result.width,result.height);nearestCanvas=makeCanvas(result.nearest,result.width,result.height);$('stale').textContent='';
      $('result-info').textContent=`${result.width} × ${result.height} px · ${result.colors} цветов · прозрачный PNG`;
      $('palette').replaceChildren(...result.palette.map(c=>{const s=document.createElement('span');s.className='swatch';s.style.backgroundColor=`rgb(${c.join(',')})`;s.title='#'+c.map(n=>n.toString(16).padStart(2,'0')).join('');return s;}));
      status('Готово. Сравни лицо, кисти и обе икры.');draw();
    }
    controls();
  };
  worker.onerror=()=>{if(worker!==current)return;current.terminate();worker=null;controls();status('Не удалось завершить обработку. Попробуй меньший PNG.',true);};
  worker.postMessage({kind,source,options});
}
function selectRegion(value){region=value;holding=false;$('zoom').value=1;$('zoom-label').textContent='1×';document.querySelectorAll('[data-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===value)));draw();}
function crop(){
  let b={...box};const ranges={face:[0,.28],hands:[.43,.64],calves:[.67,.94]};
  if(ranges[region]){const [a,z]=ranges[region];b.y=box.y+box.h*a;b.h=box.h*(z-a);}
  const zoom=Number($('zoom').value);b.x+=b.w/2;b.y+=b.h/2;b.w=b.w*1.12/zoom;b.h=b.h*1.06/zoom;b.x-=b.w/2;b.y-=b.h/2;return b;
}
function render(canvas,input,b){
  const w=Math.max(1,Math.round(canvas.clientWidth*devicePixelRatio)),h=Math.max(1,Math.round(canvas.clientHeight*devicePixelRatio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);if(!input||!source)return;ctx.imageSmoothingEnabled=false;
  const scale=Math.min(w/b.w,h/b.h),ox=(w-b.w*scale)/2,oy=(h-b.h*scale)/2;
  ctx.drawImage(input,ox-b.x*scale,oy-b.y*scale,source.width*scale,source.height*scale);
}
function draw(){if(!source||!box)return;const b=crop();render($('before'),$('left-view').value==='nearest'?nearestCanvas:original,b);render($('after'),holding?original:resultCanvas,b);}
async function download(){if(!fresh||!resultCanvas)return;const c=resultCanvas;const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob){status('Не удалось сохранить PNG.',true);return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${sourceName.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60)||'sprite'}_lab_${c.width}x${c.height}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('file').onchange=event=>{const file=event.target.files[0];event.target.value='';if(file)loadFile(file,file.name);};
$('sample').onclick=loadSample;$('process').onclick=()=>run('process');$('detect').onclick=()=>run('detect');$('cancel').onclick=cancel;$('download').onclick=download;
$('width').oninput=()=>dimensions('width');$('height').oninput=()=>dimensions('height');$('aspect').onchange=()=>dimensions('height');$('colors').onchange=stale;$('coverage').onchange=stale;
$('apply-grid').onclick=()=>{if(!detected?.width)return;$('width').value=detected.width;$('height').value=detected.height;stale();run('process');};
document.querySelectorAll('[data-height]').forEach(b=>b.onclick=()=>{$('height').value=b.dataset.height;dimensions('height');});
document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>selectRegion(b.dataset.region));
$('left-view').onchange=()=>{$('left-caption').textContent=$('left-view').selectedOptions[0].textContent;draw();};
$('background').onchange=()=>{$('panes').className='panes '+$('background').value;};
$('zoom').oninput=()=>{$('zoom-label').textContent=$('zoom').value+'×';draw();};
$('hold').onpointerdown=e=>{e.preventDefault();$('hold').setPointerCapture(e.pointerId);holding=true;draw();};
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('hold').addEventListener(event,()=>{holding=false;draw();});
$('hold').onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();holding=true;draw();}};$('hold').onkeyup=()=>{holding=false;draw();};$('hold').onblur=()=>{holding=false;draw();};
window.addEventListener('resize',draw);new ResizeObserver(draw).observe($('panes'));
loadSample().then(()=>{if(source&&!worker)run('process');});
