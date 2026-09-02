import{W,H}from'../core/app.js?v=20260902-layer-schema1';

function safeName(value){return String(value||'layer').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'')||'layer'}

export default{
  id:'layer-png-io',
  mount(app){
    const input=document.getElementById('layerPngFile');
    let targetLayerId=null;
    const find=id=>app.state.layers.find(layer=>layer.id===id);

    function openFor(id){
      const layer=find(id);if(!layer){app.emit('status','Слой для загрузки не найден');return}
      const index=app.state.layers.indexOf(layer);app.layers.setActive(index);
      if(!app.layers.canEdit(layer))return;
      targetLayerId=id;if(input){input.value='';input.click()}
    }

    function save(id){
      const layer=find(id);if(!layer){app.emit('status','Слой для сохранения не найден');return}
      const link=document.createElement('a');
      link.download=`${safeName(layer.name)}-${W}x${H}.png`;
      link.href=layer.canvas.toDataURL('image/png');link.click();
      app.emit('status',`PNG сохранён · ${app.layers.pathLabel(layer)} · ${W}×${H}`);
    }

    async function load(file,id=targetLayerId){
      const layer=find(id);if(!layer)throw new Error('слой больше не существует');
      if(!app.layers.canEdit(layer))return false;
      if(file.type&&file.type!=='image/png')throw new Error('нужен файл PNG');
      const url=URL.createObjectURL(file),image=new Image();
      try{
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('PNG не удалось прочитать'));image.src=url});
        if(image.naturalWidth!==W||image.naturalHeight!==H)throw new Error(`PNG имеет размер ${image.naturalWidth}×${image.naturalHeight}, нужен ${W}×${H}`);
        app.history.push();
        const ctx=layer.canvas.getContext('2d');ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0);
        app.layers.setActive(app.state.layers.indexOf(layer));
        app.emit('layers:changed');app.emit('composite:dirty');app.loupe?.draw();
        app.emit('status',`PNG загружен · ${app.layers.pathLabel(layer)} · ${W}×${H}`);
        return true;
      }finally{URL.revokeObjectURL(url);targetLayerId=null}
    }

    if(input)input.onchange=async event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;
      try{await load(file)}catch(error){targetLayerId=null;app.emit('status','Ошибка PNG слоя: '+error.message)}
    };
    app.layerPngIO={openFor,save,load};
  }
};
