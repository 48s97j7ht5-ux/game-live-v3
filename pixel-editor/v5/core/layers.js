import{makeLayer,W,H}from'./app.js?v=20260902-layer-tree1';

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
  {id:'clothes_upper',name:'Верхняя',parentId:'clothes',expanded:false},
  {id:'clothes_lower',name:'Нижняя',parentId:'clothes',expanded:false},
  {id:'clothes_onepiece',name:'Цельная',parentId:'clothes',expanded:false},
  {id:'clothes_outerwear',name:'Уличная верхняя',parentId:'clothes',expanded:false},
  {id:'footwear',name:'Обувь',parentId:'clothes',expanded:false},
  {id:'accessories',name:'Аксессуары',parentId:'character',expanded:false},
  {id:'imports',name:'Импорт',parentId:null,expanded:true}
];

// Render order stays flat and independent from the semantic tree.
const DEFAULT_LAYERS=[
  ['hair_back','hair'],
  ['body_legs','legs'],
  ['body_torso','torso'],
  ['body_arms','arms'],
  ['head_base','head'],
  ['face_eyes','face'],
  ['face_brows','face'],
  ['face_nose','face'],
  ['face_mouth','face'],
  ['underwear_base','underwear'],
  ['clothes_lower_base','clothes_lower'],
  ['clothes_upper_base','clothes_upper'],
  ['clothes_onepiece_base','clothes_onepiece'],
  ['clothes_outerwear_base','clothes_outerwear'],
  ['footwear_base','footwear'],
  ['hair_front','hair'],
  ['accessories_base','accessories']
];

const makeGroup=g=>({id:g.id,name:g.name,parentId:g.parentId,visible:true,locked:false,opacity:1,expanded:g.expanded!==false});

export function installLayers(app){
  const api={
    init(){
      app.state.layerGroups=GROUPS.map(makeGroup);
      app.state.layers=DEFAULT_LAYERS.map(([name,parentId])=>makeLayer(name,{id:name,parentId}));
      app.state.activeLayer=Math.max(0,app.state.layers.findIndex(l=>l.name==='body_torso'));
      app.emit('layers:changed');
    },
    active(){return app.state.layers[app.state.activeLayer]},
    group(id){return app.state.layerGroups.find(g=>g.id===id)},
    ancestors(parentId){const out=[];let current=this.group(parentId);while(current){out.push(current);current=this.group(current.parentId)}return out},
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
    pathLabel(layer){const groups=this.ancestors(layer?.parentId).reverse().filter(g=>g.id!=='character');const leaf=app.layerLabels?.get(layer?.name)||layer?.name||'Слой';return[...groups.map(g=>g.name),leaf].join(' › ')},
    add(name='layer_'+(app.state.layers.length+1),parentId=this.active()?.parentId||'body'){
      const layer=makeLayer(name,{parentId});
      const at=this.active()?app.state.activeLayer+1:app.state.layers.length;
      app.state.layers.splice(at,0,layer);app.state.activeLayer=at;
      app.emit('layers:changed');app.emit('composite:dirty');
    },
    duplicate(){
      const src=this.active();if(!src)return;
      const layer=makeLayer(src.name+'_copy',{parentId:src.parentId,visible:src.visible,locked:src.locked,opacity:src.opacity});
      layer.canvas.getContext('2d').drawImage(src.canvas,0,0);
      app.state.layers.splice(app.state.activeLayer+1,0,layer);app.state.activeLayer++;
      app.emit('layers:changed');app.emit('composite:dirty');
    },
    remove(){
      const src=this.active();if(!src)return;
      if(app.state.layers.filter(l=>l.parentId===src.parentId).length<=1){app.emit('status','В группе должен остаться хотя бы один слой');return}
      app.state.layers.splice(app.state.activeLayer,1);app.state.activeLayer=Math.max(0,app.state.activeLayer-1);
      app.emit('layers:changed');app.emit('composite:dirty');
    },
    mergeDown(){
      const i=app.state.activeLayer;if(i<=0)return;
      const top=app.state.layers[i],down=app.state.layers[i-1];
      if(top.parentId!==down.parentId){app.emit('status','Объединять можно только соседние слои одной группы');return}
      const ctx=down.canvas.getContext('2d');ctx.save();ctx.globalAlpha=top.opacity;ctx.drawImage(top.canvas,0,0);ctx.restore();
      app.state.layers.splice(i,1);app.state.activeLayer--;
      app.emit('layers:changed');app.emit('composite:dirty');
    },
    setActive(i){const next=Math.max(0,Math.min(app.state.layers.length-1,i));if(next===app.state.activeLayer){app.emit('layers:active',next);return}app.state.activeLayer=next;app.emit('layers:active',next);app.emit('composite:dirty')},
    importCanvas(canvas,name='composite_import'){
      const layer=makeLayer(name,{parentId:'imports'});layer.canvas.getContext('2d').drawImage(canvas,0,0,W,H);
      app.state.layers.push(layer);app.state.activeLayer=app.state.layers.length-1;
      app.emit('layers:changed');app.emit('composite:dirty');
    }
  };
  app.layers=api;api.init();
}
