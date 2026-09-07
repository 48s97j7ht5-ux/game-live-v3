import {reconstruct,detectGrid} from './engine.mjs';
self.onmessage=({data:{source,options,kind}})=>{
  try {
    if(kind==='detect')self.postMessage({kind:'detected',result:detectGrid(source)});
    else {const result=reconstruct(source,options,message=>self.postMessage({kind:'progress',message}));self.postMessage({kind:'done',result},[result.data.buffer,result.nearest.buffer]);}
  }catch(error){self.postMessage({kind:'error',message:error.message||'Не удалось обработать PNG.'});}
};
