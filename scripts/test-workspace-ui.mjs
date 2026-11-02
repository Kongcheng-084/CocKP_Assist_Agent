// Focused layout/interaction check. No model requests or real user data.
import {app,net} from 'electron';import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const base=process.argv.includes('--release')?path.resolve('release/'+JSON.parse(await fs.readFile('package.json','utf8')).version+'/win-unpacked/resources/app.asar'):path.resolve('.');
const {Store}=await import(pathToFileURL(path.join(base,'desktop/store.mjs'))),M=await import(pathToFileURL(path.join(base,'ui/map-core.mjs')));const root=path.resolve('.runtime/workspace-ui-'+crypto.randomUUID());process.argv.push('--data-dir='+root);
net.fetch=async()=>{throw Error('This UI check must not call AI');};
const init=Store.prototype.init;Store.prototype.init=async function(seed){seed=structuredClone(seed);seed.view='pack';seed.activeExtractionId='manual';seed.descriptions=[{id:'layout-description',title:'初见旧候车室',overview:'雨中的旧候车室',text:'雨滴落在窗沿，候车室里没有人。\n'+('木椅沿墙摆放，昏黄的光线落在地面上。\n'.repeat(30)),tone:'克制写实',length:'细致'}];seed.facts[0].approved=true;seed.facts[0].playerApproved=true;const m=M.createMap(seed,'manual','带团地图');M.addNode(seed,'manual',m,seed.facts.find(f=>f.category==='scene').id);M.addNode(seed,'manual',m,'layout-description',{x:230,y:0},'description');await init.call(this,seed);return this;};
const timeout=setTimeout(()=>{console.error('Workspace UI timeout');app.exit(1);},30000);
app.on('browser-window-created',(_e,win)=>win.webContents.once('did-finish-load',()=>setTimeout(async()=>{try{
 const js=s=>win.webContents.executeJavaScript(s),click=a=>js('document.querySelector('+JSON.stringify('[data-action="'+a+'"]')+').click()'),pause=()=>new Promise(r=>setTimeout(r,100));
 win.setContentSize(1380,940);await pause();
 assert.equal(await js('!!document.querySelector("[data-view=pack],[data-action=generate]")'),false);assert.ok(await js('!!document.querySelector(".wall-navigation")'));
 const before=await js('window.keeperDesktop.bootstrap().then(b=>b.state)');
 await click('edit');assert.ok(await js('document.querySelector("#edit-text").getBoundingClientRect().height>=350'));assert.ok(await js('document.querySelector("#edit-text").getBoundingClientRect().width>=600'));
 const title=await js('document.querySelector("#edit-title").value');await js('document.querySelector("#edit-title").value="未保存"');await click('close');await click('edit');assert.equal(await js('document.querySelector("#edit-title").value'),title);
 await pause();await fs.writeFile('release/editor-layout-ui.png',(await win.webContents.capturePage()).toPNG());
 await click('editor-size');assert.ok(await js('document.querySelector(".modal.card-editor").getBoundingClientRect().width>innerWidth-40'));await click('editor-size');await click('close');
 await click('custom-fact');assert.ok(await js('document.querySelector("#custom-text").getBoundingClientRect().height>=350'));await click('close');
 await js('document.querySelector("[data-action=wall][data-id=descriptions]").click()');assert.ok(await js('!!document.querySelector("#extraction-group")'));assert.equal(await js('document.querySelectorAll("[data-action=ai-open]").length'),1);
 await pause();await fs.writeFile('release/workspace-layout-ui.png',(await win.webContents.capturePage()).toPNG());
 await click('desc-edit');assert.ok(await js('document.querySelector("#desc-text").getBoundingClientRect().height>=350'));await js('const t=document.querySelector("#desc-text");t.value="更新后的描述正文";t.dispatchEvent(new Event("input",{bubbles:true}));');await click('desc-save');await js('window.KeeperDesktopUI.flush()');assert.equal(await js('window.keeperDesktop.bootstrap().then(b=>b.state.descriptions[0].text)'),'更新后的描述正文');
 await click('desc-edit');win.setContentSize(740,650);await pause();assert.ok(await js('document.querySelector("#desc-text").getBoundingClientRect().width>450'));assert.ok(await js('document.querySelector(".modal-actions").getBoundingClientRect().bottom<=innerHeight'));assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));await fs.writeFile('release/editor-small-ui.png',(await win.webContents.capturePage()).toPNG());await click('desc-cancel');
 await js('document.querySelector("[data-action=wall][data-id=scene]").click();document.querySelector("[data-map-action=map]").click()');await pause();assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));assert.ok(await js('document.querySelector(".map-stage").getBoundingClientRect().width>200'));win.setContentSize(1380,940);await pause();
 await js('document.querySelector("[data-view=player]").click()');await click('player-export');assert.ok(await js('document.querySelector(".modal").textContent.includes("预览玩家材料")'));await click('close');
 await js('window.KeeperDesktopUI.flush()');assert.deepEqual(await js('window.keeperDesktop.bootstrap().then(b=>b.state.facts)'),before.facts);
 clearTimeout(timeout);console.log('WORKSPACE_UI_PASSED editorSizes saveCancel sharedRecord noPack smallWindow map playerExport');app.exit(0);
 }catch(e){console.error(e.stack);app.exit(1);}},200)));
await import(pathToFileURL(path.join(base,'desktop/main.mjs')));
