import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import crypto from 'node:crypto';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {gunzipSync,gzipSync} from 'node:zlib';
import * as M from '../ui/map-core.mjs';import {Store,projectValid} from '../desktop/store.mjs';import {checkedPng} from '../desktop/map-assets.mjs';
const C=createRequire(import.meta.url)('../ui/core.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
function seed(){const s=C.fromText('大门通往大厅，大厅有楼梯。','地图.txt');s.facts=[];for(const [category,title]of [['scene','大门'],['scene','大厅'],['npc','守卫'],['clue','日记']])C.createFact(s,{category,title,text:s.blocks[0].text});C.confirmGroup(s);C.generate(s);return s;}
function mapSeed(s=seed(),group='manual'){const m=M.createMap(s,group,'宅邸');for(const f of C.groupFacts(s,group))M.addNode(s,group,m,f.id,{x:m.nodes.length*210,y:0});return {s,m};}

test('旧地图字号兼容，默认继承、单块覆盖、复制和批量设置保持事实不变',()=>{
  const {s,m}=mapSeed(),before=JSON.stringify(s.facts),[a,b]=m.nodes;assert.equal(M.nodeFontSize(m,a),13);
  m.fontSize=20;assert.equal(M.nodeFontSize(m,a),20);M.setNodeFontSize(m,[a.id],28);assert.equal(M.nodeFontSize(m,a),28);assert.equal(M.nodeFontSize(m,b),20);
  const copy=M.duplicateNodes(m,[a.id])[0];assert.equal(m.nodes.find(n=>n.id===copy).fontSize,28);
  b.locked=true;M.setNodeFontSize(m,[a.id,b.id],32);assert.equal(a.fontSize,32);assert.equal(b.fontSize,undefined);M.setNodeFontSize(m,[a.id],null);assert.equal(M.nodeFontSize(m,a),20);
  for(const value of [0,9,49,NaN,Infinity,12.5,'18']){assert.throws(()=>M.setNodeFontSize(m,[a.id],value));const invalid=M.clone(m);invalid.fontSize=value;assert.equal(M.validMap(invalid),false);invalid.fontSize=20;invalid.nodes[0].fontSize=value;assert.equal(M.validMap(invalid),false);}
  assert.ok(projectValid(s));assert.equal(JSON.stringify(s.facts),before);assert.equal(C.stale(s),false);
});

test('地图字号经保存、重启和完整项目备份保留',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'keeper-map-font-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=await new Store(dir).init(seed()),s=await store.load((await store.list())[0].id),{m}=mapSeed(s);m.fontSize=22;M.setNodeFontSize(m,[m.nodes[0].id],36);await store.save(s._projectId,s);
  assert.deepEqual((await new Store(dir).load(s._projectId)).maps,s.maps);const restored=await store.importBackup(await store.backup(s._projectId));assert.equal(restored.maps.manual.items[0].fontSize,22);assert.equal(M.nodeFontSize(restored.maps.manual.items[0],restored.maps.manual.items[0].nodes[0]),36);assert.equal(C.stale(restored),false);
});

