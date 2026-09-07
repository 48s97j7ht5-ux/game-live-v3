const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http');
const {PNG}=require('pngjs');
(async()=>{
 const {compose}=await import('../pixel-editor/hybrid/compose.mjs');
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'pixel-editor/hybrid');
 const m=JSON.parse(fs.readFileSync(path.join(dir,'assets/manifest.json'))),v={};const palette=new Set(m.palette.map(c=>c.join(',')));
 for(const id of Object.keys(m.methods)){const p=PNG.sync.read(fs.readFileSync(path.join(dir,`assets/${id}.png`)));assert.equal(p.width,m.width);assert.equal(p.height,m.height);v[id]=new Uint8ClampedArray(p.data);for(let i=0;i<p.data.length;i+=4){assert.ok([0,255].includes(p.data[i+3]));if(p.data[i+3])assert.ok(palette.has([...p.data.subarray(i,i+3)].join(',')));if(v.nearest)assert.equal(p.data[i+3],v.nearest[i+3])}}
 const ordinary=Object.fromEntries(['base',...m.regions.map(r=>r.id)].map(k=>[k,'nearest']));assert.deepEqual(compose(m,v,ordinary),v.nearest);
 for(const r of m.regions)for(const id of Object.keys(m.methods)){const out=compose(m,v,{...ordinary,[r.id]:id});const [l,t,w,h]=r.rect;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const i=(y*m.width+x)*4,src=x>=l&&x<l+w&&y>=t&&y<t+h?v[id]:v.nearest;assert.deepEqual(out.subarray(i,i+4),src.subarray(i,i+4))}}
 console.log('Candidate compatibility and exact region replacement passed');
 if(process.argv.includes('--data-only'))return;
 const {chromium}=require('playwright');const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]));const p=fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;try{res.setHeader('Content-Type',p.endsWith('.mjs')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(p))}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;try{browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(`http://127.0.0.1:${server.address().port}/pixel-editor/hybrid/`);await page.waitForSelector('body[data-ready="true"]');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.selectOption('#region','left_calf');await page.click('[data-method="retro"]');assert.equal(await page.getAttribute('[data-method="retro"]','aria-pressed'),'true');await page.click('#undo');assert.equal(await page.getAttribute('[data-method="weak"]','aria-pressed'),'true');await page.click('[data-method="soft"]');await page.click('#auto');assert.equal(await page.getAttribute('[data-method="weak"]','aria-pressed'),'true');
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/hybrid-mobile.png',fullPage:true});
 const downloadEvent=page.waitForEvent('download');await page.click('#save');const download=await downloadEvent;await download.saveAs('test-results/hybrid-export.png');const p=PNG.sync.read(fs.readFileSync('test-results/hybrid-export.png'));assert.equal(p.width,139);assert.equal(p.height,208);assert.deepEqual(new Uint8ClampedArray(p.data),compose(m,v,m.auto));assert.deepEqual(errors,[]);console.log('Mobile selection, undo, reset and exact PNG export passed');
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
