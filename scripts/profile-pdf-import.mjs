// Local read-only PDF profiling in an isolated app data directory; no API requests.
import {app,net} from 'electron';
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {Store} from '../desktop/store.mjs';
const source=process.argv.find(x=>x.startsWith('--pdf='))?.slice(6);
if(!source)throw Error('Pass --pdf=absolute-path');
process.argv.push('--data-dir='+path.resolve('.runtime/pdf-profile-'+crypto.randomUUID()));
const timings=[];for(const method of ['pdfPut','pdfGet']){const orig=Store.prototype[method];Store.prototype[method]=async function(...args){const start=performance.now();try{return await orig.apply(this,args);}finally{timings.push({method,kind:args[0],ms:Math.round(performance.now()-start)});}};}
net.fetch=async()=>{throw Error('No external requests in PDF profiling');};
const limit=setTimeout(()=>{console.error('PROFILE_TIMEOUT',JSON.stringify(timings));app.exit(2);},180000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',()=>setTimeout(()=>run(win).catch(e=>{console.error(e);app.exit(1);}),300)));
async function run(win){
 const js=s=>win.webContents.executeJavaScript(s);
 await js(`window.profileStart=performance.now();window.pdfStages=[];new MutationObserver(()=>{const stage=document.querySelector('#pdf-opening-stage,#pdf-opening,#pdf-render-status')?.textContent||'ready';if(window.pdfStages.at(-1)?.stage!==stage)window.pdfStages.push({stage,ms:Math.round(performance.now()-window.profileStart)});}).observe(document.querySelector('#overlay'),{childList:true,subtree:true,characterData:true});`);
 win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('DOM.enable');const {root}=await win.webContents.debugger.sendCommand('DOM.getDocument');const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#file-input'});
 await win.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:[source]});
 await js(`window.profileFile=document.querySelector('#file-input').files[0];document.querySelector('#file-input').dispatchEvent(new Event('change',{bubbles:true}));void 0`);
 for(let i=0;i<2400;i++){if(await js(`!!document.querySelector('#pdf-canvas')&&!document.querySelector('#pdf-render-status')`))break;await sleep(50);if(i===2399)throw Error('Preview did not finish');}
 console.log('IMPORT',JSON.stringify({stages:await js('window.pdfStages'),calls:timings}));
 console.log('DETAIL',JSON.stringify(await js(`(async()=>{const file=window.profileFile;const lib=await import('./vendor/pdfjs/pdf.mjs');const start=performance.now();const task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:new URL('./vendor/pdfjs/cmaps/',document.baseURI).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',document.baseURI).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',document.baseURI).href,isEvalSupported:false});const pdf=await task.promise;const rows=[];for(const n of [1,2,3,10,Math.min(30,pdf.numPages)]){let t=performance.now();const p=await pdf.getPage(n);const pageMs=performance.now()-t;t=performance.now();const text=await p.getTextContent();const textMs=performance.now()-t;t=performance.now();const ops=await p.getOperatorList();rows.push({page:n,pageMs:Math.round(pageMs),textMs:Math.round(textMs),operatorMs:Math.round(performance.now()-t),chars:text.items.reduce((sum,i)=>sum+(i.str||'').length,0),ops:ops.fnArray.length});p.cleanup();}const result={pages:pdf.numPages,totalMs:Math.round(performance.now()-start),rows};await task.destroy();return result;})()`)));
 await js(`window.KeeperPdfWorkspace.actions['pdf-use']();void 0`);await sleep(500);
 console.log('REOPEN',JSON.stringify(await js(`window.KeeperPdfWorkspace.openFile(window.profileFile).then(()=>({result:'resolved',opening:!!document.querySelector('#pdf-opening')}),e=>({error:e.message,opening:!!document.querySelector('#pdf-opening')}))`)));
 clearTimeout(limit);app.exit(0);
}
await import('../desktop/main.mjs');

