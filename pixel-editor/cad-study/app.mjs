const $=s=>document.querySelector(s);
const state={size:'208',palette:'48',region:'all',method:'nearest',zoom:1,background:'light',hold:false};
const cache=new Map();let current=null,meta=null,serial=0;
const sourceURL='../png-lab/assets/kat-original.png';
const names={nearest:'Обычное уменьшение',area:'Усреднение',source:'Исходник'};
function load(url){if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>{cache.delete(url);reject(Error('Не удалось загрузить PNG. Обнови страницу.'));};i.src=url;}));return cache.get(url);}
const path=method=>method==='source'?sourceURL:`assets/${state.size}-${method}-${state.palette}.png`;
const regions={all:[245,0,500,1536],face:[305,35,405,490],hands:[260,650,470,320],calves:[280,910,450,626]};
function draw(canvas,img){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,3);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  ctx.fillStyle={light:'#eee9df',dark:'#252a32',pink:'#ff00dc',checker:'#bac1c1'}[state.background];ctx.fillRect(0,0,canvas.width,canvas.height);
  if(state.background==='checker'){ctx.fillStyle='#e2e6e2';const s=12*dpr;for(let y=0;y<canvas.height;y+=s)for(let x=0;x<canvas.width;x+=s)if((Math.round(x/s)+Math.round(y/s))%2)ctx.fillRect(x,y,s,s);}
  const [x,y,w,h]=regions[state.region],scale=Math.min(canvas.width/w,canvas.height/h)*state.zoom;
  ctx.drawImage(img,x/1024*img.width,y/1536*img.height,w/1024*img.width,h/1536*img.height,(canvas.width-w*scale)/2,(canvas.height-h*scale)/2,w*scale,h*scale);
}
function render(){if(!current)return;draw($('#left'),current.left);draw($('#right'),state.hold?current.source:current.right);}
async function update(){
  const id=++serial;$('#status').textContent='Загружаю сравнение…';
  for(const a of document.querySelectorAll('.downloads a'))a.setAttribute('aria-disabled','true');
  try{
    const urls=[path(state.method),path('adaptive'),sourceURL];
    const [left,right,source]=await Promise.all(urls.map(load));if(id!==serial)return;
    current={left,right,source};$('#left-label').textContent=names[state.method];render();
    const data=meta.results[state.size];
    $('#status').textContent=`${data.width} × ${data.height} · ${state.palette==='48'?'общая палитра из 48 цветов':'без ограничения палитры'}`;
    $('#details').textContent=`В адаптивном PNG: ${data.colors['adaptive-'+state.palette]} цветов. ${data.metrics.iterations} итераций. ${data.metrics.converged?'Достигнут критерий остановки.':'Достигнут лимит итераций; сходимость не подтверждена.'}`;
    for(const [selector,url] of [['#download',urls[1]],['#baseline',urls[0]]]){const a=$(selector);a.href=url;a.download=url.split('/').at(-1);a.setAttribute('aria-disabled','false');}
  }catch(e){if(id===serial)$('#status').textContent=e.message;}
}
for(const key of ['size','method'])$('#'+key).onchange=e=>{state[key]=e.target.value;update();};
for(const key of ['palette','region'])for(const b of document.querySelectorAll('[data-'+key+']'))b.onclick=()=>{
  state[key]=b.dataset[key];for(const n of document.querySelectorAll('[data-'+key+']')){const selected=n===b;n.classList.toggle('selected',selected);n.setAttribute('aria-pressed',String(selected));}
  if(key==='palette')update();else{state.zoom=1;$('#zoom').value=1;$('#zoom-label').textContent='1×';render();}
};
$('#background').onchange=e=>{state.background=e.target.value;render();};
$('#zoom').oninput=e=>{state.zoom=Number(e.target.value);$('#zoom-label').textContent=state.zoom+'×';render();};
const hold=$('#hold');const release=()=>{state.hold=false;render();};
hold.onpointerdown=e=>{hold.setPointerCapture(e.pointerId);state.hold=true;render();};
hold.onpointerup=hold.onpointercancel=hold.onlostpointercapture=release;
hold.oncontextmenu=e=>e.preventDefault();hold.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();state.hold=true;render();}};hold.onkeyup=hold.onblur=release;
new ResizeObserver(render).observe($('.comparison'));
try{const r=await fetch('assets/results.json');if(!r.ok)throw Error('Не удалось загрузить результаты.');meta=await r.json();await update();}catch(e){$('#status').textContent=e.message;}
