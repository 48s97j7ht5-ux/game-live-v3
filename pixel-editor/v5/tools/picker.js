function pixel(ctx,x,y){return ctx?.getImageData(x,y,1,1).data}
export default{
  id:'picker',label:'🎯 Pick',
  apply(app,x,y){
    let source='рисунок',d=pixel(app.compositor?.ctx,x,y);
    if((!d||d[3]===0)&&app.referenceVisibility?.visible!==false){
      const ref=document.getElementById('ref');
      d=pixel(ref?.getContext('2d',{willReadFrequently:true}),x,y);
      source='референс';
    }
    if(!d||d[3]===0){app.emit('status',`Pick: пустой пиксель · ${x},${y}`);return null}
    const color='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    app.state.color=color;app.emit('color:changed',color);app.emit('status',`Pick ${color} · ${source} · ${x},${y}`);return color;
  }
};