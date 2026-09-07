const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {PNG}=require('pngjs'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'pixel-editor/cad-study/assets');
const metadata=JSON.parse(fs.readFileSync(path.join(assets,'results.json')));
const palette=new Set(metadata.palette.map(c=>c.join(',')));
assert.equal(metadata.palette.length,48);
for(const [height,{width,colors}] of Object.entries(metadata.results)){
 let mask;
 for(const method of ['nearest','area','adaptive'])for(const mode of ['48','raw']){
  const png=PNG.sync.read(fs.readFileSync(path.join(assets,`${height}-${method}-${mode}.png`)));
  assert.equal(png.width,width);assert.equal(png.height,Number(height));
  const current=[],used=new Set();
  for(let i=0;i<png.data.length;i+=4){const a=png.data[i+3];assert(a===0||a===255);current.push(a);const color=[...png.data.subarray(i,i+3)].join(',');if(a){used.add(color);if(mode==='48')assert(palette.has(color));}else assert.equal(color,'0,0,0');}
  if(mask)assert.deepEqual(current,mask);else mask=current;
  assert.equal(used.size,colors[method+'-'+mode]);
 }
}
const server=http.createServer((req,res)=>{
 let url=decodeURIComponent(req.url.split('?')[0]);if(url.endsWith('/'))url+='index.html';
 const file=path.resolve(root,'.'+url);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.json':'application/json'})[path.extname(file)]||'text/plain');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/pixel-editor/cad-study/`);
  const ready=()=>page.waitForFunction(()=>document.querySelector('#download').getAttribute('aria-disabled')==='false');
  await ready();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.match(await page.locator('#status').innerText(),/139 × 208/);
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.locator('[data-region="face"]').click();
  await page.screenshot({path:path.join(root,'test-results/cad-mobile.png'),fullPage:true});
  await page.locator('.comparison').screenshot({path:path.join(root,'test-results/cad-face.png')});
  await page.locator('[data-region="calves"]').click();await page.locator('.comparison').screenshot({path:path.join(root,'test-results/cad-calves.png')});
  await page.locator('[data-palette="raw"]').click();await ready();assert.match(await page.locator('#download').getAttribute('href'),/raw\.png/);
  await page.locator('#size').selectOption('256');await ready();assert.match(await page.locator('#status').innerText(),/171 × 256/);
  await page.locator('#method').selectOption('area');await ready();assert.match(await page.locator('#baseline').getAttribute('href'),/area-raw/);
  const event=page.waitForEvent('download');await page.locator('#download').click();const download=await event;
  const png=PNG.sync.read(fs.readFileSync(await download.path()));assert.equal(png.width,171);assert.equal(png.height,256);
  await page.locator('#method').selectOption('source');await ready();assert.equal(await page.locator('#left-label').innerText(),'Исходник');
  const hold=page.locator('#hold');await hold.scrollIntoViewIfNeeded();const r=await hold.boundingBox();await page.mouse.move(r.x+20,r.y+20);await page.mouse.down();await page.mouse.up();
  assert.deepEqual(errors,[]);console.log('PASS all output dimensions, common masks, palette membership, counts, mobile layout, controls and PNG download');
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
