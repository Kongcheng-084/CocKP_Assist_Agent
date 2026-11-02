(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./lightless-data.js') : root.KeeperSample, typeof module === 'object' && module.exports ? require('./character-data.js') : root.KeeperCharacters);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KeeperCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (sampleData,Characters) {
  'use strict';
  const VERSION = 1;
  const categories = {truth:'核心真相',npc:'人物',scene:'场景',clue:'线索',timeline:'时间线'};
  const factGroup=f=>f.aiRunId||'manual';
  function extractionGroups(state){
    const map=new Map((state.aiGroups||[]).map(g=>[g.id,{...g}]));
    for(const f of state.facts){const id=factGroup(f);if(!map.has(id)){const old=state.aiRuns?.find(r=>r.id===id);map.set(id,{id,at:old?.at||null,model:old?.model||'',providerName:old?.providerName||''});}}
    if(!map.size||state.activeExtractionId==='manual')map.set('manual',{id:'manual'});
    let n=0;return [...map.values()].map(g=>{const list=state.facts.filter(f=>factGroup(f)===g.id);return {...g,label:g.id==='manual'?'手动 / 导入资料':'提取 '+(++n),total:list.length,approved:list.filter(f=>f.approved).length};});
  }
  function activeGroup(state){const groups=extractionGroups(state);return groups.some(g=>g.id===state.activeExtractionId)?state.activeExtractionId:groups.at(-1).id;}
  function groupFacts(state,id=activeGroup(state)){return state.facts.filter(f=>factGroup(f)===id);}
  // Layout is separate from fact order, so arranging cards cannot invalidate a prep pack.
  function orderedWallFacts(state,category,group=activeGroup(state)){
    const list=groupFacts(state,group).filter(f=>f.category===category),remaining=new Map(list.map(f=>[f.id,f])),ordered=[];
    for(const id of state.wallOrders?.[group]?.[category]||[]){const fact=remaining.get(id);if(fact){ordered.push(fact);remaining.delete(id);}}
    return ordered.concat([...remaining.values()]);
  }
  function swapWallFacts(state,category,first,second,group=activeGroup(state)){
    if(!Object.hasOwn(categories,category)||group!==activeGroup(state)||first===second)return false;
    const ids=orderedWallFacts(state,category,group).map(f=>f.id),a=ids.indexOf(first),b=ids.indexOf(second);
    if(a<0||b<0)return false;
    [ids[a],ids[b]]=[ids[b],ids[a]];
    state.wallOrders={...state.wallOrders,[group]:{...state.wallOrders?.[group],[category]:ids}};
    return true;
  }
  function ensureGroups(state){
    state.packs=state.packs||{};
    if(state.pack){if(!state.pack.groupId){const ids=new Set(state.pack.facts.map(factGroup));if(ids.size===1)state.pack.groupId=[...ids][0];else{state.legacyPack=state.pack;state.pack=null;}}
      if(state.pack)state.packs[state.pack.groupId]=state.pack;}
    state.activeExtractionId=activeGroup(state);state.pack=state.packs[state.activeExtractionId]||null;
  }
  function selectGroup(state,id){if(!extractionGroups(state).some(g=>g.id===id))throw new Error('提取记录不存在。');ensureGroups(state);state.activeExtractionId=id;state.pack=state.packs[id]||null;}
  function registerGroup(state,run){ensureGroups(state);state.aiGroups=extractionGroups(state).filter(g=>g.id!=='manual').map(({id,at,model,providerName})=>({id,at,model,providerName}));const meta={id:run.id,at:run.at||new Date().toISOString(),model:run.model||'',providerName:run.providerName||''},old=state.aiGroups.find(g=>g.id===run.id);if(old)Object.assign(old,meta);else state.aiGroups.push(meta);}
  function packSignature(state){return JSON.stringify([groupFacts(state).filter(f=>f.approved),state.blocks.filter(b=>b.sourceStale).map(b=>b.id)]);}
  function confirmGroup(state,{category,characterType}={}){let confirmed=0,blocked=0;for(const f of groupFacts(state)){if(category&&f.category!==category||characterType&&characterType!=='all'&&Characters.type(f)!==characterType||f.approved)continue;if(f.sources.some(id=>state.blocks.find(b=>b.id===id)?.sourceStale)){blocked++;continue;}f.approved=true;confirmed++;}if(confirmed)touch(state);return {confirmed,blocked};}
  function sample() { return JSON.parse(JSON.stringify(sampleData)); }
  function classify(text) {
    if (/线索|笔记|日记|信件|记录|证据/.test(text)) return 'clue';
    if (/NPC|人物|角色|身份|动机/i.test(text)) return 'npc';
    if (/时间线|凌晨|午夜|\d+[：:]\d+|第[一二三四五六七八九十]天/.test(text)) return 'timeline';
    if (/场景|地点|房间|入口|出口/.test(text)) return 'scene';
    return 'truth';
  }
  function fromText(text, filename) {
    const cleaned=String(text).replace(/^\uFEFF/,'').trim();
    if (!cleaned) throw new Error('文件里没有可读取的文字。');
    if (cleaned.length>120000) throw new Error('Demo 暂支持 12 万字以内的文本，请拆分后导入。');
    let current='正文', blocks=[];
    cleaned.split(/\r?\n\s*\r?\n/).forEach(paragraph=>{
      const lines=paragraph.split(/\r?\n/);
      if (/^#{1,6}\s+/.test(lines[0])) current=lines.shift().replace(/^#{1,6}\s+/,'').trim();
      const body=lines.join('\n').trim();
      if(body) {
        // Split long paragraphs at line boundaries or a safe maximum size.
        let parts=body.match(/[\s\S]{1,1600}/g)||[];
        parts.forEach(part=>blocks.push({id:'b'+(blocks.length+1),number:blocks.length+1,title:current,text:part}));
      }
    });
    if (!blocks.length) throw new Error('只找到标题，没有正文。请添加正文后重试。');
    return {version:VERSION,title:filename.replace(/\.(txt|md)$/i,'')||'未命名模组',kind:'custom',sourceName:filename,step:1,view:'facts',filter:'all',packTab:'all',players:'未设置',duration:'未设置',notes:'',blocks,
      facts:blocks.map((b,i)=>({id:'f'+(i+1),category:classify(b.title+' '+b.text),title:b.title==='正文'?'资料片段 '+(i+1):b.title,text:b.text,sources:[b.id],publicCandidate:false,nature:'source',approved:false,playerApproved:false,edited:false})),revision:0,pack:null,updatedAt:null};
  }
  function deleteFact(state,id) {
    const fact=groupFacts(state).find(f=>f.id===id);if(!fact)return false;
    const group=activeGroup(state);ensureGroups(state);
    // Keep the record selectable even after removing its final card.
    state.facts=state.facts.filter(f=>f.id!==id);
    for(const ids of Object.values(state.wallOrders?.[group]||{})){const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);}
    touch(state);return true;
  }
  function touch(state) {state.revision++;state.updatedAt=new Date().toISOString();}
  function approve(state,id,value) {const fact=state.facts.find(f=>f.id===id);if(!fact)return;if(value&&fact.sources.some(id=>state.blocks.find(b=>b.id===id)?.sourceStale))throw new Error('原文已更新，请重新提取或核对后添加这条资料。');fact.approved=value;if(!value)fact.playerApproved=false;touch(state);}
  function edit(state,id,patch) {
    const f=state.facts.find(f=>f.id===id);if(!f)return;if(patch.stats!==undefined&&!Characters.validStats(patch.stats))throw new Error('数值格式无效。');
    f.title=String(patch.title).trim();f.text=String(patch.text).trim();f.category=patch.category in categories?patch.category:f.category;
    if(patch.character_type!==undefined)f.character_type=Object.hasOwn(Characters.types,patch.character_type)?patch.character_type:'unknown';if(patch.stats!==undefined){if(!Characters.validStats(patch.stats))throw new Error('数值格式无效。');f.stats=JSON.parse(JSON.stringify(patch.stats));}f.nature=patch.nature||'edited';f.edited=true;f.approved=false;f.playerApproved=false;touch(state);
  }
  function createFact(state,patch){
    const title=String(patch.title||'').trim(),text=String(patch.text||'').trim();if(!title||title.length>120||!text||text.length>15000||!Object.hasOwn(categories,patch.category))throw new Error('请填写有效的标题、正文和分类。');const stats=patch.stats||[];if(!Characters.validStats(stats))throw new Error('数值格式无效。');
    const group=activeGroup(state),id='custom-'+(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2)),fact={id,title,text,category:patch.category,character_type:Object.hasOwn(Characters.types,patch.character_type)?patch.character_type:'unknown',stats:JSON.parse(JSON.stringify(stats)),sources:[],custom:true,nature:'edited',edited:true,approved:false,playerApproved:false,...(group==='manual'?{}:{aiRunId:group})};state.facts.push(fact);touch(state);return fact;
  }
  function generate(state) {
    ensureGroups(state);const facts=groupFacts(state).filter(f=>f.approved);
    if (!facts.length) throw new Error('请先确认至少一条事实。');
    state.pack={revision:state.revision,groupId:activeGroup(state),inputSignature:packSignature(state),createdAt:new Date().toISOString(),facts:JSON.parse(JSON.stringify(facts))};state.packs[state.pack.groupId]=state.pack;
    state.step=2;state.view='pack';
    return state.pack;
  }
  function stale(state){return !!state.pack && (!!state.pack.groupId&&state.pack.groupId!==activeGroup(state)||(state.pack.inputSignature?state.pack.inputSignature!==packSignature(state):state.pack.revision!==state.revision));}
  function playerFacts(state){return groupFacts(state).filter(f=>f.approved&&f.playerApproved);}
  function sourceLabel(state,f){if(!f.sources.length)return f.custom?'自定义 · 未关联原文':'未关联原文';return f.sources.map(id=>{const b=state.blocks.find(x=>x.id===id);return b?(b.page?'PDF 第 '+b.page+' 页':'§'+String(b.number).padStart(2,'0')):'来源缺失';}).join('、');}
  function markdown(state,audience) {
    const player=audience==='player';
    if(!player&&(!state.pack||stale(state)))throw new Error('请先根据最新事实生成备团包。');
    const facts=player?playerFacts(state):state.pack.facts;
    if(!facts.length)throw new Error('还没有批准可导出的玩家材料。');
    const lines=['# '+state.title+' · '+(player?'玩家材料':'KP 备团包'),''];
    if(player){facts.forEach(f=>lines.push('## '+f.title,'',Characters.factText(f),''));return lines.join('\n');}
    lines.push('> KP 专用 · 仅依据已确认事实整理','', '人数：'+state.players+' ｜ 时长：'+state.duration,'');
    Object.entries(categories).forEach(([key,label])=>{
      const group=facts.filter(f=>f.category===key);if(!group.length)return;
      lines.push('## '+label,'');
      group.forEach(f=>lines.push('### '+f.title,'',Characters.factText(f),'','性质：'+natureLabel(f.nature)+' ｜ 来源：'+state.sourceName+' '+sourceLabel(state,f),''));
    });
    lines.push('## 开团前检查','','- 确认关键线索的获得条件。','- 确认时间触发条件与尚未确定的数值。','- 查阅所采用规则版本的相关条目。','- 与玩家确认题材边界、暂停信号与游戏时长。','');
    if(state.notes.trim())lines.push('## KP 手记','',state.notes.trim(),'');
    lines.push('## 来源索引','');
    const used=new Set(facts.flatMap(f=>f.sources));
    state.blocks.filter(b=>used.has(b.id)).forEach(b=>lines.push('- '+(b.page?'PDF 第 '+b.page+' 页':'§'+String(b.number).padStart(2,'0'))+' '+b.title));
    return lines.join('\n');
  }
  function natureLabel(value){return {source:'原文整理',edited:'KP 修改',suggestion:'改编建议',unknown:'待确定'}[value]||'待确认';}
  function validateSaved(s) {
    return s&&s.version===VERSION&&typeof s.title==='string'&&Array.isArray(s.blocks)&&Array.isArray(s.facts)&&s.blocks.every(b=>typeof b.id==='string'&&typeof b.text==='string')&&s.facts.every(f=>typeof f.id==='string'&&typeof f.text==='string'&&Array.isArray(f.sources));
  }
  return {VERSION,characters:Characters,factText:Characters.factText,createFact,deleteFact,categories,sample,fromText,approve,edit,generate,touch,stale,playerFacts,sourceLabel,markdown,natureLabel,validateSaved,factGroup,extractionGroups,activeGroup,groupFacts,orderedWallFacts,swapWallFacts,ensureGroups,selectGroup,registerGroup,confirmGroup};
});
