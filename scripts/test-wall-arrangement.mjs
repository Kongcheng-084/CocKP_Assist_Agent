import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

export async function testWallArrangement(win,C){
  const js=code=>win.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms));
  async function ready(){for(let i=0;i<200;i++){if(await js('!!document.querySelector("[data-action=arrange-wall]")'))return;await pause(20);}throw Error('Arrangement UI did not load');}
  async function reload(){const loaded=new Promise(r=>win.webContents.once('did-finish-load',r));await js('location.reload();void 0');await loaded;await ready();}
  const groupA=crypto.randomUUID(),groupB=crypto.randomUUID(),state=C.fromText('测试用原文。','证据墙换位.txt');state.facts=[];
  for(const group of [groupA,groupB]){
    C.registerGroup(state,{id:group});C.selectGroup(state,group);
    for(const category of Object.keys(C.categories))for(let i=0;i<4;i++){
      const f=C.createFact(state,{title:category+' 纸张 '+i,text:'用于换位验证的详情。',category,character_type:i%2?'enemy':'npc'});
      f.approved=i%2===0;
    }
    C.generate(state);
  }
  C.selectGroup(state,groupA);state.view='facts';state.wall='clue';
  const loaded=new Promise(r=>win.webContents.once('did-finish-load',r));
  await js(`window.keeperDesktop.createProject(${JSON.stringify(state)}).then(()=>location.reload());void 0`);await loaded;await ready();
  win.setContentSize(1260,900);await pause(100);
  const ids=()=>js('[...document.querySelectorAll("[data-evidence-id]")].map(e=>e.dataset.evidenceId)');
  const click=id=>js(`document.querySelector('[data-action="peek"][data-id="${id}"]').click()`);
  const before=await ids(),snapshot=await js('window.keeperDesktop.bootstrap().then(b=>b.state)');
  await js('document.querySelector("[data-action=arrange-wall]").click()');
  assert.equal(await js('document.querySelector(".mosaic-wall").classList.contains("is-arranging")'),true);
  await click(before[0]);assert.equal(await js('document.querySelectorAll(".is-swap-selected").length'),1);
  assert.equal(await js('getComputedStyle(document.querySelector(".evidence-details")).display'),'none');
  await click(before[3]);assert.deepEqual(await ids(),[before[3],before[1],before[2],before[0]]);
  // Escape cancels one selected card; a second Escape leaves arrangement mode.
  await click(before[1]);await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
  assert.equal(await js('document.querySelectorAll(".is-swap-selected").length'),0);assert.deepEqual(await ids(),[before[3],before[1],before[2],before[0]]);
  // Chromium input starts a real drag; interception keeps the test out of the OS drag loop.
  const positions=await js('[...document.querySelectorAll("[data-evidence-id]")].map(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})');
  const from=positions[0],to=positions[2];
  await js('window.wallDragEvents=[];for(const name of ["dragstart","dragover","drop"])window.addEventListener(name,e=>window.wallDragEvents.push(name),true)');
  win.webContents.debugger.attach('1.3');let dragData;
  const capture=(_event,method,params)=>{if(method==='Input.dragIntercepted')dragData=params.data;};
  win.webContents.debugger.on('message',capture);
  try{
    await win.webContents.debugger.sendCommand('Input.setInterceptDrags',{enabled:true});
    win.webContents.sendInputEvent({type:'mouseMove',...from});
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...from});
    for(let i=1;i<=8&&!dragData;i++){win.webContents.sendInputEvent({type:'mouseMove',button:'left',modifiers:['leftButtonDown'],x:from.x+i*5,y:from.y});await pause(30);}
    assert.ok(dragData,'Chromium must begin a drag from the paper');
    for(const type of ['dragEnter','dragOver','drop'])await win.webContents.debugger.sendCommand('Input.dispatchDragEvent',{type,...to,data:dragData});
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...to});await pause(100);
    assert.ok(await js('window.wallDragEvents.includes("dragstart")&&window.wallDragEvents.includes("drop")'),'Chromium drag must reach drop: '+JSON.stringify(await js('window.wallDragEvents')));
  }finally{
    await win.webContents.debugger.sendCommand('Input.setInterceptDrags',{enabled:false});
    win.webContents.debugger.removeListener('message',capture);win.webContents.debugger.detach();
  }
  assert.deepEqual(await ids(),[before[2],before[1],before[3],before[0]]);
  await js('window.KeeperDesktopUI.flush()');
  const after=await js('window.keeperDesktop.bootstrap().then(b=>b.state)');
  assert.deepEqual(after.facts,snapshot.facts);assert.deepEqual(after.pack,snapshot.pack);assert.equal(C.stale(after),false);
  await pause(200);await click(before[1]);await fs.writeFile('release/wall-arrangement-ui.png',(await win.webContents.capturePage()).toPNG());
  // Filtering only changes visibility; swapping visible cards keeps hidden slots intact.
  await js('document.querySelector("#pending-only").checked=true;document.querySelector("#pending-only").dispatchEvent(new Event("change",{bubbles:true}))');
  assert.deepEqual(await ids(),[before[1],before[3]]);await click(before[1]);await click(before[3]);
  await js('document.querySelector("#pending-only").checked=false;document.querySelector("#pending-only").dispatchEvent(new Event("change",{bubbles:true}));window.KeeperDesktopUI.flush()');
  assert.deepEqual(await ids(),[before[2],before[3],before[1],before[0]]);
  await reload();assert.deepEqual(await ids(),[before[2],before[3],before[1],before[0]]);
  assert.equal(await js('document.querySelector(".mosaic-wall").classList.contains("is-arranging")'),false);
  await js('document.querySelector(".evidence-title").focus()');assert.equal(await js('getComputedStyle(document.querySelector(".evidence-details")).display'),'block');
  // Every wall supports swapping; switching walls/groups abandons a selection.
  for(const wall of ['truth','npc','scene','timeline']){
    await js(`document.querySelector('[data-action="wall"][data-id="${wall}"]').click()`);const wallBefore=await ids();
    await js('document.querySelector("[data-action=arrange-wall]").click()');await click(wallBefore[0]);await click(wallBefore[1]);
    assert.deepEqual((await ids()).slice(0,2),[wallBefore[1],wallBefore[0]]);
  }
  await click((await ids())[0]);
  await js(`const select=document.querySelector('#extraction-group');select.value='${groupB}';select.dispatchEvent(new Event('change',{bubbles:true}));`);
  assert.equal(await js('document.querySelectorAll(".is-swap-selected").length'),0);assert.equal(await js('document.querySelector(".mosaic-wall").classList.contains("is-arranging")'),false);
  const second=(await ids());assert.deepEqual(second,state.facts.filter(f=>f.aiRunId===groupB&&f.category==='timeline').map(f=>f.id));
  // Foreign file/text drops and drops on the same card cannot reorder the wall.
  await js('document.querySelector("[data-action=arrange-wall]").click();const dt=new DataTransfer();dt.setData("text/plain","foreign");document.querySelector("[data-evidence-id]").dispatchEvent(new DragEvent("drop",{bubbles:true,cancelable:true,dataTransfer:dt}));');
  assert.deepEqual(await ids(),second);
  await js('document.querySelector("[data-action=arrange-wall]").click();window.KeeperDesktopUI.flush()');
  const classes=await js('[document.querySelector("[data-action=approve-wall]").className,document.querySelector("[data-action=pending-review]").className]');assert.equal(classes[0],classes[1]);
  await click(second[0]);
  const anchor=await js('(()=>{const e=document.querySelector(".is-open .evidence-paper"),r=e.getBoundingClientRect();return {x:r.x,y:r.y,position:getComputedStyle(e).position}})()');assert.equal(anchor.position,'absolute');
  await js('document.querySelector(".is-open .evidence-paper").dispatchEvent(new PointerEvent("pointermove",{clientX:300,clientY:400,bubbles:true}))');
  assert.deepEqual(await js('(()=>{const e=document.querySelector(".is-open .evidence-paper"),r=e.getBoundingClientRect();return {x:r.x,y:r.y,position:getComputedStyle(e).position}})()'),anchor);
  await js('document.querySelector(".is-open [data-action=delete-fact]").click();document.querySelector("#overlay [data-action=close]").click()');assert.deepEqual(await ids(),second);
  await js('document.querySelector("[data-action=delete-fact]").click();document.querySelector("[data-action=confirm-delete-fact]").click();window.KeeperDesktopUI.flush()');assert.equal((await ids()).length,3);await reload();assert.equal((await ids()).length,3);
  const deleted=await js('window.keeperDesktop.bootstrap().then(b=>b.state)');assert.equal(deleted.facts.filter(f=>f.aiRunId===groupA).length,20);assert.deepEqual(deleted.blocks,snapshot.blocks);assert.ok(C.stale(deleted));
  console.log('WALL_ARRANGEMENT_UI_PASSED nativeDrag clickSwap filters reload fiveWalls groupIsolation');
}
