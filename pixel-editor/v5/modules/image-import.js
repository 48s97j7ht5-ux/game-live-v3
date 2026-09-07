// Small PNGs keep their original pixels. Only oversized images may be reduced,
// and the caller must obtain explicit confirmation before drawing that result.
export function importPlacement(sourceWidth,sourceHeight,canvasWidth,canvasHeight){
  if(![sourceWidth,sourceHeight,canvasWidth,canvasHeight].every(n=>Number.isInteger(n)&&n>0))throw new Error('неверный размер изображения');
  const scale=Math.min(1,canvasWidth/sourceWidth,canvasHeight/sourceHeight);
  const width=Math.max(1,Math.round(sourceWidth*scale));
  const height=Math.max(1,Math.round(sourceHeight*scale));
  return{sourceWidth,sourceHeight,width,height,x:Math.floor((canvasWidth-width)/2),y:Math.floor((canvasHeight-height)/2),reduced:scale<1};
}

export function confirmReduction(placement,canvasWidth,canvasHeight){
  if(!document.getElementById('pixelImportStyles')){
    const link=document.createElement('link');link.id='pixelImportStyles';link.rel='stylesheet';
    link.href=new URL('./image-import.css?v=20260907-native-png1',import.meta.url).href;
    document.head.appendChild(link);
  }
  const dialog=document.createElement('dialog');
  dialog.className='pixelImportDialog';
  dialog.setAttribute('aria-labelledby','pixelImportTitle');
  dialog.setAttribute('aria-describedby','pixelImportDescription');
  dialog.innerHTML=`<form method="dialog">
    <h2 id="pixelImportTitle">PNG больше холста</h2>
    <p id="pixelImportDescription"></p>
    <p data-import-size></p>
    <p>При уменьшении мелкие детали потеряются. Исходный файл сохранится.</p>
    <div class="pixelImportActions">
      <button value="cancel" autofocus>Отмена</button>
      <button value="reduce">Уменьшить и загрузить</button>
    </div>
  </form>`;
  dialog.querySelector('#pixelImportDescription').textContent=`Изображение: ${placement.sourceWidth} × ${placement.sourceHeight} px. Холст: ${canvasWidth} × ${canvasHeight} px.`;
  dialog.querySelector('[data-import-size]').textContent=`После уменьшения: ${placement.width} × ${placement.height} px, с сохранением пропорций.`;
  document.body.appendChild(dialog);
  return new Promise(resolve=>{
    dialog.addEventListener('close',()=>{
      const accepted=dialog.returnValue==='reduce';dialog.remove();resolve(accepted);
    },{once:true});
    dialog.showModal();
  });
}
