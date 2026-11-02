// Isolated Electron regression: synthetic text and a local mocked transport only.
// This script is excluded from every release. It never reads a real credential.
import {app,BrowserWindow,net,safeStorage} from 'electron';
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {testWallArrangement} from './test-wall-arrangement.mjs';
import {testMapEditor} from './test-map-editor.mjs';
const testingRelease=process.argv.includes('--release'),moduleRoot=testingRelease?path.resolve('release/'+JSON.parse(await fs.readFile('package.json','utf8')).version+'/win-unpacked/resources/app.asar'):path.resolve('.');
const {Store,atomicWrite}=await import(pathToFileURL(path.join(moduleRoot,'desktop/store.mjs')).href);
const {ExtractionJobs}=await import(pathToFileURL(path.join(moduleRoot,'desktop/extraction-jobs.mjs')).href);let jobManager;const originalJobsInit=ExtractionJobs.prototype.init;ExtractionJobs.prototype.init=async function(){jobManager=this;return originalJobsInit.call(this);};
const require=createRequire(import.meta.url),C=require('../ui/core.js');
const root=path.resolve('.runtime/background-ui-'+crypto.randomUUID());process.argv.push('--data-dir='+root);
const seed=C.fromText(Array.from({length:24},(_,i)=>'# 第 '+(i+1)+' 场\n这里记载了地下机器与灯塔回响的关系。'+('调查员推开柜门可以发现当天记录。'.repeat(65))).join('\n\n'),'后台全文验证.txt');seed.facts=[];seed.view='overview';
let originalId,otherId,store,calls=0,releaseFirst,diagnosticAdded=false,simulateTruncation=false,truncatedOnce=false;const firstGate=new Promise(r=>releaseFirst=r);
const init=Store.prototype.init;Store.prototype.init=async function(){store=this;await init.call(this,seed);originalId=(await this.list())[0].id;const other=await this.create(C.fromText('另一个项目的正文。','另一个模组.txt'));otherId=other._projectId;await this.patchSettings({provider:'deepseek',models:{deepseek:'deepseek-flash'}});await atomicWrite(path.join(root,'deepseek-key.dat'),Buffer.from('non-secret-local-test-marker'));return this;};
safeStorage.decryptStringAsync=async()=>({result:'local-placeholder-not-a-real-api-key'});
net.fetch=async(url,options)=>{
 assert.equal(url,'https://api.deepseek.com/chat/completions');calls++;const input=JSON.parse(JSON.parse(options.body).messages[1].content);
 if(calls===1)await firstGate;
 if(options.signal.aborted)throw new Error('测试请求已取消');
 await new Promise(r=>setTimeout(r,80));const block=input.source_blocks.find(b=>input.target_block_ids?.includes(b.block_id))||input.source_blocks[0];
 if(input.context.stage==='audit'&&simulateTruncation&&!truncatedOnce){truncatedOnce=true;return Response.json({choices:[{finish_reason:'length',message:{content:'{'}}],usage:{prompt_tokens:200,completion_tokens:10000}});}
 if(input.context.review_only){assert.ok(input.context.existing_facts.length<=6);assert.ok(JSON.parse(options.body).messages[0].content.includes('facts 和 decisions 必须都是空数组'));}
 const result={facts:input.context?.review_only?[]:[{category:'clue',title:'线索 '+block.block_id,text:block.text.slice(0,50),nature:'source',sources:[{block_id:block.block_id,quote:block.text.slice(0,50)}]}],issues:[],coverage:{processed_block_ids:input.context?.review_only?[]:input.source_blocks.map(b=>b.block_id),unreadable_block_ids:[]}};
 if(input.context.stage==='detail'&&!diagnosticAdded){diagnosticAdded=true;result.facts.push({category:'clue',title:'待核对引文',text:'需要校对的记录。',nature:'source',entity_name:'',selection_reason:'',sources:[{block_id:block.block_id,quote:'这段引文并不在原文中。'}]});}
 return Response.json({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:100,completion_tokens:50}});
};
const timeout=setTimeout(()=>{console.error('UI_TEST_TIMEOUT');app.exit(2);},85000);
async function until(check){for(let i=0;i<800;i++){if(await check())return;await new Promise(r=>setTimeout(r,20));}throw new Error('界面等待超时');}
app.on('browser-window-created',(_event,window)=>{window.webContents.once('did-finish-load',()=>setTimeout(()=>testUi(window).catch(e=>{console.error('UI_TEST_FAILED '+e.stack);app.exit(1);}),150));});
async function testUi(win){
 if(process.argv.includes('--map-only')){await testMapEditor(win,C,store);clearTimeout(timeout);app.exit(0);return;}
 if(process.argv.includes('--wall-only')){await testWallArrangement(win,C);clearTimeout(timeout);app.exit(0);return;}
 const js=code=>win.webContents.executeJavaScript(code);await until(()=>js('!!document.querySelector("[data-action=ai-open]")'));
 await js('document.querySelector("[data-action=ai-open]").click()');await until(()=>js('!!document.querySelector("#ai-scope")'));
 assert.equal(await js('document.querySelector("#ai-scope").value'),'full');
 const childColor=await js('getComputedStyle(document.querySelector(".modal")).backgroundColor');assert.equal(childColor,'rgb(239, 226, 211)');assert.equal(await js('getComputedStyle(document.querySelector(".overlay-backdrop")).backgroundColor'),'rgba(0, 0, 0, 0)');
 await new Promise(r=>setTimeout(r,100));await fs.writeFile('release/extraction-dialog-ui.png',(await win.webContents.capturePage()).toPNG());
 await js('document.querySelector("[data-action=ai-preview]").click()');await until(()=>js('!!document.querySelector("[data-action=ai-run]")'));
 assert.ok(seed.blocks.reduce((n,b)=>n+b.text.length,0)>18000);
 await js('document.querySelector("[data-action=ai-run]").click()');await until(()=>js('!!document.querySelector(".ai-taskbar") && !document.querySelector("#overlay .modal")'));assert.equal(await js('getComputedStyle(document.querySelector(".ai-task-orb")).borderRadius'),'50%');
 assert.equal(await js('document.querySelector("#app").inert'),false);
 await js('document.querySelector("[data-action=ai-tasks]").click()');await until(()=>js('!!document.querySelector(".ai-task-panel")'));
 await js('document.querySelector(".ai-task-panel h2").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))');assert.ok(await js('!!document.querySelector(".ai-task-panel")'));
 await js('document.querySelector("[data-view=notes]").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))');assert.equal(await js('!!document.querySelector(".ai-task-panel")'),false);assert.equal((await js('window.keeperDesktop.extractionJobs()'))[0].status,'running');
 await js('document.querySelector("[data-view=notes]").click()');await until(()=>js('!!document.querySelector("#kp-notes")'));
 await js('document.querySelector("#kp-notes").value="提取期间照常编辑";document.querySelector("#kp-notes").dispatchEvent(new Event("input",{bubbles:true}));window.KeeperDesktopUI.flush()');
 assert.equal((await store.load(originalId)).notes,'提取期间照常编辑');
 let loaded=new Promise(r=>win.webContents.once('did-finish-load',r));await js(`window.keeperDesktop.openProject(${JSON.stringify(otherId)}).then(()=>location.reload());void 0`);await loaded;
 await until(()=>js('!!window.KeeperDesktopUI && !!document.querySelector("[data-view=notes]")'));
 await js('document.querySelector("[data-view=notes]").click()');await until(()=>js('!!document.querySelector("#kp-notes")'));
 await js('document.querySelector("#kp-notes").value="另一模组的编辑";document.querySelector("#kp-notes").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#kp-notes").focus();window.KeeperDesktopUI.flush()');
 releaseFirst();await until(()=>js('window.keeperDesktop.extractionJobs().then(j=>j.length && j[0].status==="completed")'));
 assert.equal(await js('document.activeElement.id'),'kp-notes');assert.equal(await js('!!document.querySelector("#overlay .modal")'),false);
 assert.equal((await store.load(otherId)).notes,'另一模组的编辑');assert.equal((await store.load(originalId)).facts.length,0);
 const records=await js('window.keeperDesktop.extractionJobs()');assert.equal(records[0].projectId,originalId);
 loaded=new Promise(r=>win.webContents.once('did-finish-load',r));await js(`window.keeperDesktop.openProject(${JSON.stringify(originalId)}).then(()=>location.reload());void 0`);await loaded;
 await until(()=>js('!!window.KeeperDesktopInitialState && !!document.querySelector("[data-action=ai-open]")'));
 await js('window.KeeperDesktopInitialState.blocks[0].text+="原文校对变动";window.KeeperDesktopUI.saveSnapshot(window.KeeperDesktopInitialState);window.KeeperDesktopUI.flush()');
 await js('document.querySelector("[data-action=ai-open]").click()');await until(()=>js('!!document.querySelector("#ai-scope")'));await js('document.querySelector("[data-action=close]").click()');
 await js('document.querySelector("[data-action=ai-tasks]").click()');await until(()=>js('!!document.querySelector(".ai-task-panel")'));
 await js('document.querySelector("[data-action=ai-result]").click()');await until(()=>js('!!document.querySelector("[data-ai-select]")'));
 assert.equal(await js('document.querySelector("[data-ai-select=\\"0\\"]").disabled'),true);
 assert.ok(await js('document.querySelectorAll("[data-ai-select]:checked:not(:disabled)").length>0'));
 assert.ok(await js('!!document.querySelector(".ai-validation")'));await js('document.querySelector(".ai-validation").open=true');await new Promise(r=>setTimeout(r,100));await fs.writeFile('release/validation-report-0.7.1.png',(await win.webContents.capturePage()).toPNG());await js('document.querySelector("[data-action=ai-check-edit]").click()');await until(()=>js('!!document.querySelector("#check-title")'));await new Promise(r=>setTimeout(r,100));await fs.writeFile('release/validation-editor-0.7.1.png',(await win.webContents.capturePage()).toPNG());
 const beforeRepair=calls;await js(`window.keeperDesktop.extractionJob(${JSON.stringify(records[0].id)}).then(r=>{const b=r.input.blocks[1];document.querySelector('[data-check-block]').value=b.block_id;document.querySelector('[data-check-block]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-check-quote]').value=b.text.slice(0,24);document.querySelector('[data-action=ai-check-save]').click();})`);
 await until(()=>js('!!document.querySelector("[data-ai-select]") && !document.querySelector("#check-title")'));assert.equal(calls,beforeRepair);assert.equal((await js('window.keeperDesktop.extractionJobs()'))[0].issues,0);
 await js('document.querySelector("[data-action=ai-import]").click()');await until(()=>js('!document.querySelector("#overlay .modal")'));await js('window.KeeperDesktopUI.flush()');
 const saved=await store.load(originalId);assert.ok(saved.facts.length>0);assert.ok(saved.facts.every(f=>!f.approved&&!f.playerApproved));assert.ok(saved.facts.some(f=>f.edited&&f.nature==='edited'));assert.ok(saved.aiImports[records[0].id].length);assert.equal(saved.aiRuns?.length||0,0);
 await js('document.querySelector("[data-action=wall][data-id=clue]").click();document.querySelector("[data-action=approve-wall]").click();document.querySelector("[data-action=confirm-wall]").click();window.KeeperDesktopUI.flush()');
 const firstGroup=await store.load(originalId),firstCards=structuredClone(firstGroup.facts);
 await js('document.querySelector("[data-action=ai-open]").click()');await until(()=>js('!!document.querySelector("#ai-scope")'));await js('document.querySelector("[data-action=ai-preview]").click()');await until(()=>js('!!document.querySelector("[data-action=ai-run]")'));await js('document.querySelector("[data-action=ai-run]").click()');
 await until(()=>js('window.keeperDesktop.extractionJobs().then(j=>j.length===2&&j.every(t=>t.status==="completed"))'));
 const secondId=(await js('window.keeperDesktop.extractionJobs()'))[0].id;
 await js('document.querySelector("[data-view=facts]").click();document.querySelector("[data-action=ai-history]").click()');await until(()=>js('document.querySelectorAll(".ai-history").length===2'));
 await js(`document.querySelector('[data-action=ai-result][data-id="${secondId}"]').click()`);await until(()=>js('!!document.querySelector("[data-ai-select]")'));
 assert.ok(await js('Array.from(document.querySelectorAll("[data-ai-select]")).every(e=>!e.disabled)'));
 await js('document.querySelector("[data-action=ai-import]").click()');await until(()=>js('!document.querySelector("#overlay .modal")'));await js('window.KeeperDesktopUI.flush()');
 const grouped=await store.load(originalId);assert.equal(grouped.aiGroups.length,2);assert.equal(grouped.activeExtractionId,secondId);assert.deepEqual(grouped.facts.filter(f=>f.aiRunId===records[0].id),firstCards);assert.ok(grouped.facts.filter(f=>f.aiRunId===secondId).every(f=>!f.approved&&!f.playerApproved));assert.equal(await js('document.querySelectorAll("#extraction-group option").length'),2);
 const secondCount=grouped.facts.filter(f=>f.aiRunId===secondId).length;await js('document.querySelector("[data-action=wall][data-id=clue]").click()');assert.equal(await js('document.querySelectorAll("[data-evidence-id]").length'),secondCount);
 await js('document.querySelector("[data-action=approve-wall]").click();document.querySelector("[data-action=confirm-wall]").click();window.KeeperDesktopUI.flush()');
 await js(`document.querySelector('#extraction-group').value=${JSON.stringify(records[0].id)};document.querySelector('#extraction-group').dispatchEvent(new Event('change',{bubbles:true}));window.KeeperDesktopUI.flush()`);
 assert.equal((await store.load(originalId)).activeExtractionId,records[0].id);assert.deepEqual((await store.load(originalId)).facts.filter(f=>f.aiRunId===records[0].id),firstCards);
 loaded=new Promise(r=>win.webContents.once('did-finish-load',r));await js('location.reload();void 0');await loaded;await until(()=>js('!!document.querySelector("#extraction-group")'));assert.equal(await js('document.querySelector("#extraction-group").value'),records[0].id);
 await js('document.querySelector("[data-view=facts]").click()');await new Promise(r=>setTimeout(r,150));await fs.writeFile('release/extraction-groups-ui.png',(await win.webContents.capturePage()).toPNG());
 await js('document.querySelector("[data-action=ai-tasks]").click()');await until(()=>js('!!document.querySelector(".ai-task-panel")'));
 assert.equal(await js('getComputedStyle(document.querySelector(".ai-task-panel")).backgroundColor'),childColor);
 await new Promise(r=>setTimeout(r,150));const image=await win.webContents.capturePage();await fs.writeFile(path.resolve('release/background-tasks-ui.png'),image.toPNG());
 const legacy102=C.fromText('用于时间线分类测试的原文。','时间线核对.txt'),legacyRun=crypto.randomUUID();legacy102.facts=Array.from({length:102},(_,i)=>({id:'f'+i,aiRunId:legacyRun,category:i<91?'clue':'timeline',title:'测试记录 '+i,text:'用于时间线分类测试的原文。',sources:['b1'],approved:i<91,playerApproved:false,nature:'source'}));legacy102.view='facts';legacy102.wall='clue';
 loaded=new Promise(r=>win.webContents.once('did-finish-load',r));await js(`window.keeperDesktop.createProject(${JSON.stringify(legacy102)}).then(()=>location.reload());void 0`);await loaded;await until(()=>js('!!document.querySelector("[data-action=pending-review]")'));
 assert.ok(await js('document.querySelector(".wall-progress").textContent.includes("91 / 102")'));assert.equal(await js('document.querySelectorAll(".wall-tab").length'),5);
 await js('document.querySelector("[data-action=pending-review]").click()');assert.equal(await js('document.querySelector(".wall-tab.active").dataset.id'),'timeline');assert.equal(await js('document.querySelectorAll("[data-evidence-id]").length'),11);
 await js('document.querySelector("[data-action=approve-wall]").click();document.querySelector("[data-action=confirm-wall]").click();window.KeeperDesktopUI.flush()');assert.ok(await js('document.querySelector(".wall-progress").textContent.includes("102 / 102")'));assert.equal(await js('!!document.querySelector("[data-action=pending-review]")'),false);
 await js('document.querySelector("#pending-only").checked=false;document.querySelector("#pending-only").dispatchEvent(new Event("change",{bubbles:true}));window.KeeperDesktopUI.flush()');await new Promise(r=>setTimeout(r,150));await fs.writeFile('release/timeline-confirmation-ui.png',(await win.webContents.capturePage()).toPNG());
 loaded=new Promise(r=>win.webContents.once('did-finish-load',r));await js(`window.keeperDesktop.createProject(${JSON.stringify(C.sample())}).then(()=>location.reload());void 0`);await loaded;
 await until(()=>js('!!document.querySelector("[data-view=facts]")'));await js('document.querySelector("[data-view=facts]").click()');
 for(const wall of ['truth','npc','scene','clue']){
  await js(`document.querySelector('[data-action="wall"][data-id="${wall}"]').click();document.activeElement?.blur();document.querySelectorAll('.is-peeking,.is-open').forEach(e=>e.classList.remove('is-peeking','is-open'));`);
  await new Promise(r=>setTimeout(r,100));assert.ok(await js('document.documentElement.scrollWidth<=innerWidth+1'));
  await fs.writeFile('release/wall-'+wall+'-0.7.0.png',(await win.webContents.capturePage()).toPNG());
 }
 await js('document.querySelector(".evidence-title").focus()');await new Promise(r=>setTimeout(r,100));
 assert.ok(await js('(()=>{const r=document.querySelector(".mosaic-tile:focus-within .evidence-paper").getBoundingClientRect();return r.left>=20&&r.top>=20&&r.right<=innerWidth-20&&r.bottom<=innerHeight-20})()'));
 await fs.writeFile('release/wall-hover-0.7.0.png',(await win.webContents.capturePage()).toPNG());
 win.setContentSize(860,680);await new Promise(r=>setTimeout(r,150));assert.ok(await js('(()=>{const r=document.querySelector(".mosaic-tile:focus-within .evidence-paper").getBoundingClientRect();return r.left>=20&&r.right<=innerWidth-20&&r.bottom<=innerHeight-20})()'));
 await js('document.querySelector("[data-action=wall][data-id=npc]").click();document.querySelector("[data-action=custom-fact]").click()');await until(()=>js('!!document.querySelector("#custom-title")'));
 await js('document.querySelector("#custom-title").value="自定义守卫";document.querySelector("#custom-text").value="KP 调整的敌对守卫。";document.querySelector("#custom-character").value="enemy";document.querySelector("#custom-stats").value="属性 | STR | 60\\n派生 | HP | 12\\n战斗 | 斗殴 | 45%";document.querySelector("[data-action=custom-save]").click()');await until(()=>js('!document.querySelector("#custom-title")'));
 assert.equal(await js('document.querySelector(".character-tabs .active").dataset.id'),'enemy');assert.equal(await js('document.querySelectorAll("[data-evidence-id]").length'),1);assert.equal(await js('document.querySelectorAll(".character-stats tr").length'),3);
 await js('document.querySelector(".evidence-title").focus();window.KeeperDesktopUI.flush()');await new Promise(r=>setTimeout(r,150));await fs.writeFile('release/character-stats-ui.png',(await win.webContents.capturePage()).toPNG());
 const customState=await js('window.keeperDesktop.bootstrap().then(b=>b.state)'),custom=customState.facts.find(f=>f.title==='自定义守卫');assert.ok(custom.custom&&!custom.approved&&!custom.playerApproved);assert.equal(custom.stats.length,3);
 await js('document.querySelector("[data-action=character-filter][data-id=npc]").click()');assert.equal(await js('document.querySelectorAll("[data-evidence-id]").length'),0);await js('document.querySelector("[data-action=character-filter][data-id=enemy]").click();document.querySelector(".evidence-title").focus();document.querySelector("[data-action=edit]").click()');await until(()=>js('!!document.querySelector("#edit-character")'));
 await js('document.querySelector("#edit-character").value="npc";document.querySelector("[data-action=save-edit]").click();document.querySelector("[data-action=character-filter][data-id=npc]").click();window.KeeperDesktopUI.flush()');assert.equal(await js('document.querySelectorAll("[data-evidence-id]").length'),1);
 await testWallArrangement(win,C);
 await testMapEditor(win,C,store);
 const many=C.fromText('多组界面测试原文。','十二组.txt');many.facts=[];for(let i=0;i<12;i++){const r={id:crypto.randomUUID(),at:new Date(100000+i).toISOString(),model:'test'};C.registerGroup(many,r);C.selectGroup(many,r.id);C.createFact(many,{title:'组 '+(i+1),text:'本组独立资料。',category:'truth'});}many.view='facts';
 loaded=new Promise(r=>win.webContents.once('did-finish-load',r));await js(`window.keeperDesktop.createProject(${JSON.stringify(many)}).then(()=>location.reload());void 0`);await loaded;await until(()=>js('document.querySelectorAll("#extraction-group option").length===12'));
 await js('const select=document.querySelector("#extraction-group");select.value=select.options[0].value;select.dispatchEvent(new Event("change",{bubbles:true}));window.KeeperDesktopUI.flush()');assert.equal(await js('document.querySelectorAll("[data-evidence-id]").length'),1);assert.equal(await js('document.querySelector(".evidence-title").textContent'),'组 1');
 const recoverySeed=C.fromText('本批只提取这一段可核对的原文。'.repeat(40),'单块截断恢复.txt');recoverySeed.facts=[];recoverySeed.view='facts';simulateTruncation=true;
 loaded=new Promise(r=>win.webContents.once('did-finish-load',r));await js(`window.keeperDesktop.createProject(${JSON.stringify(recoverySeed)}).then(()=>location.reload());void 0`);await loaded;await until(()=>js('!!document.querySelector("[data-action=ai-open]")'));
 await js('document.querySelector("[data-action=ai-open]").click()');await until(()=>js('!!document.querySelector("#ai-scope")'));await js('document.querySelector("[data-action=ai-preview]").click()');await until(()=>js('!!document.querySelector("[data-action=ai-run]")'));await js('document.querySelector("[data-action=ai-run]").click()');
 await until(()=>js('window.keeperDesktop.extractionJobs().then(j=>j[0]?.status==="failed")'));const recoverySummary=(await js('window.keeperDesktop.extractionJobs()'))[0],failedCalls=calls;assert.equal(recoverySummary.failure.code,'output_truncated');assert.equal(recoverySummary.failedUsage.output_tokens,10000);await new Promise(r=>setTimeout(r,100));assert.equal(calls,failedCalls);
 await js('document.querySelector("[data-action=ai-tasks]").click()');await until(()=>js('!!document.querySelector(".ai-task-panel")'));assert.ok(await js('document.querySelector(".ai-task-panel").textContent.includes("10000")'));
 await js(`document.querySelector('[data-action=ai-resume][data-id="${recoverySummary.id}"]').click()`);await until(()=>js('window.keeperDesktop.extractionJobs().then(j=>j[0]?.status==="completed")'));const recovered=await js(`window.keeperDesktop.extractionJob(${JSON.stringify(recoverySummary.id)})`);assert.ok(recovered.steps.some(s=>s.focus));assert.equal(recovered.failureHistory[0].finish_reason,'length');assert.equal(recovered.result.coverage.unprocessed_block_ids.length,0);
 const active=await js('window.keeperDesktop.bootstrap().then(b=>b.state)'),legacyInput={title:active.title,blocks:active.blocks.filter(b=>b.sourceKind!=='ai-quote').map((b,i)=>({block_id:b.id,text:b.text,number:i+1}))},legacyFacts=Array.from({length:119},(_,i)=>({title:'复核条目 '+i,category:'clue',text:legacyInput.blocks[0].text,nature:'source',sources:[{block_id:legacyInput.blocks[0].block_id,quote:legacyInput.blocks[0].text.slice(0,100)}]})),legacyEmpty=()=>({facts:[],issues:[],decisions:[],coverage:{processed_block_ids:[],unreadable_block_ids:[]}}),legacySteps=Array.from({length:22},(_,i)=>({stage:i<11?'detail':'audit',target_ids:[legacyInput.blocks[0].block_id],status:'done',result:{...legacyEmpty(),facts:legacyFacts.filter((_,n)=>n%11===i%11),coverage:{processed_block_ids:[legacyInput.blocks[0].block_id],unreadable_block_ids:[]}}}));legacySteps.push({stage:'review',target_ids:[],status:'failed',error:'输出达到长度上限',failure:{code:'output_truncated'}},{stage:'review',target_ids:[],status:'pending'});
 const legacyId=crypto.randomUUID(),legacyJob={version:1,policyVersion:3,id:legacyId,projectId:active._projectId,documentId:null,sourceName:active.sourceName,input:legacyInput,provider:'deepseek',providerName:'DeepSeek',model:'deepseek-flash',at:new Date().toISOString(),status:'failed',steps:legacySteps,usage:{input_tokens:0,output_tokens:0}};await atomicWrite(path.join(root,'extraction-jobs',legacyId+'.json'),JSON.stringify(legacyJob));await jobManager.init();const legacyBefore=jobManager.get(legacyId),first22=JSON.stringify(legacyBefore.steps.slice(0,22));
 await js('document.querySelector("[data-action=ai-tasks-close]")?.click();document.querySelector("[data-action=ai-tasks]").click()');await until(()=>js(`!!document.querySelector('[data-action=ai-resume][data-id="${legacyId}"]')`));await js(`document.querySelector('[data-action=ai-resume][data-id="${legacyId}"]').click()`);await until(()=>js(`window.keeperDesktop.extractionJob(${JSON.stringify(legacyId)}).then(j=>j.status==='completed')`));
 const legacyDone=jobManager.get(legacyId);assert.equal(JSON.stringify(legacyDone.steps.slice(0,22)),first22);assert.equal(legacyDone.result.facts.length,119);assert.ok(legacyDone.steps.filter(s=>s.review_indexes).every(s=>s.review_indexes.length<=6&&s.result.facts.length===0&&s.result.decisions.length===0));
 clearTimeout(timeout);console.log(JSON.stringify({ui:'passed',inputCharacters:seed.blocks.reduce((n,b)=>n+b.text.length,0),requests:calls,editableDuringExtraction:true,projectSwitch:true,noFocusSteal:true,staleSourceBlocked:true,draftsNeverAutoApproved:true,uniformChildSurface:true,fourWalls:true,hoverFitsSmallWindow:true,outsideClickClosesPanelWithoutStopping:true,manualRecoveryWithoutModelCall:true,independentExtractionRecords:true,groupPersistsAfterReload:true,timeline91to102:true,customFactCreation:true,characterFiltersAndStats:true,twelveGroupSelection:true,singleBlockTruncationRecovery:true,legacy22BatchReviewRecovery:true,reviewNeverRewritesCards:true,noAutomaticPaidRetry:true,isolatedRoot:root}));app.exit(0);
}
await import(pathToFileURL(path.join(moduleRoot,'desktop/main.mjs')).href);
