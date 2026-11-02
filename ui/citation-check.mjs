const blank=c=>/[\s\u200b]/u.test(c);
function folded(text){let value='';const offsets=[];for(let i=0;i<text.length;i++)if(!blank(text[i])){value+=text[i];offsets.push(i);}return {value,offsets};}
function match(block,quote,allowWhitespace){
 if(block.text.includes(quote))return {block_id:block.block_id,quote,method:'exact'};
 if(!allowWhitespace)return null;const q=folded(quote).value;if(q.length<8)return null;const source=folded(block.text),pos=source.value.indexOf(q);
 if(pos<0||source.value.indexOf(q,pos+1)>=0)return null;
 const original=block.text.slice(source.offsets[pos],source.offsets[pos+q.length-1]+1);if(original.length>1800)return null;
 return {block_id:block.block_id,quote:original,method:'whitespace'};
}
export function checkCitation(source,blocks){
 if(!source||typeof source.quote!=='string'||!source.quote.trim()||source.quote.length>1800)return {ok:false,code:'quote_format',reason:'出处缺少引文，或引文过长。请填写必要的短原文。'};
 const known=blocks.find(b=>b.block_id===source.block_id);if(known){const hit=match(known,source.quote,true);if(hit)return {ok:true,source:{block_id:hit.block_id,quote:hit.quote},repair:hit.method==='whitespace'?{code:'quote_whitespace',reason:'已按原文恢复引文中的换行或空格。'}:null};}
 // A wrong reference ID can be corrected only when the quote identifies one supplied block.
 if(folded(source.quote).value.length>=8){const hits=blocks.map(b=>match(b,source.quote,true)).filter(Boolean);if(hits.length===1){const h=hits[0];return {ok:true,source:{block_id:h.block_id,quote:h.quote},repair:{code:'source_id',reason:'引文在本次原文中唯一对应，已校正出处编号。'}};}if(hits.length>1)return {ok:false,code:'quote_ambiguous',reason:'这段引文对应多处原文，无法确定出处，请选择具体位置。'};}
 return {ok:false,code:known?'quote_mismatch':'source_missing',reason:known?'引文与指定原文不一致；可能被改写、删去词语，或引用了未提供的段落。':'出处编号不在本次资料中，也没有找到唯一对应的原文。'};
}
export function candidateSnapshot(f){if(!f||typeof f!=='object')return null;const string=(v,n)=>typeof v==='string'?v.slice(0,n):'';return {category:string(f.category,30),title:string(f.title,120),text:string(f.text,16000),truncated:typeof f.text==='string'&&f.text.length>16000||Array.isArray(f.sources)&&f.sources.some(s=>typeof s?.quote==='string'&&s.quote.length>1800),character_type:string(f.character_type,20),stats:Array.isArray(f.stats)?f.stats.slice(0,120).map(r=>({section:string(r?.section,20),label:string(r?.label,80),value:string(r?.value,600),source_block_ids:Array.isArray(r?.source_block_ids)?r.source_block_ids.filter(id=>typeof id==='string').map(id=>id.slice(0,160)):[]})):[],nature:string(f.nature,30),entity_name:string(f.entity_name,120),selection_reason:string(f.selection_reason,600),sources:Array.isArray(f.sources)?f.sources.slice(0,40).map(s=>({block_id:string(s?.block_id,160),quote:string(s?.quote,1800)})):[]};}
export function diagnosticKey(r){return JSON.stringify([r.kind||'legacy',r.code||r.reason,r.category||r.candidate?.category||'',r.title,r.candidate?.text||'',r.candidate?.sources||r.source_ids||[],r.stage==='overview'?'overview':'detail']);}
export function diagnosticReport(job,facts){
 const pending=[],history=[],repaired=[],advisories=[],seen=new Set();
 for(const [stepIndex,step] of job.steps.entries()){
  for(const [itemIndex,item] of (step.result?.rejected||[]).entries()){
   const r={...item,id:stepIndex+':'+itemIndex,stage:step.stage,batch:stepIndex+1,legacy:!item.candidate&&!item.code};
   if(item.resolved){history.push({...r,state:'resolved'});continue;}
   if(step.stage==='overview'){history.push({...r,state:'overview'});continue;}
   const candidate=item.candidate;
   const recovered=candidate&&facts.some(f=>f.category===candidate.category&&f.title===candidate.title&&f.text===candidate.text&&candidate.sources.length&&candidate.sources.every(s=>f.sources.some(t=>t.block_id===s.block_id&&t.quote===s.quote)));
   if(recovered){history.push({...r,state:'recovered'});continue;}
   const key=diagnosticKey(r);if(seen.has(key))continue;seen.add(key);pending.push(r);
  }
  for(const repair of step.result?.repairs||[])repaired.push({...repair,batch:stepIndex+1,stage:step.stage});
  advisories.push(...(step.result?.advisories||[]));
 }
 const unique=list=>[...new Map(list.map(r=>[JSON.stringify([r.title,r.code,r.reason,r.stage,r.source_ids]),r])).values()];
 return {pending,history,repairs:unique(repaired),advisories:unique(advisories)};
}
