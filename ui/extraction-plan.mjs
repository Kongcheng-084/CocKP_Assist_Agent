import {buildReviewInput} from './review-plan.mjs';
import {focusedBlock} from './extraction-recovery.mjs';
// Conservative estimate: also reserve space for JSON, instructions and output.
import {curateCards,entityKey} from './card-policy.mjs';
import {diagnosticReport} from './citation-check.mjs';
export const estimateTokens=value=>Math.ceil(new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length/2);
export function normalizeBlocks(blocks){
 const out=[];
 for(const b of blocks){
  if(!b.text?.trim())continue;
  let start=0,part=0;
  while(start<b.text.length){let end=Math.min(start+2000,b.text.length);if(end<b.text.length){const cut=b.text.lastIndexOf('\n',end);if(cut>start+1000)end=cut+1;else if(/[\uD800-\uDBFF]/.test(b.text[end-1]))end--;}
   const text=b.text.slice(start,end);if(text.trim())out.push({...b,block_id:b.text.length<=2000?b.block_id:b.block_id+'~'+part,original_block_id:b.original_block_id||b.block_id,source_start:(b.source_start||0)+start,text});start=end;part++;
  }
 }
 return out;
}
export function validateDocument(input){
 if(!input||typeof input.title!=='string'||input.title.length>160||!Array.isArray(input.blocks)||!input.blocks.length||input.blocks.length>10000)throw new Error('请选择有文字的资料。');
 let size=0;const ids=new Set();for(const b of input.blocks){if(!b||typeof b.block_id!=='string'||b.block_id.length>160||ids.has(b.block_id)||typeof b.text!=='string'||!b.text.trim())throw new Error('原文编号或文字无效。');ids.add(b.block_id);size+=b.text.length;}
 if(size>4000000)throw new Error('本次原文超过 400 万字符，请按卷选择范围。');
 return input;
}
export function budgets(model){const known=/^(gpt-4\.1|deepseek-(flash|v4-pro))/.test(model||'');return {input:known?48000:10000,target:known?7000:2400,overview:known?18000:5000,context:known?5500:1800};}
function groups(blocks,budget){const result=[];let group=[],size=0,section;for(const b of blocks){const n=estimateTokens(b),boundary=b.section_title&&section&&b.section_title!==section&&size>budget*.4;if(group.length&&(size+n>budget||boundary)){result.push(group);group=[];size=0;}group.push(b.block_id);size+=n;section=b.section_title;}if(group.length)result.push(group);return result;}
export function planExtraction(input,model,policyVersion=1){validateDocument(input);const b=budgets(model);if(policyVersion>=3)b.target=Math.min(b.target,4500);return [
 ...groups(input.blocks,b.overview).map(ids=>({stage:'overview',target_ids:ids,status:'pending'})),
 ...groups(input.blocks,b.target).map(ids=>({stage:'detail',target_ids:ids,status:'pending'})),
 ...(policyVersion>=3?groups(input.blocks,b.target).map(ids=>({stage:'audit',target_ids:ids,status:'pending'})):[]),
 {stage:'review',target_ids:[],status:'pending'}
 ];}
