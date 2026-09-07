const fs=require('fs'),{PNG}=require('pngjs');
(async()=>{const {reconstruct,detectGrid}=await import('../pixel-editor/png-lab/engine.mjs');
const source=PNG.sync.read(fs.readFileSync(process.argv[2]));const r=reconstruct(source,{width:139,height:208,colors:48,coverage:.5});
fs.writeFileSync(process.argv[3],PNG.sync.write({width:139,height:208,data:Buffer.from(r.data)}));
console.log(JSON.stringify(detectGrid(source)));})().catch(e=>{console.error(e);process.exit(1)});
