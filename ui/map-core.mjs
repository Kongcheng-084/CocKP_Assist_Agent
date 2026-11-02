export const MAP_KINDS={door:'门',corridor:'走廊',stairs:'楼梯',secret:'秘密通道',route:'路线',other:'自定义'};
export const MAP_ANCHORS={center:'中心',top:'上侧',right:'右侧',bottom:'下侧',left:'左侧'};
export const MAP_COLORS={sand:'#ead8c3',rose:'#ead2c5',sage:'#dce1d1',paper:'#f7eddf'};
const id=v=>typeof v==='string'&&/^[\w-]{1,200}$/.test(v),group=v=>v==='manual'||/^[a-f0-9-]{36}$/.test(v),num=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
const text=(v,max)=>typeof v==='string'&&v.length<=max,point=p=>p&&num(p.x,-20000,20000)&&num(p.y,-20000,20000);
export const uid=()=>crypto.randomUUID();
export const clone=v=>structuredClone(v);
export const validFontSize=v=>Number.isInteger(v)&&v>=10&&v<=48;
export const nodeFontSize=(map,node)=>node.fontSize??map.fontSize??13;
export function setNodeFontSize(map,ids,size){if(size!==null&&!validFontSize(size))throw Error('字号请输入 10–48 的整数。');for(const node of map.nodes.filter(n=>ids.includes(n.id)&&!n.locked)){if(size===null)delete node.fontSize;else node.fontSize=size;}}
export function validBackground(b){return b===null||!!(b&&/^[a-f0-9]{64}$/.test(b.assetId)&&point(b)&&num(b.w,40,8000)&&num(b.h,40,8000)&&num(b.rotation,-360,360)&&num(b.opacity,.05,1)&&typeof b.locked==='boolean'&&Number.isInteger(b.width)&&b.width>0&&b.width<=4096&&Number.isInteger(b.height)&&b.height>0&&b.height<=4096&&b.width*b.height<=8000000&&b.source&&['image','pdf'].includes(b.source.kind)&&text(b.source.name,240)&&(b.source.kind!=='pdf'||/^[a-f0-9]{64}$/.test(b.source.documentId)&&Number.isInteger(b.source.page)&&b.source.page>=1&&b.source.page<=200&&b.source.crop&&['x','y','w','h'].every(k=>num(b.source.crop[k],0,1))&&b.source.crop.w>0&&b.source.crop.h>0&&b.source.crop.x+b.source.crop.w<=1.00001&&b.source.crop.y+b.source.crop.h<=1.00001));}
export function validMap(m){
  return !!(m&&id(m.id)&&text(m.name,80)&&m.name.trim()&&(m.fontSize===undefined||validFontSize(m.fontSize))&&m.view&&num(m.view.x,-100000,100000)&&num(m.view.y,-100000,100000)&&num(m.view.z,.15,3)&&typeof m.snap==='boolean'&&validBackground(m.background)&&Array.isArray(m.nodes)&&m.nodes.length<=2000&&new Set(m.nodes.map(n=>n.id)).size===m.nodes.length&&m.nodes.every(n=>n&&id(n.id)&&id(n.factId)&&(n.sourceType===undefined||['fact','description'].includes(n.sourceType))&&point(n)&&num(n.w,48,2000)&&num(n.h,36,2000)&&typeof n.locked==='boolean'&&(n.fontSize===undefined||validFontSize(n.fontSize))&&Object.hasOwn(MAP_COLORS,n.color))&&Array.isArray(m.edges)&&m.edges.length<=4000&&new Set(m.edges.map(e=>e.id)).size===m.edges.length&&m.edges.every(e=>e&&id(e.id)&&m.nodes.some(n=>n.id===e.from)&&m.nodes.some(n=>n.id===e.to)&&e.from!==e.to&&(e.fromAnchor===undefined||Object.hasOwn(MAP_ANCHORS,e.fromAnchor))&&(e.toAnchor===undefined||Object.hasOwn(MAP_ANCHORS,e.toAnchor))&&Object.hasOwn(MAP_KINDS,e.kind)&&text(e.label,120)&&text(e.notes,4000)&&['custom','source'].includes(e.provenance)&&typeof e.confirmed==='boolean'&&Array.isArray(e.evidence)&&e.evidence.length<=20&&e.evidence.every(s=>s&&id(s.blockId)&&text(s.quote,3000)&&s.quote.trim())&&Array.isArray(e.points)&&e.points.length<=30&&e.points.every(point)));
}
export function validMapState(value){return value===undefined||!!(value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([key,g])=>group(key)&&g&&Array.isArray(g.items)&&g.items.length<=100&&g.items.every(validMap)&&new Set(g.items.map(m=>m.id)).size===g.items.length&&(g.activeId===null&&!g.items.length||g.items.some(m=>m.id===g.activeId))));}
export function mapGroup(state,groupId,create=false){if(!state.maps?.[groupId]&&create){state.maps={...state.maps,[groupId]:{activeId:null,items:[]}};}return state.maps?.[groupId]||{activeId:null,items:[]};}
export function currentMap(state,groupId){const g=mapGroup(state,groupId);return g.items.find(m=>m.id===g.activeId)||null;}
export function createMap(state,groupId,name='新地图'){
  const g=mapGroup(state,groupId,true);if(g.items.length>=100)throw Error('本组地图已达 100 张。');
  const m={id:uid(),name:name.trim().slice(0,80)||'新地图',view:{x:70,y:70,z:1},snap:false,background:null,nodes:[],edges:[]};g.items.push(m);g.activeId=m.id;return m;
}
export function factFor(state,groupId,node){if(!node)return undefined;if(node.sourceType==='description'){const d=state.descriptions?.find(d=>d.id===node.factId);return d?{...d,category:'description',sources:[]}:undefined;}return state.facts.find(f=>f.id===node.factId&&(f.aiRunId||'manual')===groupId);}
export function addNode(state,groupId,map,factId,p={x:0,y:0},sourceType='fact'){
  if(!['fact','description'].includes(sourceType))throw Error('地图资料类型无效。');
  const fact=factFor(state,groupId,{factId,sourceType});if(!fact||!['scene','npc','clue','description'].includes(fact.category))throw Error('请选择当前记录中的场景、人物、线索或本模组的描述。');
  if(map.nodes.length>=2000)throw Error('单张地图最多放置 2000 个标记。');
  const n={id:uid(),factId,...(sourceType==='description'?{sourceType}:{}),x:p.x,y:p.y,w:fact.category==='scene'?180:130,h:fact.category==='scene'?100:52,locked:false,color:fact.category==='description'?'paper':fact.category==='npc'?'rose':fact.category==='clue'?'sage':'sand'};map.nodes.push(n);return n;
}
export function connect(map,from,to){
  if(from===to||!map.nodes.some(n=>n.id===from)||!map.nodes.some(n=>n.id===to))throw Error('请选择两个不同的地点标记。');
  if(map.edges.length>=4000)throw Error('单张地图最多保留 4000 条连接。');
  const a=map.nodes.find(n=>n.id===from),b=map.nodes.find(n=>n.id===to),horizontal=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y),fromAnchor=horizontal?(b.x>=a.x?'right':'left'):(b.y>=a.y?'bottom':'top'),toAnchor={right:'left',left:'right',bottom:'top',top:'bottom'}[fromAnchor];
  const edge={id:uid(),from,to,fromAnchor,toAnchor,kind:'door',label:'',notes:'',provenance:'custom',confirmed:false,evidence:[],points:[]};map.edges.push(edge);return edge;
}
export function removeNodes(map,ids){const remove=new Set(ids);map.nodes=map.nodes.filter(n=>!remove.has(n.id));map.edges=map.edges.filter(e=>!remove.has(e.from)&&!remove.has(e.to));}
export function duplicateNodes(map,ids){const created=[];for(const n of map.nodes.filter(n=>ids.includes(n.id))){if(map.nodes.length>=2000)break;const copy={...n,id:uid(),x:Math.min(20000,n.x+30),y:Math.min(20000,n.y+30),locked:false};map.nodes.push(copy);created.push(copy.id);}return created;}
export function evidenceStatus(state,edge){
  if(edge.provenance==='custom')return 'custom';
  if(!edge.evidence.length)return 'missing';
  return edge.evidence.every(ref=>{const b=state.blocks.find(b=>b.id===ref.blockId);return b&&!b.sourceStale&&b.text.includes(ref.quote);})?'valid':'stale';
}
export function setEvidence(state,edge,refs,confirmed=false){
  const next={...edge,provenance:'source',evidence:clone(refs)};
  if(evidenceStatus(state,next)!=='valid')throw Error('引文必须是所选原文的连续文字，且来源尚未过期。');
  edge.provenance='source';edge.evidence=clone(refs);edge.confirmed=!!confirmed;
}
export function mapAssets(state){return [...new Set(Object.values(state.maps||{}).flatMap(g=>g.items.map(m=>m.background?.assetId).filter(Boolean)))];}
export function screenToWorld(view,p){return {x:(p.x-view.x)/view.z,y:(p.y-view.y)/view.z};}
export function zoomAt(view,p,z){z=Math.max(.15,Math.min(3,z));const world=screenToWorld(view,p);return {x:Math.max(-100000,Math.min(100000,p.x-world.x*z)),y:Math.max(-100000,Math.min(100000,p.y-world.y*z)),z};}
export function snapped(v,on){return Math.max(-20000,Math.min(20000,on?Math.round(v/20)*20:v));}
export function edgePath(map,edge){const a=map.nodes.find(n=>n.id===edge.from),b=map.nodes.find(n=>n.id===edge.to);if(!a||!b)return [];const anchor=(n,side)=>({x:n.x+n.w*(side==='left'?0:side==='right'?1:.5),y:n.y+n.h*(side==='top'?0:side==='bottom'?1:.5)});return [anchor(a,edge.fromAnchor),...edge.points,anchor(b,edge.toAnchor)];}
export function bounds(map){
  const boxes=map.nodes.map(n=>({x:n.x,y:n.y,w:n.w,h:n.h}));
  if(map.background){const b=map.background,r=b.rotation*Math.PI/180,w=Math.abs(b.w*Math.cos(r))+Math.abs(b.h*Math.sin(r)),h=Math.abs(b.w*Math.sin(r))+Math.abs(b.h*Math.cos(r));boxes.push({x:b.x+b.w/2-w/2,y:b.y+b.h/2-h/2,w,h});}
  for(const edge of map.edges)for(const p of edge.points)boxes.push({...p,w:0,h:0});
  if(!boxes.length)return {x:0,y:0,w:500,h:350};
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
}
export class MapHistory{
  constructor(limit=40){this.limit=limit;this.past=[];this.future=[];}
  record(before,after){if(JSON.stringify(before)===JSON.stringify(after))return false;this.past.push(clone(before));this.future=[];while(this.past.length>this.limit||this.past.length>1&&JSON.stringify(this.past).length>8000000)this.past.shift();return true;}
  undo(value){if(!this.past.length)return null;this.future.push(clone(value));return this.past.pop();}
  redo(value){if(!this.future.length)return null;this.past.push(clone(value));return this.future.pop();}
}
