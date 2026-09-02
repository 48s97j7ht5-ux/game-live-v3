import{W,H,makeLayer}from'#pixel-app';

const FORMAT='pixel-lab-project';
const VERSION=1;
const MAX_PROJECT_BYTES=50*1024*1024;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);

function hasPixels(canvas){
  if(!canvas)return false;
  const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  for(let i=3;i<data.length;i+=4)if(data[i])return true;
  return false;
}

function decodeImage(source){
  return new Promise((resolve,reject)=>{
    if(typeof source!=='string'||!source.startsWith('data:image/png;base64,')){reject(new Error('повреждены пиксели слоя'));return}
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('не удалось прочитать PNG внутри проекта'));image.src=source;
  });
}

async function restoreLayer(record,index){
  const image=await decodeImage(record?.png);
  const layer=makeLayer(record?.name||'Слой',{id:record?.id,parentId:record?.parentId,slot:record?.slot||record?.id,z:Number.isFinite(record?.z)?record.z:index*10,visible:record?.visible!==false,locked:record?.locked===true,opacity:Number.isFinite(record?.opacity)?clamp(record.opacity,0,1):1});
  if(record?.itemMeta&&typeof record.itemMeta==='object')layer.itemMeta=record.itemMeta;
  const ctx=layer.canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);ctx.drawImage(image,0,0,W,H);return layer;
}

function downloadProject(project){
  const stamp=new Date().toISOString().slice(0,16).replace(/[-:T]/g,'');
  const url=URL.createObjectURL(new Blob([JSON.stringify(project)],{type:'application/json'}));
  const link=document.createElement('a');link.download='pixel-lab-'+stamp+'.pixelproject';link.href=url;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default{
  id:'project-io',
  mount(app){
    const input=document.getElementById('projectFile'),openButton=document.getElementById('openProject'),saveButton=document.getElementById('saveProject');
    function serialize(){
      const active=app.layers.active(),source=app.referenceMagic?.sourceCanvas?.()||document.getElementById('ref');
      const reference=hasPixels(source)?{png:source.toDataURL('image/png'),visible:app.referenceVisibility?.visible!==false,raw:app.referenceDisplay?.raw===true,dimAlpha:app.referenceDisplay?.dimAlpha??.25,magic:app.referenceMagic?.enabled===true}:null;
      return{format:FORMAT,version:VERSION,width:W,height:H,savedAt:new Date().toISOString(),state:{activeLayerId:active?.id||null,color:app.state.color,activeTool:app.state.activeTool,cx:app.state.cx,cy:app.state.cy,loupeSize:+document.getElementById('loupeSize')?.value||15,tapOnly:document.getElementById('tapOnly')?.checked!==false,background:app.backgroundToggle?.mode||'magenta'},groups:(app.state.layerGroups||[]).map(group=>({id:group.id,name:group.name,parentId:group.parentId,visible:group.visible!==false,locked:group.locked===true,opacity:group.opacity??1,expanded:group.expanded!==false})),layers:(app.state.layers||[]).map(layer=>({id:layer.id,parentId:layer.parentId,name:layer.name,slot:layer.slot||layer.id,z:layer.z,visible:layer.visible!==false,locked:layer.locked===true,opacity:layer.opacity??1,itemMeta:layer.itemMeta||undefined,png:layer.canvas.toDataURL('image/png')})),reference};
    }
    function validate(project){
      if(!project||project.format!==FORMAT)throw new Error('это не проект Pixel Lab');
      if(project.version!==VERSION)throw new Error('версия проекта пока не поддерживается');
      if(project.width!==W||project.height!==H)throw new Error(`проект ${project.width}×${project.height}, редактор ${W}×${H}`);
      if(!Array.isArray(project.groups)||!Array.isArray(project.layers)||!project.layers.length)throw new Error('в проекте нет структуры или слоёв');
    }
    async function loadProject(project){
      validate(project);const restoredLayers=await Promise.all(project.layers.map((record,index)=>restoreLayer(record,index)));const referenceImage=project.reference?.png?await decodeImage(project.reference.png):null;
      app.state.layerGroups=project.groups.map(group=>({id:group.id,name:group.name||'Группа',parentId:group.parentId??null,visible:group.visible!==false,locked:group.locked===true,opacity:Number.isFinite(group.opacity)?clamp(group.opacity,0,1):1,expanded:group.expanded!==false}));app.state.layers=restoredLayers;
      const activeId=project.state?.activeLayerId,activeIndex=restoredLayers.findIndex(layer=>layer.id===activeId);app.state.activeLayer=activeIndex>=0?activeIndex:0;app.state.color=validColor(project.state?.color)?project.state.color:'#090404';app.state.cx=clamp(Number.isFinite(project.state?.cx)?Math.round(project.state.cx):67,0,W-1);app.state.cy=clamp(Number.isFinite(project.state?.cy)?Math.round(project.state.cy):200,0,H-1);app.state.undo=[];app.layers.validateStructure({repair:true,notify:true});
      const loupeSize=document.getElementById('loupeSize');if(loupeSize&&[...loupeSize.options].some(option=>+option.value===+project.state?.loupeSize))loupeSize.value=String(project.state.loupeSize);
      const tapOnly=document.getElementById('tapOnly');if(tapOnly)tapOnly.checked=project.state?.tapOnly!==false;if(validColor(app.state.color))app.emit('color:changed',app.state.color);if(app.tools.has(project.state?.activeTool))app.setTool(project.state.activeTool);
      app.referenceVisibility?.setVisible(project.reference?.visible!==false);app.referenceDisplay?.setDimAlpha(project.reference?.dimAlpha??.25);app.referenceDisplay?.setRaw(project.reference?.raw===true);app.backgroundToggle?.setMode(project.state?.background);if(referenceImage)app.referenceMagic?.loadSource?.(referenceImage,project.reference?.magic===true);else app.referenceMagic?.clearSource?.();
      app.emit('layers:changed');app.emit('composite:dirty');app.loupe?.draw();app.mobileLayout?.closeSheet?.();app.emit('status',`Проект открыт · ${restoredLayers.length} слоёв · ${W}×${H}`);return true;
    }
    async function loadFile(file){if(!file)return false;if(file.size>MAX_PROJECT_BYTES)throw new Error('файл проекта больше 50 МБ');let project;try{project=JSON.parse(await file.text())}catch{throw new Error('не удалось прочитать файл проекта')}return loadProject(project)}
    function save(){app.layers.validateStructure({repair:true,notify:true});const project=serialize();downloadProject(project);app.mobileLayout?.closeSheet?.();app.emit('status',`Проект сохранён · ${project.layers.length} слоёв · ${W}×${H}`);return project}
    function openPicker(){input?.click()}
    if(input)input.onchange=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{await loadFile(file)}catch(error){app.emit('status','Ошибка проекта: '+error.message)}};
    if(openButton)openButton.onclick=openPicker;if(saveButton)saveButton.onclick=save;app.projectIO={serialize,save,openPicker,loadFile,loadProject,format:FORMAT,version:VERSION};
  }
};
