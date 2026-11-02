(function(root,factory){const api=factory();root.KeeperCharacters=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,function(){
 const sections=['属性','派生','技能','战斗','能力','其他'];
 const types={npc:'NPC',enemy:'敌人',unknown:'待分类'};
 const type=f=>Object.hasOwn(types,f.character_type)?f.character_type:'unknown';
 function validStats(rows){return Array.isArray(rows)&&rows.length<=120&&rows.every(r=>r&&sections.includes(r.section)&&typeof r.label==='string'&&r.label.trim()&&r.label.length<=80&&typeof r.value==='string'&&r.value.trim()&&r.value.length<=600&&(r.source_block_ids===undefined||Array.isArray(r.source_block_ids)&&r.source_block_ids.every(id=>typeof id==='string'&&id.length<=160)));}
 function parseStats(text){const rows=String(text||'').split(/\r?\n/).filter(x=>x.trim()).map(line=>{const parts=line.split('|').map(x=>x.trim());if(parts.length<3)throw new Error('数值每行填写：分组 | 名称 | 数值');return {section:parts[0],label:parts[1],value:parts.slice(2).join(' | ')};});if(!validStats(rows))throw new Error('请检查数值分组、名称和内容，最多 120 行。');return rows;}
 const statsText=f=>(f.stats||[]).map(r=>[r.section,r.label,r.value].join(' | ')).join('\n');
 function legacyStats(f){const text=f.text||'',rows=[],pattern=/\b(STR|CON|SIZ|DEX|INT|APP|POW|EDU|SAN|HP|MP|DB|Build|Move|MOV)\s*[:：]?\s*([+−-]?\d+(?:[dD]\d+)?|[—–])/gi;let m;while((m=pattern.exec(text)))if(!rows.some(r=>r.label.toUpperCase()===m[1].toUpperCase()))rows.push({section:/^(STR|CON|SIZ|DEX|INT|APP|POW|EDU)$/i.test(m[1])?'属性':'派生',label:m[1],value:m[2]});return rows;}
 const visibleStats=f=>f.stats?.length?f.stats:f.category==='npc'?legacyStats(f):[];
 function factText(f){const rows=visibleStats(f);return (f.text||'')+(rows.length?'\n\n'+sections.flatMap(s=>{const list=rows.filter(r=>r.section===s);return list.length?[s,...list.map(r=>'- '+r.label+'：'+r.value)]:[];}).join('\n'):'');}
 function mergeStats(a=[],b=[]){const rows=new Map();for(const r of [...a,...b]){const key=JSON.stringify([r.section,r.label,r.value]),old=rows.get(key);rows.set(key,{...r,source_block_ids:[...new Set([...(old?.source_block_ids||[]),...(r.source_block_ids||[])])]});}return [...rows.values()];}
 return {sections,types,type,validStats,parseStats,statsText,legacyStats,visibleStats,factText,mergeStats};
});