const compact=f=>({category:f.category,title:f.title,text:f.text.slice(0,240),entity_name:f.entity_name||'',selection_reason:f.selection_reason||'',character_type:f.character_type||'unknown',stat_labels:(f.stats||[]).map(r=>r.label),source_ids:f.sources.map(s=>s.block_id)});
export function buildStepInput(job,index){
 if(job.steps[index].review_indexes!==undefined)return buildReviewInput(job,job.steps[index]);
 const step=job.steps[index],limit=budgets(job.model),blocks=job.input.blocks.map(b=>focusedBlock(step,b)),byId=new Map(blocks.map(b=>[b.block_id,b]));
 const maps=job.steps.filter(s=>s.stage==='overview'&&s.result).map(s=>s.result.facts),overview=[];
 // Interleave chapters so a long opening cannot consume all global context space.
 for(let n=0;n<Math.max(0,...maps.map(m=>m.length));n++)for(const map of maps)if(map[n])overview.push(compact(map[n]));
 const details=job.steps.filter(s=>['detail','audit'].includes(s.stage)&&s.result).flatMap(s=>s.result.facts);
 const issues=job.steps.filter(s=>s.result).flatMap(s=>s.result.issues);
 const context={stage:step.stage,policy_version:job.policyVersion||1,global_facts:[],existing_facts:[],issues:[],abridged:false};let contextSize=0;const keySizes={},contextBudget=step.stage==='review'?Math.min(18000,limit.input*.4):limit.context;
 const push=(key,item)=>{const size=estimateTokens(item),share=step.stage==='review'?{global_facts:.2,existing_facts:.65,issues:.15}[key]:key==='existing_facts'?.3:.7;if(contextSize+size>contextBudget||(keySizes[key]||0)+size>contextBudget*share){context.abridged=true;return;}context[key].push(item);contextSize+=size;keySizes[key]=(keySizes[key]||0)+size;};
 if(step.stage!=='overview')for(const f of overview)push('global_facts',f);
 if(step.stage==='review'){for(const i of issues)push('issues',i);for(const f of details)if(!step.target_ids.length||f.sources.some(s=>step.target_ids.includes(s.block_id)))push('existing_facts',compact(f));}
 else if(step.stage==='audit')for(const f of details.filter(f=>f.sources.some(s=>step.target_ids.includes(s.block_id))))push('existing_facts',compact(f));
 else if(step.stage==='detail')for(const f of details)if(['truth','npc','scene'].includes(f.category))push('existing_facts',{title:f.title,category:f.category,entity_name:f.entity_name||''});
 if(step.stage==='audit'){context.validation_gaps=[];const targets=new Set(step.target_ids);for(const prior of job.steps.filter(s=>s.result))for(const r of prior.result.rejected||[]){const ids=r.source_ids?.length?r.source_ids:r.candidate?.sources?.length?r.candidate.sources.map(s=>s.block_id):prior.target_ids;if(!ids.some(id=>targets.has(id)))continue;const item={title:r.title,category:r.category,reason:r.reason,source_ids:ids},size=estimateTokens(item);if(contextSize+size>contextBudget){context.abridged=true;continue;}context.validation_gaps.push(item);contextSize+=size;}}
 const selected=new Set(step.target_ids);let used=estimateTokens({title:job.input.title,context})+2000;
 for(const id of selected){const b=byId.get(id);if(b)used+=estimateTokens(b);}
 const targeted=['detail','audit'].includes(step.stage)||!!step.focus||step.stage==='review'&&step.target_ids.length;const sourceBudget=targeted?Math.min(limit.input,used+(step.focus?1200:5000)):limit.input;context.target_only=!!targeted;
 const add=id=>{if(selected.has(id)||!byId.has(id))return;const n=estimateTokens(byId.get(id));if(used+n>sourceBudget){context.abridged=true;return;}selected.add(id);used+=n;};
 if(step.stage!=='overview'){
  // Short documents are supplied in full. Longer ones carry neighbours and exact global evidence.
  const allSize=blocks.reduce((n,b)=>n+estimateTokens(b),0);
  if(!targeted&&allSize+estimateTokens(context)+2000<=limit.input)for(const b of blocks)add(b.block_id);
  else{
   if(step.stage==='review'){add(blocks[0].block_id);add(blocks.at(-1).block_id);}
   for(const id of step.target_ids){const pos=blocks.findIndex(b=>b.block_id===id);if(pos>0)add(blocks[pos-1].block_id);if(pos+1<blocks.length)add(blocks[pos+1].block_id);}
   for(const issue of issues.filter(i=>i.type==='needs_context'||i.type==='conflict'))for(const id of issue.source_block_ids)add(id);
   for(const f of overview)for(const id of f.source_ids)add(id);
  }
 }
 return {title:job.input.title,blocks:blocks.filter(b=>selected.has(b.block_id)),context,target_block_ids:step.target_ids};
}
export function mergeResults(job){
 let facts=job.policyVersion>=2?[]:[...(job.result?.facts||[])];const seen=new Set(facts.map(f=>JSON.stringify([f.category,f.title,f.text]))),issues=[],rejected=[],processed=new Set(),unreadable=new Set(),decisions=[];
 for(const s of job.steps){if(!s.result)continue;issues.push(...s.result.issues);rejected.push(...(s.result.rejected||[]));if(s.stage==='overview')continue;if(s.stage==='review')decisions.push(...(s.result.decisions||[]));for(const f of s.result.facts){const key=JSON.stringify([f.category,f.title,f.text]);if(job.policyVersion>=2||!seen.has(key)){seen.add(key);facts.push(f);}}
  // Context pages read by a model are not counted as detailed extraction coverage.
  if(s.stage==='detail'){for(const id of s.target_ids){if(s.result.coverage.processed_block_ids.includes(id)&&job.steps.filter(other=>other.stage==='detail'&&other.target_ids.includes(id)).every(other=>other.result?.coverage.processed_block_ids.includes(id)))processed.add(id);if(s.result.coverage.unreadable_block_ids.includes(id))unreadable.add(id);}}
 }
 const dedup=items=>[...new Map(items.map(x=>[JSON.stringify(x),x])).values()];
 let omitted=[],reviewAdvisories=[];if(job.policyVersion>=2){const curated=curateCards(facts,decisions);facts=curated.facts;omitted=curated.omitted;issues.push(...curated.issues);reviewAdvisories=curated.rejectedDecisions.map(d=>({title:d.title,reason:'复核分类决定无效，已保留原条目。'}));}
 const diagnostics=diagnosticReport(job,facts);diagnostics.advisories.push(...reviewAdvisories);
 for(const [i,s] of job.steps.entries())if(s.stage==='overview'&&s.result?.facts?.length===0&&s.result.rejected?.length)issues.push({type:'needs_context',description:'第 '+(i+1)+' 批背景梳理没有形成通过校验的索引，相关跨页关联仍需核对。原文仍会进入后续详细提取。',source_block_ids:s.target_ids,affected_titles:[]});
 if(job.policyVersion>=2&&job.result?.facts){const key=f=>entityKey(f)||JSON.stringify([f.category,f.title,f.text]),positions=new Map(job.result.facts.map((f,i)=>[key(f),i]));facts.sort((a,b)=>(positions.get(key(a))??1e9)-(positions.get(key(b))??1e9));}
 return {facts,omitted,issues:dedup(issues),rejected:diagnostics.pending,diagnostics,coverage:{processed_block_ids:[...processed],unreadable_block_ids:[...unreadable],unprocessed_block_ids:job.input.blocks.filter(b=>!processed.has(b.block_id)&&!unreadable.has(b.block_id)).map(b=>b.block_id)}};
}
