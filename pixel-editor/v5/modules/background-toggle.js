const MAGENTA='#ff00ff';
export default{
  id:'background-toggle',
  mount(app){
    const board=document.getElementById('board'),bar=document.querySelector('.bar');
    if(!board)return;
    let mode='magenta';
    const desktopBtn=document.createElement('button');
    desktopBtn.className='bgToggleDesktop';
    desktopBtn.type='button';
    bar?.appendChild(desktopBtn);

    function label(){return mode==='magenta'?'BG: Magenta':'BG: Transparent'}
    function apply(){
      board.style.background=mode==='magenta'?MAGENTA:'transparent';
      desktopBtn.textContent=label();
      desktopBtn.classList.toggle('activeBtn',mode==='magenta');
      app.loupe?.draw();
      app.emit('background:changed',mode);
    }
    function setMode(next){mode=next==='transparent'?'transparent':'magenta';apply()}
    function toggle(){setMode(mode==='magenta'?'transparent':'magenta')}

    desktopBtn.onclick=toggle;
    app.on('loupe:background',info=>{
      if(mode!=='magenta'||!info?.ctx||!info?.canvas)return;
      info.ctx.save();
      info.ctx.fillStyle=MAGENTA;
      info.ctx.fillRect(0,0,info.canvas.width,info.canvas.height);
      info.ctx.restore();
    });
    app.backgroundToggle={get mode(){return mode},toggle,setMode,label};
    apply();
  }
};