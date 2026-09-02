import{makeLayer,W,H}from'./app.js?v=20260902-layer-schema1';

const GROUPS=[
  {id:'character',name:'Персонаж',parentId:null,expanded:true},
  {id:'body',name:'Тело',parentId:'character',expanded:true},
  {id:'head',name:'Голова',parentId:'body',expanded:true},
  {id:'face',name:'Лицо',parentId:'head',expanded:true},
  {id:'hair',name:'Волосы',parentId:'head',expanded:false},
  {id:'torso',name:'Торс',parentId:'body',expanded:true},
  {id:'arms',name:'Руки',parentId:'body',expanded:false},
  {id:'legs',name:'Ноги',parentId:'body',expanded:false},
  {id:'clothes',name:'Одежда',parentId:'character',expanded:true},
  {id:'underwear',name:'Нижнее бельё',parentId:'clothes',expanded:false},
  {id:'hosiery',name:'Чулочно-носочное',parentId:'clothes',expanded:false},
  {id:'clothes_underlayer',name:'Нательная одежда',parentId:'clothes',expanded:false},
  {id:'clothes_main',name:'Основная одежда',parentId:'clothes',expanded:true},
  {id:'clothes_upper',name:'Верх',parentId:'clothes_main',expanded:false},
  {id:'clothes_lower',name:'Низ',parentId:'clothes_main',expanded:false},
  {id:'clothes_onepiece',name:'Цельная вещь',parentId:'clothes_main',expanded:false},
  {id:'clothes_midlayer',name:'Дополнительная одежда',parentId:'clothes',expanded:false},
  {id:'clothes_outerwear',name:'Верхняя одежда',parentId:'clothes',expanded:false},
  {id:'footwear',name:'Обувь',parentId:'clothes',expanded:false},
  {id:'accessories',name:'Аксессуары',parentId:'character',expanded:false},
  {id:'accessories_head',name:'Голова',parentId:'accessories',expanded:false},
  {id:'accessories_face',name:'Лицо',parentId:'accessories',expanded:false},
  {id:'accessories_neck',name:'Шея',parentId:'accessories',expanded:false},
  {id:'accessories_hands',name:'Руки',parentId:'accessories',expanded:false},
  {id:'imports',name:'Импорт',parentId:null,expanded:true}
];

// Folder placement is only navigation. z is the independent render order.
const DEFAULT_LAYERS=[
  {id:'hair_back',parentId:'hair',slot:'hair_back',z:0},
  {id:'body_legs',parentId:'legs',slot:'body_legs',z:100},
  {id:'body_arms',parentId:'arms',slot:'body_arms',z:110},
  {id:'body_torso',parentId:'torso',slot:'body_torso',z:120},
  {id:'head_base',parentId:'head',slot:'head_base',z:130},
  {id:'body_details',parentId:'body',slot:'body_details',z:200},
  {id:'face_eyes',parentId:'face',slot:'face_eyes',z:300},
  {id:'face_brows',parentId:'face',slot:'face_brows',z:310},
  {id:'face_nose',parentId:'face',slot:'face_nose',z:320},
  {id:'face_mouth',parentId:'face',slot:'face_mouth',z:330},
  {id:'underwear_top',parentId:'underwear',slot:'bra',z:400},
  {id:'underwear_bottom',parentId:'underwear',slot:'underwear',z:410},
  {id:'hosiery_base',parentId:'hosiery',slot:'hosiery',z:500},
  {id:'socks_base',parentId:'hosiery',slot:'socks',z:510},
  {id:'undershirt_base',parentId:'clothes_underlayer',slot:'undershirt',z:600},
  {id:'clothes_lower_base',parentId:'clothes_lower',slot:'bottom',z:700},
  {id:'clothes_onepiece_base',parentId:'clothes_onepiece',slot:'onepiece',z:710},
  {id:'clothes_upper_base',parentId:'clothes_upper',slot:'top',z:720},
  {id:'clothes_midlayer_base',parentId:'clothes_midlayer',slot:'midlayer',z:800},
  {id:'clothes_outerwear_base',parentId:'clothes_outerwear',slot:'outerwear',z:900},
  {id:'footwear_base',parentId:'footwear',slot:'shoes',z:950},
  {id:'hair_front',parentId:'hair',slot:'hair_front',z:1000},
  {id:'headwear_base',parentId:'accessories_head',slot:'head',z:1100},
  {id:'eyewear_base',parentId:'accessories_face',slot:'eyes',z:1110},
  {id:'ear_accessories_base',parentId:'accessories_face',slot:'ears',z:1120},
  {id:'neck_accessories_base',parentId:'accessories_neck',slot:'neck',z:1130},
  {id:'handwear_base',parentId:'accessories_hands',slot:'hands',z:1140},
  {id:'wrist_accessories_base',parentId:'accessories_hands',slot:'wrist',z:1150},
  {id:'accessories_front',parentId:'accessories',slot:'accessory_front',z:1200}
];

