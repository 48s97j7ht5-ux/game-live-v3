import{cleanSprite}from'./ai-clean-core.mjs?v=20260913-ai-clean1';

const VISION_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';
const WASM_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL_URL='https://storage.googleapis.com/mediapipe-assets/deeplabv3.tflite?generation=1661875711618421';
let segmenterPromise=null;

function nonEmpty(image){for(let i=3;i<image.data.length;i+=4)if(image.data[i])return true;return false}

async function loadSegmenter(){
  if(!segmenterPromise)segmenterPromise=(async()=>{
    const{FilesetResolver,ImageSegmenter}=await import(VISION_URL);
    const vision=await FilesetResolver.forVisionTasks(WASM_URL);
    return ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:MODEL_URL},runningMode:'IMAGE',outputCategoryMask:false,outputConfidenceMasks:true});
  })().catch(error=>{segmenterPromise=null;throw error});
  return segmenterPromise;
}

async function personMask(segmenter,source){
  const input=document.createElement('canvas');input.width=source.width;input.height=source.height;
  const ctx=input.getContext('2d');ctx.fillStyle='#808080';ctx.fillRect(0,0,input.width,input.height);ctx.drawImage(source,0,0);
  return new Promise((resolve,reject)=>{
    try{
      segmenter.segment(input,result=>{
        try{
          const labels=segmenter.getLabels?.()||[],found=labels.findIndex(label=>String(label).toLowerCase()==='person'),personIndex=found>=0?found:15;
          const masks=result.confidenceMasks||[],selected=masks[personIndex];
          if(!selected)throw Error('модель не вернула маску персонажа');
          const mask={data:new Float32Array(selected.getAsFloat32Array()),width:selected.width||input.width,height:selected.height||input.height};
          for(const item of masks)item.close?.();result.categoryMask?.close?.();resolve(mask);
        }catch(error){reject(error)}
      });
    }catch(error){reject(error)}
  });
}

export default{
  id:'ai-clean',
  mount(app){
    const button=document.getElementById('aiCleanApply'),strength=document.getElementById('aiCleanStrength'),strengthValue=document.getElementById('aiCleanStrengthValue'),palette=document.getElementById('aiCleanPalette');
    if(!button||!strength)return;
    strength.oninput=()=>strengthValue.textContent=strength.value+'%';
    async function apply(){
      if(button.disabled)return;
      const layer=app.layers?.active?.();
      if(!layer?.canvas){app.emit('status','AI Clean: сначала выберите слой');return}
      const source=layer.canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,layer.canvas.width,layer.canvas.height);
      if(!nonEmpty(source)){app.emit('status','AI Clean: активный слой пуст');return}
      button.disabled=true;button.textContent='Загружаю нейросеть…';
      let neuralMask=null,modelError=null;
      try{
        app.emit('status','AI Clean · загружаю MediaPipe и анализирую силуэт…');
        const segmenter=await loadSegmenter();button.textContent='Нейросеть думает…';neuralMask=await personMask(segmenter,layer.canvas);
      }catch(error){modelError=error}
      try{
        button.textContent='Чищу пиксели…';
        const result=cleanSprite(source,{strength:Number(strength.value),paletteLimit:palette.checked?64:false,neuralMask});
        app.history.pushStructure();app.layers.duplicate();
        const output=app.layers.active();output.name=layer.name+'_ai_clean';output.slot=layer.slot;output.locked=false;output.visible=true;
        output.canvas.getContext('2d').putImageData(new ImageData(result.data,result.width,result.height),0,0);
        app.emit('layers:changed');app.emit('composite:dirty');app.mobileLayout?.closeSheet?.();
        const s=result.stats,neural=modelError?'нейросеть недоступна, применена безопасная пиксельная очистка':s.neuralApplied?'нейромаска принята':`нейромаска отклонена (${Math.round(s.neuralRecall*100)}% совпадения), рисунок сохранён`;
        app.emit('status',`AI Clean готов · новый слой ${output.name} · ${neural} · цвета ${s.beforeColors} → ${s.afterColors} · удалено ${s.removed}, закрыто дырок ${s.filled}`);
      }catch(error){app.emit('status','AI Clean: '+error.message)}
      finally{button.disabled=false;button.textContent='Очистить в копию'}
    }
    button.onclick=()=>void apply();app.aiClean={apply,loadModel:loadSegmenter};
  }
};
