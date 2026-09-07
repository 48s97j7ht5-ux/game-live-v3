// Run with Node and the playwright + pngjs packages available.
// Serves the repository locally; no GitHub credentials or external requests.
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..');

function fixture(width,height){
  const png=new PNG({width,height});
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const q=(y*width+x)*4;
    if((x+y)%7===0)continue;
    png.data[q]=x%2?240:24;png.data[q+1]=y%2?192:48;png.data[q+2]=96;png.data[q+3]=255;
  }
  return{name:`fixture-${width}x${height}.png`,mimeType:'image/png',buffer:PNG.sync.write(png)};
}
function expected(source,x,y){
  const image=PNG.sync.read(source.buffer),out=Buffer.alloc(135*400*4);
  for(let row=0;row<image.height;row++)image.data.copy(out,((row+y)*135+x)*4,row*image.width*4,(row+1)*image.width*4);
  return out;
}
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404);res.end();return}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
    res.end(data);
  });
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.activeImageUrls=new Set();
      const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
      URL.createObjectURL=value=>{const url=create(value);window.activeImageUrls.add(url);return url};
      URL.revokeObjectURL=url=>{window.activeImageUrls.delete(url);revoke(url)};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/pixel-editor/v5/`);
    await page.waitForFunction(()=>!!window.pixelLab?.imageIO);
    const pixels=async target=>Buffer.from(await page.evaluate(target=>{
      const c=target==='ref'?document.getElementById('ref'):window.pixelLab.layers.active().canvas;
      return Array.from(c.getContext('2d').getImageData(0,0,135,400).data);
    },target));
    const load=async(file,target='ref')=>{
      await page.locator(target==='ref'?'#refFile':'#spriteFile').setInputFiles(file);
      await page.waitForFunction(()=>!window.pixelLab.imageIO.busy);
    };
    const small=fixture(80,208),wanted=expected(small,27,96);
    await load(small);
    assert.deepEqual(await pixels('ref'),wanted,'80×208 Ref must preserve every pixel');
    assert.equal(await page.locator('dialog').count(),0,'small PNG must not ask to resize');
    assert.equal(await page.locator('#refFile').inputValue(),'','same file can be selected again');
    const initial=await pixels('ref');
    await page.evaluate(()=>{window.pixelLab.mobileLayout.setWorkspace('preview');window.pixelLab.mobilePreviewGestures.setScale(3.25);});
    assert.deepEqual(await pixels('ref'),initial,'screen zoom must not change image pixels');
    assert.match(await page.locator('.quickCheck').innerText(),/Ref 100%/);
    assert.equal(await page.locator('[data-quick="refRaw"]').getAttribute('aria-label'),'Непрозрачность подложки 100%');
    console.log('PASS: native Ref, screen zoom, same-file reload and opacity label');

    await page.evaluate(()=>window.pixelLab.referenceMagic.setEnabled(true));
    await load(small);
    assert.equal(await page.evaluate(()=>window.pixelLab.referenceMagic.enabled),false);
    assert.deepEqual(await pixels('ref'),wanted,'previous Magic setting must not recolor a new PNG');
    const large=fixture(1024,1536);
    const undoCount=await page.evaluate(()=>window.pixelLab.state.undo.length);
    await page.locator('#refFile').setInputFiles(large);
    const dialog=page.locator('.pixelImportDialog');await dialog.waitFor({state:'visible'});
    assert.match(await dialog.innerText(),/135 × 203/);
    const bounds=await dialog.boundingBox();
    assert(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>=0&&bounds.y+bounds.height<=844,'dialog must fit mobile viewport');
    if(process.env.PIXEL_IMPORT_SCREENSHOT)await page.screenshot({path:process.env.PIXEL_IMPORT_SCREENSHOT});
    await dialog.locator('button[value="cancel"]').click();
    await page.waitForFunction(()=>!window.pixelLab.imageIO.busy);
    assert.deepEqual(await pixels('ref'),wanted,'cancel must keep reference unchanged');
    assert.equal(await page.evaluate(()=>window.pixelLab.state.undo.length),undoCount);
    assert.equal(await page.evaluate(()=>window.activeImageUrls.size),0,'cancel must release the image URL');
    console.log('PASS: Magic reset, oversized import cancellation and mobile dialog');

    await page.locator('#spriteFile').setInputFiles(large);
    await page.locator('.pixelImportDialog button[value="reduce"]').click();
    await page.waitForFunction(()=>!window.pixelLab.imageIO.busy);
    const placement=await page.evaluate(()=>window.pixelLab.imageIO.lastImport);
    assert.deepEqual([placement.width,placement.height,placement.x,placement.y],[135,203,0,98]);
    const reduced=await pixels('sprite'),allowed=new Set(['240,192,96,255','240,48,96,255','24,192,96,255','24,48,96,255','0,0,0,0']);
    for(let i=0;i<reduced.length;i+=4)assert(allowed.has([...reduced.subarray(i,i+4)].join(',')),'reduction must not add smoothed colors');
    await page.evaluate(()=>window.pixelLab.history.undo());
    assert.equal(await page.evaluate(()=>window.pixelLab.state.undo.length),undoCount);
    console.log('PASS: confirmed reduction keeps proportions and palette; undo restores layers');

    await load(small,'sprite');
    assert.deepEqual(await pixels('sprite'),wanted,'Composite must not stretch a small PNG');
    const exported=await page.evaluate(()=>window.pixelLab.layers.active().canvas.toDataURL('image/png'));
    assert.deepEqual(PNG.sync.read(Buffer.from(exported.split(',')[1],'base64')).data,wanted,'PNG export must preserve pixels and transparency');
    await page.evaluate(async()=>{
      const app=window.pixelLab,project=app.projectIO.serialize();
      app.layers.active().canvas.getContext('2d').clearRect(0,0,135,400);
      await app.projectIO.loadProject(project);
    });
    assert.deepEqual(await pixels('sprite'),wanted,'project round-trip must keep native sprite');
    assert.deepEqual(await pixels('ref'),wanted,'project round-trip must keep native Ref');
    await load({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not a PNG')});
    assert.deepEqual(await pixels('ref'),wanted,'decode failure must keep reference');
    assert.match(await page.locator('#status').innerText(),/Ошибка изображения/);
    await load(fixture(135,400));
    assert.deepEqual(await pixels('ref'),expected(fixture(135,400),0,0),'old full-canvas PNG stays unchanged');
    assert.equal(await page.evaluate(()=>window.activeImageUrls.size),0,'all image URLs must be released');
    assert.deepEqual(errors,[]);
    console.log('PASS: native Composite, transparent PNG export, project reload, bad-file recovery and legacy size');
  }finally{
    await browser?.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