const makeGroup=g=>({id:g.id,name:g.name,parentId:g.parentId,visible:true,locked:false,opacity:1,expanded:g.expanded!==false});
const groupId=(value,index)=>typeof value==='string'&&value.trim()?value.trim():'group_'+(index+1);
const layerId=(value,index)=>typeof value==='string'&&value.trim()?value.trim():'layer_'+(index+1);
const drawable=layer=>!!layer?.canvas&&typeof layer.canvas.getContext==='function';

export function installLayers(app){
  const api={
    init(){
      app.state.layerGroups=GROUPS.map(makeGroup);
      app.state.layers=DEFAULT_LAYERS.map(layer=>makeLayer(layer.id,layer));
      app.state.activeLayer=Math.max(0,app.state.layers.findIndex(l=>l.name==='body_torso'));
      app.state.layerValidation=this.validateStructure({repair:true,notify:false});
      app.emit('layers:changed');
    },
    active(){
      const layers=Array.isArray(app.state.layers)?app.state.layers:[];
      if(!drawable(layers[app.state.activeLayer]))app.state.activeLayer=Math.max(0,layers.findIndex(drawable));
      return layers[app.state.activeLayer];
    },
    group(id){return app.state.layerGroups.find(g=>g.id===id)},
    ancestors(parentId){const out=[],visited=new Set();let current=this.group(parentId);while(current&&!visited.has(current.id)){visited.add(current.id);out.push(current);current=this.group(current.parentId)}return out},
    validateStructure({repair=true,notify=true}={}){
      const issues=[];
      if(!Array.isArray(app.state.layerGroups)){issues.push('список групп отсутствовал');if(repair)app.state.layerGroups=[]}
      if(!Array.isArray(app.state.layers)){issues.push('список слоёв отсутствовал');if(repair)app.state.layers=[]}
      const groups=Array.isArray(app.state.layerGroups)?app.state.layerGroups:[];
      const usedGroups=new Set();
      groups.forEach((group,index)=>{if(!group||typeof group!=='object'){issues.push('восстановлена повреждённая группа '+(index+1));if(repair)groups[index]=makeGroup({id:'group_'+(index+1),name:'Группа '+(index+1),parentId:null,expanded:true})}});
      groups.forEach((group,index)=>{
        if(!group||typeof group!=='object')return;
        const wanted=groupId(group?.id,index);let id=wanted,suffix=2;
        while(usedGroups.has(id))id=wanted+'_'+suffix++;
        if(id!==group?.id){issues.push('исправлен ID группы '+(group?.name||index+1));if(repair)group.id=id}
        usedGroups.add(repair?id:group?.id);
      });
      const knownGroups=new Set(groups.filter(group=>group&&typeof group==='object').map(group=>group.id));
      groups.forEach(group=>{
        if(!group||typeof group!=='object')return;
        if(group.parentId===group.id||group.parentId!=null&&!knownGroups.has(group.parentId)){
          issues.push('исправлен родитель группы '+(group.name||group.id));if(repair)group.parentId=null;
        }
      });
      groups.forEach(group=>{
        if(!group||typeof group!=='object')return;
        const visited=new Set([group.id]);let current=group;
        while(current?.parentId!=null){
          if(visited.has(current.parentId)){issues.push('разорван цикл у группы '+(group.name||group.id));if(repair)group.parentId=null;break}
          visited.add(current.parentId);current=groups.find(item=>item.id===current.parentId);
        }
      });
      let fallback=groups.find(group=>group?.id==='body')||groups.find(group=>group?.id==='imports')||groups.find(group=>group&&typeof group==='object');
      if(!fallback&&repair){fallback=makeGroup({id:'drawing',name:'Рисунок',parentId:null,expanded:true});groups.push(fallback);knownGroups.add(fallback.id);issues.push('создана корневая группа для рисования')}
      const layers=Array.isArray(app.state.layers)?app.state.layers:[];
      const usedLayers=new Set();
      layers.forEach((layer,index)=>{if(!layer||typeof layer!=='object'){issues.push('восстановлен повреждённый слой '+(index+1));if(repair)layers[index]=makeLayer('Слой '+(index+1),{id:'layer_'+(index+1),parentId:fallback?.id||null})}});
      layers.forEach((layer,index)=>{
        if(!layer||typeof layer!=='object')return;
        const wanted=layerId(layer?.id,index);let id=wanted,suffix=2;
        while(usedLayers.has(id))id=wanted+'_'+suffix++;
        if(id!==layer?.id){issues.push('исправлен ID слоя '+(layer?.name||index+1));if(repair)layer.id=id}
        usedLayers.add(repair?id:layer?.id);
        if(!knownGroups.has(layer?.parentId)){issues.push('слой '+(layer?.name||id)+' перенесён в доступную группу');if(repair)layer.parentId=fallback?.id||null}
        if(!drawable(layer)){issues.push('восстановлен холст слоя '+(layer?.name||id));if(repair)layer.canvas=makeLayer('recovered').canvas}
      });
      if(!layers.length&&repair){layers.push(makeLayer('drawing_layer',{id:'drawing_layer',parentId:fallback?.id||null}));issues.push('создан первый рисуемый слой')}
      if(!Number.isInteger(app.state.activeLayer)||!drawable(layers[app.state.activeLayer])){
        issues.push('восстановлен активный рисуемый слой');
        if(repair)app.state.activeLayer=Math.max(0,layers.findIndex(drawable));
      }
      const report={ok:issues.length===0,repaired:repair&&issues.length>0,issues};
      app.state.layerValidation=report;
      if(report.repaired){console.warn('Layer structure repaired:',issues);if(notify)app.emit('status','Структура слоёв исправлена: '+issues.join('; '))}
      return report;
    },
    isVisible(layer){return !!layer&&layer.visible!==false&&this.ancestors(layer.parentId).every(g=>g.visible!==false)},
    isLocked(layer){return !layer||layer.locked===true||this.ancestors(layer.parentId).some(g=>g.locked===true)},
    canEdit(layer=this.active(),notify=true){
      let message='';
      if(!layer)message='Сначала выберите слой для рисования';
      else if(this.isLocked(layer))message='Слой или его группа заблокированы';
      else if(!this.isVisible(layer))message='Слой или его группа скрыты';
      if(message&&notify)app.emit('status',message);
      return !message;
    },
    effectiveOpacity(layer){return Math.max(0,Math.min(1,(layer?.opacity??1)*this.ancestors(layer?.parentId).reduce((value,g)=>value*(g.opacity??1),1)))},
    renderLayers(){return app.state.layers.map((layer,index)=>({layer,index})).sort((a,b)=>(a.layer.z??a.index*10)-(b.layer.z??b.index*10)||a.index-b.index).map(item=>item.layer)},
    pathLabel(layer){const groups=this.ancestors(layer?.parentId).reverse().filter(g=>g.id!=='character');const leaf=app.layerLabels?.get(layer?.name)||layer?.name||'Слой';return[...groups.map(g=>g.name),leaf].join(' › ')},
    add(name='layer_'+(app.state.layers.length+1),parentId=this.active()?.parentId||'body'){
      if(!this.group(parentId))parentId=this.group('body')?.id||app.state.layerGroups[0]?.id||null;
      const layer=makeLayer(name,{parentId,z:(this.active()?.z??app.state.layers.length*10)+1});
      const at=this.active()?app.state.activeLayer+1:app.state.layers.length;
      app.state.layers.splice(at,0,layer);app.state.activeLayer=at;
      app.emit('layers:changed');app.emit('composite:dirty');
    },
    duplicate(){
      const src=this.active();if(!src)return;
      const layer=makeLayer(src.name+'_copy',{parentId:src.parentId,slot:src.slot,z:(src.z??app.state.activeLayer*10)+.1,visible:src.visible,locked:src.locked,opacity:src.opacity});
      layer.canvas.getContext('2d').drawImage(src.canvas,0,0);
      app.state.layers.splice(app.state.activeLayer+1,0,layer);app.state.activeLayer++;
      app.emit('layers:changed');app.emit('composite:dirty');
    },
    remove(){
      const src=this.active();if(!src)return;
      if(app.state.layers.filter(l=>l.parentId===src.parentId).length<=1){app.emit('status','В группе должен остаться хотя бы один слой');return}
      app.state.layers.splice(app.state.activeLayer,1);app.state.activeLayer=Math.max(0,app.state.activeLayer-1);
      this.validateStructure({repair:true,notify:true});
      app.emit('layers:changed');app.emit('composite:dirty');
    },
    mergeDown(){
      const i=app.state.activeLayer;if(i<=0)return;
      const top=app.state.layers[i],down=app.state.layers[i-1];
      if(top.parentId!==down.parentId){app.emit('status','Объединять можно только соседние слои одной группы');return}
      const ctx=down.canvas.getContext('2d');ctx.save();ctx.globalAlpha=top.opacity;ctx.drawImage(top.canvas,0,0);ctx.restore();
      app.state.layers.splice(i,1);app.state.activeLayer--;
      this.validateStructure({repair:true,notify:true});
      app.emit('layers:changed');app.emit('composite:dirty');
    },
    setActive(i){const next=Math.max(0,Math.min(app.state.layers.length-1,i));if(next===app.state.activeLayer){app.emit('layers:active',next);return}app.state.activeLayer=next;app.emit('layers:active',next);app.emit('composite:dirty')},
    importCanvas(canvas,name='composite_import'){
      const parentId=this.group('imports')?.id||this.group('body')?.id||app.state.layerGroups[0]?.id||null;
      const maxZ=Math.max(0,...app.state.layers.map(layer=>Number.isFinite(layer.z)?layer.z:0));
      const layer=makeLayer(name,{parentId,slot:'import',z:maxZ+10});layer.canvas.getContext('2d').drawImage(canvas,0,0,W,H);
      app.state.layers.push(layer);app.state.activeLayer=app.state.layers.length-1;
      app.emit('layers:changed');app.emit('composite:dirty');
    }
  };
  app.layers=api;api.init();
}
