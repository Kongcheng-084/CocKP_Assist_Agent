const fs=require('node:fs');
let api=fs.readFileSync('lib/keeper-api.mjs','utf8').replace('../public/ai-core.mjs','../ui/ai-core.mjs');fs.writeFileSync('lib/keeper-api.mjs',api);
for(const file of ['core.test.cjs','pdf-core.test.cjs']){fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('./public/','./ui/'));}
let html=fs.readFileSync('ui/index.html','utf8').replace('src="app.mjs"','src="desktop-bootstrap.mjs"').replace('<link rel="stylesheet" href="ai-workspace.css">','<link rel="stylesheet" href="ai-workspace.css">\n  <link rel="stylesheet" href="desktop.css">');fs.writeFileSync('ui/index.html',html);
let app=fs.readFileSync('ui/app.mjs','utf8').replace("const saved=JSON.parse(localStorage.getItem(STORAGE_KEY))", "const saved=window.KeeperDesktopInitialState||JSON.parse(localStorage.getItem(STORAGE_KEY))");
const saveStart=app.indexOf('function save(){'),saveEnd=app.indexOf('function toast(',saveStart);
app=app.slice(0,saveStart)+`function save(){state.updatedAt=new Date().toISOString();window.KeeperDesktopUI.saveSnapshot(state);}
function storageStatus(){return '已保存到本机';}
`+app.slice(saveEnd);
app=app.replace("${nav('overview','概览','grid')}","${btn('desktop-library',icon('book')+' 模组书库','ghost desktop-library-button')}${nav('overview','概览','grid')}");
app=app.replace('<div class="sidebar-bottom">','<div class="sidebar-bottom">${btn(\'desktop-settings\',icon(\'settings\')+\' 应用设置\',\'ghost\')}');
app=app.replace("  if(state.view==='source'&&state.pdf)W.mount();", "  window.KeeperDesktopUI?.paint();\n  if(state.view==='source'&&state.pdf)W.mount();");
app=app.replace("function replaceProject(next){state=next;", "async function replaceProject(next){next=await window.KeeperDesktopUI.newProject(next);if(!next)return;state=next;");
app=app.replace('新导入会替换当前项目，请先导出需要保留的资料。','导入会新建项目，已有模组保留在书库中。');
app=app.replace('当前浏览器只保留一个项目。载入后将替换现有资料和手记，请先导出需要保留的内容。','示例会作为新项目载入，现有项目保留在书库中。');
app=app.replace('Demo 一次保存一个项目。资料仅保存在当前浏览器；清除浏览器数据会移除本地项目。','项目自动保存到本机；可在模组书库备份、恢复和查看历史版本。');
app=app.replaceAll('当前浏览器处理','本机处理').replaceAll('当前浏览器','本机');
app=app.replace("render();\n", "render();\n");
app=app.replace(/\nrender\(\);\s*$/,`\nwindow.KeeperDesktopUI.connect({getState:()=>state,actions,modal,closeModal,navigate,toast,btn,save,render,C,W});\nrender();\n`);
fs.writeFileSync('ui/app.mjs',app);
let pdf=fs.readFileSync('ui/pdf-workspace.js','utf8');
pdf=pdf.replace('async function get(store,key){const db=', 'async function get(store,key){if(root.keeperDesktop){const value=await root.keeperDesktop.pdfGet(store,key);if(value&&store===\'documents\'){value.file=new Blob([value.bytes],{type:\'application/pdf\'});delete value.bytes;}return value;}const db=');
pdf=pdf.replace('async function put(store,value){const db=', 'async function put(store,value){if(root.keeperDesktop){const copy={...value};if(store===\'documents\'){copy.bytes=new Uint8Array(await value.file.arrayBuffer());delete copy.file;}return root.keeperDesktop.pdfPut(store,copy);}const db=');
pdf=pdf.replace('      await put(\'documents\',record);', "      if(mode==='import')await root.keeperDesktop.beginPdfDraft();\n      await put('documents',record);");
pdf=pdf.replace('    }catch(error){if(pdf&&pdf!==session?.pdf)', "    }catch(error){if(mode==='import')await root.keeperDesktop.endPdfDraft().catch(()=>{});if(pdf&&pdf!==session?.pdf)");
pdf=pdf.replace('openingToken++;if(session?.mount', "openingToken++;if(session?.draft&&!session.busy){const old=session;session=null;dispose(old);root.keeperDesktop.endPdfDraft().catch(()=>{});}if(session?.mount");
pdf=pdf.replaceAll('当前浏览器','本机').replaceAll('本浏览器','本机');fs.writeFileSync('ui/pdf-workspace.js',pdf);
