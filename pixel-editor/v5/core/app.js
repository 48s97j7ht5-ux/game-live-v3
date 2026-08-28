export const W=135,H=400;
export class PixelLabApp{
  constructor(){this.modules=new Map();this.tools=new Map();this.listeners=new Map();this.state={cx:67,cy:200,activeTool:'pencil',color:'#090404',viewMode:'composite',layers:[],activeLayer:0,undo:[]};}
  on(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);return()=>this.listeners.get(name)?.delete(fn)}
  emit(name,payload){for(const fn of this.listeners.get(name)||[])fn(payload)}
  registerModule(mod){if(this.modules.has(mod.id))throw new Error('Duplicate module '+mod.id);this.modules.set(mod.id,mod);mod.mount?.(this);this.emit('module:registered',mod.id)}
  registerTool(tool){if(this.tools.has(tool.id))throw new Error('Duplicate tool '+tool.id);this.tools.set(tool.id,tool);tool.mount?.(this);this.emit('tool:registered',tool.id)}
  setTool(id){if(!this.tools.has(id))return;this.state.activeTool=id;this.emit('tool:changed',id)}
  activeTool(){return this.tools.get(this.state.activeTool)}
}
export const createCanvas=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c};
export const makeLayer=(name)=>({name,visible:true,locked:false,opacity:1,canvas:createCanvas()});