const {contextBridge,ipcRenderer}=require('electron');
const call=(name,...args)=>ipcRenderer.invoke('keeper:'+name,...args);
contextBridge.exposeInMainWorld('keeperDesktop',Object.freeze({
 expandDescription:spec=>call('expandDescription',spec),
 bootstrap:()=>call('bootstrap'),projects:()=>call('projects'),createProject:s=>call('createProject',s),saveProject:(id,s)=>call('saveProject',id,s),openProject:id=>call('openProject',id),archiveProject:(id,archived)=>call('archiveProject',id,archived),
 pdfGet:(store,key)=>call('pdfGet',store,key),pdfPut:(store,value)=>call('pdfPut',store,value),beginPdfDraft:()=>call('beginPdfDraft'),endPdfDraft:()=>call('endPdfDraft'),
 mapAssetPut:(id,bytes)=>call('mapAssetPut',id,bytes),mapAssetGet:(id,assetId)=>call('mapAssetGet',id,assetId),
 backup:id=>call('backup',id),restore:()=>call('restore'),history:id=>call('history',id),restoreHistory:(id,name)=>call('restoreHistory',id,name),
 settings:provider=>call('settings',provider),saveSettings:s=>call('saveSettings',s),setKey:(provider,key)=>call('setKey',provider,key),importKey:provider=>call('importKey',provider),testConnection:()=>call('testConnection'),revealData:()=>call('revealData'),
 extractionJobs:()=>call('extractionJobs'),extractionJob:id=>call('extractionJob',id),startExtraction:s=>call('startExtraction',s),stopExtraction:id=>call('stopExtraction',id),resumeExtraction:id=>call('resumeExtraction',id),
 onExtractionChanged:fn=>{const listener=(_event,list)=>fn(list);ipcRenderer.on('keeper:extraction-changed',listener);return ()=>ipcRenderer.removeListener('keeper:extraction-changed',listener);},
 repairExtractionDraft:(id,recordId,fact)=>call('repairExtractionDraft',id,recordId,fact),
 onClose:fn=>ipcRenderer.on('keeper:before-close',()=>Promise.resolve().then(fn).then(()=>call('closeReady')).catch(()=>call('closeFailed')))
}));
