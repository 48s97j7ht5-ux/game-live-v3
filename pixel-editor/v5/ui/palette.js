function hexRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
function rgbHex(r,g,b){return'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}
function expandShades(anchors,count=20){
  if(!anchors.length||count<=0)return[];
  if(anchors.length===1)return Array(count).fill(anchors[0]);
  const out=[];
  for(let i=0;i<count;i++){
    const t=i/(count-1)*(anchors.length-1),a=Math.floor(t),b=Math.min(anchors.length-1,a+1),f=t-a;
    const c0=hexRgb(anchors[a]),c1=hexRgb(anchors[b]);
    out.push(rgbHex(c0[0]+(c1[0]-c0[0])*f,c0[1]+(c1[1]-c0[1])*f,c0[2]+(c1[2]-c0[2])*f));
  }
  return [...new Set(out)];
}
const BASE_FAMILIES=[
  {id:'gray',base:'#808080',label:'Серый',count:8,anchors:['#090909','#1a1a1a','#303030','#464646','#5c5c5c','#737373','#8a8a8a','#adadad','#d1d1d1','#ffffff']},
  {id:'taupe',base:'#86716a',label:'Тёплый серый',count:8,anchors:['#100e0e','#272222','#3f3735','#554a46','#6d5d57','#86716a','#a0867c','#b89a8d','#ceb0a1','#e3c9ba','#f4dfd3']},
  {id:'brown',base:'#8b5a2b',label:'Коричневый',count:8,anchors:['#1f120b','#321d12','#452817','#5a3620','#6b4026','#7f4e2f','#915b37','#ae7148']},
  {id:'skin-soft',base:'#dca886',label:'Кожа мягкая',count:8,anchors:['#6b4038','#865443','#a06454','#b97860','#d08f73','#dca886','#ebbb96','#f3c8a2','#f8d8b9','#fff0e4']},
  {id:'red',base:'#e53935',label:'Красный',count:6,anchors:['#3a0909','#521010','#6c1313','#8f1717','#a91c1c','#c92323','#df3030','#f15858','#f88989','#ffc1c1']},
  {id:'orange',base:'#f57c00',label:'Оранжевый',count:6,anchors:['#402000','#713800','#a04d00','#d96a00','#ff9635','#ffb56a','#ffd5a5']},
  {id:'skin-gold',base:'#fab791',label:'Кожа тёплая',count:8,anchors:['#6e392d','#8f4c38','#ad6247','#c97958','#df8f68','#ed9f78','#f7ad84','#fab791','#ffc7a6','#ffd9bf']},
  {id:'yellow',base:'#fbc02d',label:'Жёлтый',count:6,anchors:['#3b3100','#514300','#675500','#7c6700','#917800','#aa8e00','#c6a800','#f5db49','#ffeb80','#fff5b8']},
  {id:'green',base:'#43a047',label:'Зелёный',count:6,anchors:['#092d12','#0d4019','#115221','#156429','#19752e','#208837','#299c41','#65cc72','#91e09a','#c3f4c8']},
  {id:'cyan',base:'#00acc1',label:'Cyan',count:6,anchors:['#00353b','#004953','#005d68','#00717f','#008493','#0099aa','#00aabd','#59dce7','#91ebf1','#c5f7fa']},
  {id:'blue',base:'#1e88e5',label:'Синий',count:6,anchors:['#071d3d','#0a2954','#0d356a','#11417f','#144d98','#185aad','#1b67c5','#5ca1ef','#8fc0f7','#c5e0fc']},
  {id:'purple',base:'#8e44ad',label:'Фиолетовый',count:6,anchors:['#250d32','#341244','#42185a','#511d6d','#60227f','#702892','#7d2fa1','#b76bd0','#d19ae1','#eac8f1']},
  {id:'pink',base:'#e84393',label:'Розовый',count:6,anchors:['#3b0b25','#511033','#671341','#7e184f','#941c5f','#aa226d','#be287a','#ed70ad','#f39bc5','#fac7de']}
];
const FAMILIES=BASE_FAMILIES.map(f=>{
  const shades=expandShades(f.anchors,f.count||20);
  return{...f,ramps:[{id:f.id,shades}],shades};
});
export default{
  id:'palette',
  mount(app){
    const box=document.getElementById('palette'),custom=document.getElementById('customColor');
    if(!box||!custom)return;
    box.innerHTML='';
    box.classList.add('paletteFamilyUi');
    const families=document.createElement('div');families.className='paletteFamilies';
    const shades=document.createElement('div');shades.className='paletteShades';
    box.append(families,shades);
    let activeFamily='gray';

    function chooseColor(c){app.state.color=c;custom.value=c;app.emit('color:changed',c);markShade()}
    function markShade(){shades.querySelectorAll('.paletteShade').forEach(b=>b.classList.toggle('activeBtn',b.dataset.color.toLowerCase()===(app.state.color||'').toLowerCase()))}
    function renderShades(){
      shades.innerHTML='';
      const family=FAMILIES.find(f=>f.id===activeFamily)||FAMILIES[0];
      shades.dataset.count=String(family.shades.length);
      for(const c of family.shades){const b=document.createElement('button');b.type='button';b.className='sw paletteShade';b.dataset.color=c;b.style.background=c;b.title=c;b.setAttribute('aria-label',family.label+' '+c);b.onclick=()=>chooseColor(c);shades.appendChild(b)}
      markShade();
    }
    function selectFamily(id){activeFamily=id;families.querySelectorAll('.paletteFamily').forEach(b=>b.classList.toggle('activeBtn',b.dataset.family===id));renderShades()}
    for(const f of FAMILIES){
      const b=document.createElement('button');b.type='button';b.className='sw paletteFamily';b.dataset.family=f.id;b.style.background=f.base;b.title=f.label;b.setAttribute('aria-label',f.label);b.onclick=()=>selectFamily(f.id);families.appendChild(b)
    }
    document.getElementById('useCustom').onclick=()=>chooseColor(custom.value);
    app.on('color:changed',c=>{custom.value=c;markShade()});
    app.palette={families:FAMILIES,selectFamily,get activeFamily(){return activeFamily}};
    selectFamily(activeFamily);
  }
};