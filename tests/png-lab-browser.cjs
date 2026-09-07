const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  let url=decodeURIComponent(req.url.split('?')[0]);if(url.endsWith('/'))url+='index.html';
  const file=path.resolve(root,'.'+url);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}const mime={'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'};res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(b);});
});
function sample(){const p=new PNG({width:80,height:208});for(let y=5;y<203;y++)for(let x=20;x<60;x++){const i=(y*80+x)*4;p.data.set([231,153,110,255],i);}return PNG.sync.write(p);}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,acceptDownloads:true});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/pixel-editor/png-lab/`);
    await page.waitForFunction(()=>!document.getElementById('download').disabled,{},{timeout:60000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.match(await page.locator('#result-info').innerText(),/139 × 208/);
    const downloadEvent=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadEvent;
    const png=PNG.sync.read(fs.readFileSync(await download.path()));assert.equal(png.width,139);assert.equal(png.height,208);
    for(let i=3;i<png.data.length;i+=4)assert(png.data[i]===0||png.data[i]===255);
    await page.locator('[data-region="calves"]').click();await page.locator('#background').selectOption('light');
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.locator('.comparison').screenshot({path:path.join(root,'test-results/png-lab-calves.png')});
    await page.locator('[data-region="face"]').click();await page.locator('#left-view').selectOption('nearest');
    await page.locator('.comparison').screenshot({path:path.join(root,'test-results/png-lab-face.png')});
    await page.screenshot({path:path.join(root,'test-results/png-lab-mobile.png'),fullPage:true});
    const hold=page.locator('#hold');await hold.scrollIntoViewIfNeeded();const r=await hold.boundingBox();await page.mouse.move(r.x+20,r.y+20);await page.mouse.down();await page.mouse.up();
    await page.locator('#height').fill('256');assert(await page.locator('#download').isDisabled());assert.equal(await page.locator('#width').inputValue(),'171');
    await page.locator('#process').click();await page.waitForFunction(()=>!document.getElementById('download').disabled);assert.match(await page.locator('#result-info').innerText(),/171 × 256/);
    await page.locator('#detect').click();await page.waitForFunction(()=>!document.getElementById('detection').hidden);assert.equal(await page.locator('#height').inputValue(),'256');
    await page.locator('#file').setInputFiles({name:'test.png',mimeType:'image/png',buffer:sample()});await page.waitForFunction(()=>document.getElementById('filename').textContent==='test.png');
    assert.equal(await page.locator('#width').inputValue(),'80');assert(await page.locator('#download').isDisabled());
    await page.evaluate(()=>{document.getElementById('process').click();document.getElementById('cancel').click();});
    assert.match(await page.locator('#status').innerText(),/отменена/);assert(await page.locator('#process').isEnabled());
    await page.locator('#process').click();await page.waitForFunction(()=>!document.getElementById('download').disabled);
    const tinyEvent=page.waitForEvent('download');await page.locator('#download').click();const tiny=PNG.sync.read(fs.readFileSync(await(await tinyEvent).path()));assert.equal(tiny.width,80);assert.equal(tiny.height,208);assert.equal(tiny.data[3],0);
    await page.locator('#file').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not a PNG')});await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));assert(await page.locator('#process').isEnabled());
    await page.locator('#height').fill('999');await page.locator('#process').click();await page.waitForFunction(()=>document.getElementById('status').classList.contains('error')&&!document.getElementById('process').disabled);assert(await page.locator('#download').isDisabled());
    assert.deepEqual(errors,[]);console.log('PASS mobile layout, sample, worker, comparison, export, upload, stale output and error recovery');
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