test('多图、重复标记与连接只改变地图，不改变事实、批准和备团包',()=>{
  const {s,m}=mapSeed(),facts=JSON.stringify(s.facts),pack=JSON.stringify(s.pack),rev=s.revision;
  const duplicate=M.duplicateNodes(m,[m.nodes[0].id]);assert.equal(m.nodes.filter(n=>n.factId===m.nodes[0].factId).length,2);assert.equal(duplicate.length,1);
  const e=M.connect(m,m.nodes[0].id,m.nodes[1].id);assert.equal(e.provenance,'custom');assert.equal(e.confirmed,false);m.nodes[0].x=400;assert.equal(M.edgePath(m,e)[0].x,580);
  const second=M.createMap(s,'manual','二楼');M.addNode(s,'manual',second,s.facts[0].id);assert.equal(M.mapGroup(s,'manual').items.length,2);
  M.removeNodes(m,[m.nodes[0].id]);assert.equal(m.edges.length,0);assert.equal(JSON.stringify(s.facts),facts);assert.equal(JSON.stringify(s.pack),pack);assert.equal(s.revision,rev);assert.equal(C.stale(s),false);assert.ok(projectValid(s));
});
test('不允许跨提取记录摆放卡片，缺失事实保留标记但不引用其他组同名事实',()=>{
  const {s,m}=mapSeed(),run=crypto.randomUUID();C.registerGroup(s,{id:run});C.selectGroup(s,run);const f=C.createFact(s,{title:'大门',text:'另一组原文',category:'scene'}),other=M.createMap(s,run);
  assert.throws(()=>M.addNode(s,run,other,s.facts[0].id),/当前记录/);M.addNode(s,run,other,f.id);assert.equal(M.factFor(s,'manual',other.nodes[0]),undefined);
  s.facts=s.facts.filter(f=>f.id!==m.nodes[0].factId);assert.equal(M.factFor(s,'manual',m.nodes[0]),undefined);assert.ok(projectValid(s));
});
test('关系引文必须逐字对应且未过期，核对关系不自动确认事实或公开',()=>{
  const {s,m}=mapSeed();s.facts[0].approved=false;const e=M.connect(m,m.nodes[0].id,m.nodes[1].id);
  assert.throws(()=>M.setEvidence(s,e,[{blockId:'b1',quote:'大门通往地下室'}],true),/连续文字/);assert.equal(e.provenance,'custom');
  M.setEvidence(s,e,[{blockId:'b1',quote:'大门通往大厅'}],true);assert.equal(M.evidenceStatus(s,e),'valid');assert.equal(s.facts[0].approved,false);assert.ok(s.facts.every(f=>!f.playerApproved));
  s.blocks[0].sourceStale=true;assert.equal(M.evidenceStatus(s,e),'stale');assert.throws(()=>M.setEvidence(s,e,e.evidence,true));assert.ok(projectValid(s));
});
test('缩放以鼠标位置为锚点，网格吸附及旋转底图边界计算正确',()=>{
  const view={x:20,y:50,z:1.2},p={x:317,y:223},world=M.screenToWorld(view,p),next=M.zoomAt(view,p,2.5);assert.deepEqual(M.screenToWorld(next,p),world);
  assert.equal(M.snapped(31,true),40);assert.equal(M.snapped(31,false),31);assert.equal(M.zoomAt(view,p,100).z,3);assert.equal(M.zoomAt(view,p,0).z,.15);
  const m={nodes:[],edges:[],background:{x:0,y:0,w:200,h:100,rotation:90}},b=M.bounds(m);assert.ok(Math.abs(b.w-100)<.00001&&Math.abs(b.h-200)<.00001);
});
test('撤销重做恢复位置、连接、锁定和底图引用，不重放事实编辑',()=>{
  const {s,m}=mapSeed(),h=new M.MapHistory(3),a=M.clone(M.mapGroup(s,'manual'));m.nodes[0].locked=true;m.nodes[0].x=150;M.connect(m,m.nodes[0].id,m.nodes[1].id);const b=M.clone(M.mapGroup(s,'manual'));h.record(a,b);
  assert.deepEqual(h.undo(b),a);assert.deepEqual(h.redo(a),b);h.record(b,a);assert.equal(h.future.length,0);assert.equal(h.record(a,a),false);
});
test('布局校验拒绝远程底图、无效尺寸、重复节点、悬空连接和异常坐标',()=>{
  const {s,m}=mapSeed();assert.ok(M.validMapState(s.maps));
  const invalid=[n=>n.view.z=0,n=>n.nodes[0].x=Infinity,n=>n.nodes[0].w=-1,n=>n.nodes.push(M.clone(n.nodes[0])),n=>n.background={assetId:'https://evil.example'},n=>n.edges.push({id:'edge',from:'missing',to:n.nodes[0].id})];
  for(const mutate of invalid){const copy=M.clone(m);mutate(copy);assert.equal(M.validMap(copy),false);}assert.equal(M.validMapState({bad:s.maps.manual}),false);assert.equal(M.validMapState([]),false);
});
test('底图存储、重启、历史和备份恢复保留图像，按组映射且无密钥',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'keeper-maps-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=await new Store(dir).init(seed()),s=await store.load((await store.list())[0].id),group=crypto.randomUUID();C.registerGroup(s,{id:group});C.selectGroup(s,group);const f=C.createFact(s,{title:'二楼',text:'原文',category:'scene'}),m=M.createMap(s,group,'二楼');M.addNode(s,group,m,f.id);
  const image=await store.mapAssetPut(s._projectId,png);m.background={assetId:image.id,width:1,height:1,x:0,y:0,w:500,h:500,rotation:0,opacity:.8,locked:true,source:{kind:'image',name:'测试.png'}};await store.save(s._projectId,s);assert.deepEqual(Buffer.from(await store.mapAssetGet(s._projectId,image.id)),png);
  const restart=await new Store(dir).load(s._projectId);assert.deepEqual(restart.maps,s.maps);
  m.nodes[0].x=200;await store.save(s._projectId,s);await store.restoreHistory(s._projectId,(await store.history(s._projectId))[0].name);assert.equal(M.currentMap(await store.load(s._projectId),group).nodes[0].x,0);
  const backup=await store.backup(s._projectId),payload=JSON.parse(gunzipSync(backup));assert.equal(payload.mapImages.length,1);assert.ok(!JSON.stringify(payload).includes('API_KEY'));
  const restored=await store.importBackup(backup),newGroup=restored.aiGroups[0].id;assert.notEqual(newGroup,group);assert.equal(restored.maps[group],undefined);assert.equal(M.currentMap(restored,newGroup).nodes[0].factId,f.id);assert.deepEqual(Buffer.from(await store.mapAssetGet(restored._projectId,image.id)),png);
  payload.mapImages=[];await assert.rejects(store.importBackup(gzipSync(JSON.stringify(payload))),/缺少地图底图/);
});
test('底图 API 拒绝路径穿越、非 PNG、过大像素和跨项目读取',async t=>{
  assert.throws(()=>checkedPng(Buffer.from('<svg/>')));const bad=Buffer.from(png);bad.writeUInt32BE(100000,16);assert.throws(()=>checkedPng(bad),/像素/);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'keeper-map-assets-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=await new Store(dir).init(seed()),first=(await store.list())[0].id,second=await store.create(seed()),image=await store.mapAssetPut(first,png);
  await assert.rejects(store.mapAssetGet(first,'../../secret'));await assert.rejects(store.mapAssetGet(second._projectId,image.id));await assert.rejects(store.mapAssetPut('../../bad',png));
});
