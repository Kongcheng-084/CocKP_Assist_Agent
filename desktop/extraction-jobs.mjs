import {installReviewPlan,validReviewStep} from '../ui/review-plan.mjs';
import {validFocus,splitFailedStep} from '../ui/extraction-recovery.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {atomicWrite,projectId} from './store.mjs';
import {normalizeBlocks,validateDocument,planExtraction,buildStepInput,mergeResults} from '../ui/extraction-plan.mjs';
import {validateResult} from '../ui/ai-core.mjs';
import {providerInfo} from '../ui/providers.mjs';
import {POLICY_VERSION} from '../ui/card-policy.mjs';
import {diagnosticKey} from '../ui/citation-check.mjs';
const cleanError=e=>String(e?.message||e||'任务未完成。').replace(/sk-[\w.-]+/g,'[已隐藏密钥]').slice(0,800);
const stageNames={overview:'全局梳理',detail:'详细提取',audit:'逐段查漏',review:'跨章核对'};
export class ExtractionJobs{
 constructor({root,prepare,onChange=()=>{}}){this.folder=path.join(root,'extraction-jobs');this.prepare=prepare;this.onChange=onChange;this.jobs=new Map();this.queue=Promise.resolve();this.running=null;this.controller=null;this.shuttingDown=false;}
 async init(){this.loadWarnings=[];await fs.mkdir(this.folder,{recursive:true});for(const name of await fs.readdir(this.folder)){if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;try{
  const j=JSON.parse(await fs.readFile(path.join(this.folder,name),'utf8'));if(this.jobs.has(j.id))continue;if(j.id+'.json'!==name||j.version!==1||!Array.isArray(j.steps)||!j.input||typeof j.at!=='string'||!['queued','running','paused','failed','completed'].includes(j.status)||j.steps.some(s=>!['overview','detail','audit','review'].includes(s.stage)||!Array.isArray(s.target_ids)||!validFocus(s,j.input.blocks)||!validReviewStep(s,j))||j.result&&(!Array.isArray(j.result.facts)||!Array.isArray(j.result.issues)||!Array.isArray(j.result.coverage?.unprocessed_block_ids)||!Array.isArray(j.result.coverage?.unreadable_block_ids)))throw new Error('任务格式无效');projectId(j.id);projectId(j.projectId);validateDocument(j.input);
  if(j.result)j.result=mergeResults(j);this.jobs.set(j.id,j);if(['running','queued'].includes(j.status)){j.status='paused';j.error='上次退出时任务未完成，点击继续后再发送请求。';for(const s of j.steps)if(s.status==='running')s.status='pending';await this.persist(j);}
 }catch{this.jobs.delete(name.slice(0,-5));this.loadWarnings.push(name);}}return this;}
 summary(j){const step=j.steps.find(s=>s.status==='running')||j.steps.find(s=>s.status!=='done');return {id:j.id,projectId:j.projectId,title:j.input.title,at:j.at,updatedAt:j.updatedAt,status:j.status,stage:stageNames[step?.stage]||'已完成',done:j.steps.filter(s=>s.status==='done').length,total:j.steps.length,facts:j.result?.facts.length||0,issues:(j.result?.issues.length||0)+(j.result?.rejected.length||0)+(j.missingPages?.length||0)+(j.result?.coverage.unprocessed_block_ids.length||0)+(j.result?.coverage.unreadable_block_ids.length||0),error:j.error||'',failure:step?.failure||null,failedUsage:j.failedUsage||null,range:j.range,model:j.model,providerName:j.providerName,usage:j.usage};}
 list(){return [...this.jobs.values()].sort((a,b)=>b.at.localeCompare(a.at)).map(j=>this.summary(j));}
 get(id){projectId(id);const j=this.jobs.get(id);if(!j)throw new Error('提取任务不存在。');return structuredClone(j);}
 persist(j){j.updatedAt=new Date().toISOString();const text=JSON.stringify(j);const task=this.queue.then(()=>atomicWrite(path.join(this.folder,j.id+'.json'),text));this.queue=task.catch(()=>{});return task;}
 emit(){try{this.onChange(this.list());}catch{}}
 async start(spec){if(this.shuttingDown)throw new Error('应用正在退出。');projectId(spec.projectId);const provider=providerInfo(spec.provider);if(typeof spec.model!=='string'||!/^[\w.:-]{1,100}$/.test(spec.model))throw new Error('模型无效。');
  if(this.list().filter(j=>['queued','running'].includes(j.status)).length>=10)throw new Error('已有 10 项任务，请等待或停止后再添加。');
  validateDocument(spec.input);const input={title:spec.input.title,blocks:normalizeBlocks(spec.input.blocks)};validateDocument(input);
  const job={version:1,policyVersion:POLICY_VERSION,id:crypto.randomUUID(),projectId:spec.projectId,documentId:spec.documentId||null,sourceName:spec.sourceName,input,range:spec.range,missingPages:spec.missingPages||[],provider:provider.id,providerName:provider.name,model:spec.model,at:new Date().toISOString(),status:'queued',steps:planExtraction(input,spec.model,POLICY_VERSION),result:null,usage:{input_tokens:0,output_tokens:0},imported:[]};
  this.jobs.set(job.id,job);try{await this.persist(job);}catch(e){this.jobs.delete(job.id);throw e;}this.emit();this.pump();return this.summary(job);
 }
 async stop(id){const j=this.jobs.get(projectId(id));if(!j)throw new Error('任务不存在。');if(!['queued','running'].includes(j.status))return this.summary(j);j.status='paused';j.error='已停止。已完成批次保留；当前请求可能仍计费。';if(this.running===id)this.controller?.abort();await this.persist(j);this.emit();return this.summary(j);}
 async resume(id){const j=this.jobs.get(projectId(id));if(!j||!['paused','failed'].includes(j.status))throw new Error('任务当前无法继续。');if(this.shuttingDown)throw new Error('应用正在退出。');if(this.running===id)throw new Error('正在停止当前请求，请稍后继续。');
  installReviewPlan(j);j.steps=j.steps.flatMap(s=>splitFailedStep(s,j.input));
  for(const s of j.steps)if(s.status!=='done'){s.status='pending';delete s.error;}j.status='queued';j.error='';await this.persist(j);this.emit();this.pump();return this.summary(j);}
 pump(){if(this.running||this.shuttingDown)return;const j=[...this.jobs.values()].find(j=>j.status==='queued');if(!j)return;this.running=j.id;this.controller=new AbortController();
  this.run(j,this.controller.signal).catch(e=>{j.status='failed';j.error='检查点保存失败：'+cleanError(e);this.emit();}).finally(()=>{this.running=null;this.controller=null;this.pump();});
 }
 async run(j,signal){j.status='running';await this.persist(j);this.emit();try{
  const execute=await this.prepare(j);
  for(let i=0;i<j.steps.length;i++){
   if(signal.aborted||j.status!=='running')break;if(j.steps[i].stage==='review'&&installReviewPlan(j)){await this.persist(j);this.emit();}const step=j.steps[i];if(step.status==='done')continue;
   step.status='running';step.error='';delete step.failure;await this.persist(j);this.emit();const input=buildStepInput(j,i);
   try{const response=await execute(input,signal);if(signal.aborted||j.status!=='running')break;
    const result=validateResult(response.result,input);result.rejected=[...(response.result.rejected||[]),...result.rejected];result.repairs=[...(response.result.repairs||[]),...result.repairs];result.advisories=[...(response.result.advisories||[]),...result.advisories];
    step.result=result;step.source_ids=input.blocks.map(b=>b.block_id);step.status='done';step.usage=response.usage||null;
    j.usage={input_tokens:j.steps.reduce((n,s)=>n+(s.usage?.input_tokens||0),0),output_tokens:j.steps.reduce((n,s)=>n+(s.usage?.output_tokens||0),0)};j.result=mergeResults(j);await this.persist(j);this.emit();
   }catch(e){if(signal.aborted||j.status!=='running')break;step.status='failed';step.error=cleanError(e);step.failure={code:typeof e.code==='string'?e.code:'unknown',...(e.diagnostic||{})};j.failureHistory=[...(j.failureHistory||[]),{at:new Date().toISOString(),stage:step.stage,target_ids:step.target_ids,focus:step.focus,error:step.error,...step.failure}].slice(-100);j.failedUsage={input_tokens:(j.failedUsage?.input_tokens||0)+(e.diagnostic?.usage?.input_tokens||0),output_tokens:(j.failedUsage?.output_tokens||0)+(e.diagnostic?.usage?.output_tokens||0)};j.status='failed';j.error=step.error;await this.persist(j);this.emit();return;}
  }
  if(signal.aborted||j.status!=='running'){for(const s of j.steps)if(s.status==='running')s.status='pending';if(j.status==='running')j.status='paused';}
  else{j.status='completed';j.error='';j.result=mergeResults(j);}
  await this.persist(j);this.emit();
 }catch(e){j.status=signal.aborted?'paused':'failed';j.error=cleanError(e);for(const s of j.steps)if(s.status==='running')s.status='pending';await this.persist(j);this.emit();}}
 async repair(id,recordId,fact){const j=this.jobs.get(projectId(id));if(!j)throw new Error('任务不存在。');if(['queued','running'].includes(j.status)||this.running===id)throw new Error('请等待任务完成或停止后，再校对草稿。');
  const match=/^(\d+):(\d+)$/.exec(String(recordId));if(!match)throw new Error('校验记录无效。');const step=j.steps[Number(match[1])],record=step?.result?.rejected?.[Number(match[2])];if(!record?.candidate||record.resolved)throw new Error('这条记录缺少原始草稿，或已完成校对。');
  const result=validateResult({facts:[fact],issues:[],decisions:[],coverage:{processed_block_ids:[],unreadable_block_ids:[]}},{...j.input,context:{stage:step.stage,policy_version:j.policyVersion||1,existing_facts:[]}},{local:true});
  if(!result.facts.length)throw new Error(result.rejected[0]?.reason||'校对内容尚未通过检查。');const corrected={...result.facts[0],reviewedByKeeper:true},key=diagnosticKey({...record,stage:step.stage});
  const before=structuredClone(j);step.result.facts.push(corrected);step.result.repairs=[...(step.result.repairs||[]),...result.repairs];
  for(const s of j.steps)for(const r of s.result?.rejected||[])if(diagnosticKey({...r,stage:s.stage})===key){r.resolved=true;r.resolvedAt=new Date().toISOString();r.resolvedTitle=corrected.title;}
  j.result=mergeResults(j);try{await this.persist(j);}catch(e){Object.assign(j,before);throw e;}this.emit();return this.summary(j);
 }
 async shutdown(){this.shuttingDown=true;this.controller?.abort();for(const j of this.jobs.values())if(['queued','running'].includes(j.status)){j.status='paused';j.error='软件已退出，点击继续后恢复剩余批次。';for(const s of j.steps)if(s.status==='running')s.status='pending';await this.persist(j);}await this.queue;}
}
