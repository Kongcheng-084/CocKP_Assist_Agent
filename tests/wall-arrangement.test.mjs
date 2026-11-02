import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Store,projectValid} from '../desktop/store.mjs';
const C=createRequire(import.meta.url)('../ui/core.js');
const ids=(state,wall='clue',group)=>C.orderedWallFacts(state,wall,group).map(f=>f.id);
function seed(){
  const state=C.fromText('可核对的原文。','换位.txt');
  state.facts=['a','b','c','d'].map((id,i)=>({id,title:'线索 '+id,text:'可核对的原文。',category:'clue',sources:['b1'],approved:i%2===0,playerApproved:i===0,nature:'source'}));
  return state;
}

test('交换任意两张卡而非插入移动，隐藏卡保留原位，内容与备团包不失效',()=>{
  const state=seed();C.generate(state);const facts=JSON.stringify(state.facts),pack=JSON.stringify(state.pack),revision=state.revision,md=C.markdown(state,'kp');
  assert.equal(C.swapWallFacts(state,'clue','a','d'),true);
  assert.deepEqual(ids(state),['d','b','c','a']);
  assert.equal(JSON.stringify(state.facts),facts);assert.equal(JSON.stringify(state.pack),pack);assert.equal(state.revision,revision);assert.equal(C.stale(state),false);assert.equal(C.markdown(state,'kp'),md);
  // Search/approval filters are applied after the full wall's order is resolved.
  C.swapWallFacts(state,'clue','c','a');assert.deepEqual(ids(state),['d','b','a','c']);
  assert.deepEqual(C.orderedWallFacts(state,'clue').filter(f=>f.approved).map(f=>f.id),['a','c']);
});

test('五面墙和多组提取记录独立排列，不接受跨墙、跨组、缺失或同卡换位',()=>{
  const state=seed(),a=crypto.randomUUID(),b=crypto.randomUUID();state.facts=[];
  for(const group of [a,b]){
    C.registerGroup(state,{id:group});C.selectGroup(state,group);
    for(const wall of Object.keys(C.categories))for(const n of [1,2])C.createFact(state,{title:wall+n,text:'卡片正文',category:wall});
  }
  const original=JSON.stringify(state.facts);
  for(const wall of Object.keys(C.categories)){const before=ids(state,wall);assert.equal(C.swapWallFacts(state,wall,...before),true);assert.deepEqual(ids(state,wall),before.toReversed());assert.deepEqual(ids(state,wall,a),state.facts.filter(f=>f.aiRunId===a&&f.category===wall).map(f=>f.id));}
  const before=JSON.stringify(state.wallOrders),current=ids(state),other=ids(state,'clue',a);
  assert.equal(C.swapWallFacts(state,'clue',current[0],other[0]),false);
  assert.equal(C.swapWallFacts(state,'clue',...other,a),false);
  assert.equal(C.swapWallFacts(state,'clue',current[0],ids(state,'npc')[0]),false);
  assert.equal(C.swapWallFacts(state,'clue','missing',current[0]),false);
  assert.equal(C.swapWallFacts(state,'clue',current[0],current[0]),false);
  assert.equal(C.swapWallFacts(state,'__proto__',...current),false);
  assert.equal(JSON.stringify(state.wallOrders),before);assert.equal(JSON.stringify(state.facts),original);
});

test('旧项目沿用原序，新增卡追加，删除/改分类不产生幽灵卡或丢失卡',()=>{
  const state=seed();assert.deepEqual(ids(state),['a','b','c','d']);assert.equal(state.wallOrders,undefined);
  C.swapWallFacts(state,'clue','a','c');state.facts=state.facts.filter(f=>f.id!=='b');
  C.edit(state,'c',{title:'改成场景',text:'可活动空间',category:'scene'});
  const added=C.createFact(state,{title:'新线索',text:'新内容',category:'clue'});
  assert.deepEqual(ids(state),['a','d',added.id]);assert.deepEqual(ids(state,'scene'),['c']);
  C.swapWallFacts(state,'clue','a',added.id);assert.deepEqual(state.wallOrders.manual.clue,[added.id,'d','a']);
});

test('重启、历史版本、完整备份均保存布局，恢复时同步更换提取组编号',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'keeper-wall-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const store=await new Store(dir).init(seed()),state=await store.load((await store.list())[0].id),group=crypto.randomUUID();
  C.swapWallFacts(state,'clue','a','d');
  C.registerGroup(state,{id:group});C.selectGroup(state,group);
  const first=C.createFact(state,{title:'NPC甲',text:'正文',category:'npc'}),second=C.createFact(state,{title:'敌人乙',text:'正文',category:'npc'});
  C.swapWallFacts(state,'npc',first.id,second.id);await store.save(state._projectId,state);
  const restarted=new Store(dir),reloaded=await restarted.load(state._projectId);assert.deepEqual(reloaded.wallOrders,state.wallOrders);
  C.swapWallFacts(reloaded,'npc',first.id,second.id);await store.save(state._projectId,reloaded);
  await store.restoreHistory(state._projectId,(await store.history(state._projectId))[0].name);
  assert.deepEqual((await store.load(state._projectId)).wallOrders,state.wallOrders);
  const restored=await store.importBackup(await store.backup(state._projectId));assert.ok(projectValid(restored));
  const next=restored.aiGroups[0].id;assert.notEqual(next,group);assert.equal(restored.wallOrders[group],undefined);
  assert.deepEqual(ids(restored,'npc',next),[second.id,first.id]);assert.deepEqual(ids(restored,'clue','manual'),['d','b','c','a']);
});

test('拒绝格式异常的布局；兼容没有布局字段的现存项目',()=>{
  const state=seed();assert.ok(projectValid(state));
  for(const order of [null,[],{manual:{clue:['a','a']}},{manual:{clue:['../a']}},{manual:{fake:['a']}},{fake:{clue:['a']}},{manual:{clue:'a'}},{manual:[]}])assert.equal(Boolean(projectValid({...state,wallOrders:order})),false);
  assert.ok(projectValid({...state,wallOrders:{manual:{clue:['a','no-longer-present']}}}));
});
