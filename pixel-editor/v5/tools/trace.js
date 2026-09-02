export default{
  id:'trace',
  label:'🧬 Trace',
  apply(app,x,y){
    const layer=app.layers?.active?.();
    const ref=document.getElementById('ref');
    if(!layer||app.layers.isLocked(layer)||!ref)return;
    if(x<0||y<0||x>=ref.width||y>=ref.height)return;
    const rctx=ref.getContext('2d',{willReadFrequently:true});
    const px=rctx.getImageData(x,y,1,1).data;
    if(px[3]===0)return;
    const lctx=layer.canvas.getContext('2d');
    const img=lctx.createImageData(1,1);
    img.data[0]=px[0];img.data[1]=px[1];img.data[2]=px[2];img.data[3]=px[3];
    lctx.putImageData(img,x,y);
    app.emit('composite:dirty');
  }
};
