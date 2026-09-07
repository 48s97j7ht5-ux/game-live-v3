import {compose} from './compose.mjs';
const $=id=>document.getElementById(id), main=$('main'),ctx=main.getContext('2d');
const result=document.createElement('canvas');result.width=139;result.height=208;
const rctx=result.getContext('2d');let manifest,variants={},state,history=[];
function crop(canvas,data,rect){const [x,y,w,h]=rect;canvas.width=w;canvas.height=h;const temp=document.createElement('canvas');temp.width=139;temp.height=208;temp.getContext('2d').putImageData(new ImageData(data,139,208),0,0);const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(temp,x,y,w,h,0,0,w,h)}
function render(){const pixels=compose(manifest,variants,state);rctx.putImageData(new ImageData(pixels,139,208),0,0);ctx.clearRect(0,0,139,208);ctx.drawImage(result,0,0);const selected=$('region').value;
 if($('frames').checked){for(const r of manifest.regions){ctx.strokeStyle=r.id===selected?'#02dcff':'#ffffff88';ctx.lineWidth=1;ctx.strokeRect(r.rect[0]+.5,r.rect[1]+.5,r.rect[2]-1,r.rect[3]-1)}}
 const region=manifest.regions.find(r=>r.id===selected);let rect=[0,0,139,208];if(region){const [x,y,w,h]=region.rect;const l=Math.max(0,x-3),t=Math.max(0,y-3);rect=[l,t,Math.min(139,x+w+3)-l,Math.min(208,y+h+3)-t]}
 crop($('before'),variants.nearest,rect);crop($('after'),pixels,rect);
 for(const b of $('methods').children){b.classList.toggle('active',b.dataset.method===state[selected]);b.setAttribute('aria-pressed',b.dataset.method===state[selected])}
 $('undo').disabled=!history.length;$('status').textContent=`139 × 208 · до 48 цветов · ${region?region.name:'Основа'}: ${manifest.methods[state[selected]]}`;
}
function change(next){if(JSON.stringify(next)===JSON.stringify(state))return;history.push({...state});if(history.length>100)history.shift();state={...next};render()}
async function start(){const response=await fetch('assets/manifest.json');if(!response.ok)throw Error('manifest');manifest=await response.json();
 await Promise.all(Object.keys(manifest.methods).map(async id=>{const img=new Image();img.src=`assets/${id}.png`;await img.decode();if(img.width!==139||img.height!==208)throw Error('size');rctx.clearRect(0,0,139,208);rctx.drawImage(img,0,0);variants[id]=rctx.getImageData(0,0,139,208).data}));
 for(const r of manifest.regions){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;$('region').append(o)}
 for(const [id,name]of Object.entries(manifest.methods)){const b=document.createElement('button');b.textContent=name;b.dataset.method=id;b.onclick=()=>change({...state,[$('region').value]:id});$('methods').append(b)}
 state={...manifest.auto};$('region').value='face';$('region').onchange=render;$('frames').onchange=render;$('background').onchange=()=>{document.body.className=$('background').value};$('auto').onclick=()=>change(manifest.auto);$('undo').onclick=()=>{if(history.length){state=history.pop();render()}};
 main.onclick=e=>{const b=main.getBoundingClientRect(),x=(e.clientX-b.left)*139/b.width,y=(e.clientY-b.top)*208/b.height;const r=manifest.regions.find(({rect:[l,t,w,h]})=>x>=l&&x<l+w&&y>=t&&y<t+h);$('region').value=r?.id||'base';render()};
 $('save').disabled=false;$('save').onclick=()=>result.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='kat-hybrid-139x208.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)},'image/png');render();document.body.dataset.ready='true';}
start().catch(e=>{$('status').textContent='Не удалось загрузить варианты. Обнови страницу.';console.error(e)});
