import{W,H,createCanvas}from'#pixel-app';
import{importPlacement,confirmReduction}from'./image-import.js?v=20260907-native-png1';

export default{
  id:'io',
  mount(app){
    let busy=false,lastImport=null;

    async function loadFile(file,target='ref'){
      if(!file)return false;
      if(busy){app.emit('status','Сначала завершите текущую загрузку PNG');return false}
      busy=true;
      let url;
      try{
        url=URL.createObjectURL(file);
        const image=await new Promise((resolve,reject)=>{
          const image=new Image();
          image.onload=()=>resolve(image);
          image.onerror=()=>reject(new Error('не удалось прочитать изображение'));
          image.src=url;
        });
        const placement=importPlacement(image.naturalWidth,image.naturalHeight,W,H);
        if(placement.reduced&&!await confirmReduction(placement,W,H)){
          app.emit('status','Загрузка отменена · пиксели не изменены');return false;
        }
        // Prepare the import before changing the reference, layers or history.
        const canvas=createCanvas(),ctx=canvas.getContext('2d');
        ctx.imageSmoothingEnabled=false;
        if(placement.reduced)ctx.drawImage(image,placement.x,placement.y,placement.width,placement.height);
        else ctx.drawImage(image,placement.x,placement.y);

        if(target==='sprite'){
          app.history.pushStructure();
          app.layers.importCanvas(canvas,'composite_import');
        }else{
          // A new PNG must not inherit palette conversion from the previous Ref.
          if(app.referenceMagic)app.referenceMagic.loadSource(canvas,false);
          else{
            const ref=document.getElementById('ref').getContext('2d');
            ref.clearRect(0,0,W,H);ref.imageSmoothingEnabled=false;ref.drawImage(canvas,0,0);
          }
          app.emit('reference:changed');
        }
        lastImport={...placement,target};
        app.mobileLayout?.closeSheet?.();
        app.emit('image:imported',lastImport);
        app.emit('status',`${target==='sprite'?'Composite':'Ref'} · ${placement.sourceWidth}×${placement.sourceHeight} → ${placement.width}×${placement.height} px · ${placement.reduced?'уменьшено без сглаживания':'пиксель в пиксель'} · холст ${W}×${H}`);
        return true;
      }catch(error){
        app.emit('status','Ошибка изображения: '+error.message);return false;
      }finally{
        if(url)URL.revokeObjectURL(url);
        busy=false;
      }
    }

    for(const[id,target]of[['spriteFile','sprite'],['refFile','ref']]){
      document.getElementById(id).onchange=event=>{
        const file=event.target.files?.[0];event.target.value='';
        void loadFile(file,target);
      };
    }
    document.getElementById('export').onclick=()=>{app.compositor.render();const a=document.createElement('a');a.download=`pixel-composite-${W}x${H}.png`;a.href=app.compositor.canvas.toDataURL('image/png');a.click()};
    document.getElementById('exportLayer').onclick=()=>{const l=app.layers.active();if(!l)return;const a=document.createElement('a');a.download=l.name+'.png';a.href=l.canvas.toDataURL('image/png');a.click()};
    app.imageIO={loadFile,get busy(){return busy},get lastImport(){return lastImport}};
  }
};
