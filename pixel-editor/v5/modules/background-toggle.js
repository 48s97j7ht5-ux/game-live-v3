import{W,H}from'#pixel-app';
const MAGENTA='#ff00ff';
export default{
  id:'background-toggle',
  mount(app){
    const board=document.getElementById('board'),bar=document.querySelector('.bar'),ref=document.getElementById('ref'),paint=document.getElementById('paint');
    if(!board||!ref||!paint)return;
    let mode='magenta';

    const bg=document.createElement('canvas');
    bg.id='pixelBg';bg.width=W;bg.height=H;bg.style.pointerEvents='none';
    bg.style.width=paint.style.width||W+'px';bg.style.height=paint.style.height||H+'px';
    board.insertBefore(bg,ref);
    const bc=bg.getContext('2d',{willReadFrequently:true});

    const desktopBtn=document.createElement('button');
    desktopBtn.className='bgToggleDesktop';desktopBtn.type='button';bar?.appendChild(desktopBtn);

    function label(){return mode==='magenta'?'BG: Magenta':'BG: Transparent'}
    function opaqueAt(data,i){return data[i*4+3]>0}
    function renderMask(){
      bc.clearRect(0,0,W,H);
      if(mode!=='magenta')return;
      const useRef=app.referenceVisibility?.visible!==false;
      const rd=useRef?ref.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data:null;
      const pd=paint.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
      const out=bc.createImageData(W,H),d=out.data;
      for(let i=0;i<W*H;i++){
        if((useRef&&opaqueAt(rd,i))||opaqueAt(pd,i))continue;
        const q=i*4;d[q]=255;d[q+1]=0;d[q+2]=255;d[q+3]=255;
      }
      bc.putImageData(out,0,0);
    }
    function apply(){
      board.style.background='transparent';
      renderMask();
      desktopBtn.textContent=label();desktopBtn.classList.toggle('activeBtn',mode==='magenta');
      app.loupe?.draw();app.emit('background:changed',mode);
    }
    function setMode(next){mode=next==='transparent'?'transparent':'magenta';apply()}
    function toggle(){setMode(mode==='magenta'?'transparent':'magenta')}

    desktopBtn.onclick=toggle;
    app.on('loupe:background',info=>{
      if(mode!=='magenta'||!info?.ctx)return;
      const {ctx,s,h,CELL}=info,x0=app.state.cx-h,y0=app.state.cy-h;
      const useRef=app.referenceVisibility?.visible!==false;
      const rc=useRef?ref.getContext('2d',{willReadFrequently:true}):null,pc=paint.getContext('2d',{willReadFrequently:true});
      ctx.save();ctx.fillStyle=MAGENTA;
      for(let y=0;y<s;y++)for(let x=0;x<s;x++){
        const sx=x0+x,sy=y0+y;
        if(sx<0||sy<0||sx>=W||sy>=H){ctx.fillRect(x*CELL,y*CELL,CELL,CELL);continue}
        const ra=useRef?rc.getImageData(sx,sy,1,1).data[3]:0,pa=pc.getImageData(sx,sy,1,1).data[3];
        if(ra===0&&pa===0)ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
      }
      ctx.restore();
    });
    app.on('reference:changed',()=>{renderMask();app.loupe?.draw()});
    app.on('reference:visibility',()=>{renderMask();app.loupe?.draw()});
    app.on('composite:rendered',renderMask);
    app.backgroundToggle={get mode(){return mode},toggle,setMode,label,renderMask,bg};
    apply();
  }
};