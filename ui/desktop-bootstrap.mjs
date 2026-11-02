import {PROVIDERS} from './providers.mjs';
const D=window.keeperDesktop;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let H,timer,pendingSnapshot,queue=Promise.resolve(),lastError=null,saveStatus='saved';
function paint(){const el=document.querySelector('.save-state');if(el)el.textContent=saveStatus==='saved'?'已保存到本机':saveStatus==='error'?'保存失败，请先备份':'正在保存…';}
function enqueue(){clearTimeout(timer);if(!pendingSnapshot)return queue;const snapshot=pendingSnapshot;pendingSnapshot=null;queue=queue.catch(()=>{}).then(async()=>{try{await D.saveProject(snapshot._projectId,snapshot);lastError=null;saveStatus='saved';}catch(e){lastError=e;saveStatus='error';}paint();});return queue;}
async function flush(){await enqueue();await queue;if(lastError)throw lastError;}
function saveSnapshot(state){pendingSnapshot=structuredClone(state);saveStatus='saving';paint();clearTimeout(timer);timer=setTimeout(enqueue,450);}
async function switchTo(id){await flush();await D.openProject(id);location.reload();}
async function library(showArchived=false){await flush();const projects=await D.projects(),active=H.getState()._projectId;H.modal('模组书库',`<div class="desktop-library-tools">${H.btn('desktop-new','导入模组','')}${H.btn('desktop-restore','恢复备份')}${H.btn('desktop-settings','应用设置','ghost')}</div><div class="desktop-library">${projects.filter(p=>!!p.archived===showArchived).map(p=>`<article><div><h3>${esc(p.title)}</h3><p>${p.damaged?'资料损坏，请从备份恢复':esc(p.sourceName)+' · '+p.facts+' 条事实 · 已确认 '+p.approved+' 条'}</p><small>${p.updatedAt?esc(new Date(p.updatedAt).toLocaleString('zh-CN')):''}${p.id===active?' · 当前项目':''}</small></div><div>${p.damaged?'':H.btn('desktop-open','打开','secondary small',`data-id="${p.id}"`)}${p.id!==active?H.btn(showArchived?'desktop-unarchive':'desktop-archive',showArchived?'移回书库':'归档','ghost small',`data-id="${p.id}"`):''}</div></article>`).join('')||'<p class="muted">这里暂时没有项目。</p>'}</div><div class="desktop-library-tools">${H.btn(showArchived?'desktop-library':'desktop-archived',showArchived?'返回书库':'查看归档','ghost')}${H.btn('desktop-history','当前项目历史','ghost')}${H.btn('desktop-backup','备份当前项目','ghost')}</div>`,H.btn('close','返回项目'),true);}
let settingsProvider='openai',modelDrafts={},proxyDraft=null;
function selection(){return {provider:document.getElementById('desktop-provider').value,model:document.getElementById('desktop-model').value.trim(),proxy:document.getElementById('desktop-proxy').value.trim()};}
async function appSettings(selectedProvider){const s=await D.settings(selectedProvider);settingsProvider=s.provider;const model=modelDrafts[s.provider]??s.model,proxy=proxyDraft??s.proxy;
 H.modal('应用设置',`<div class="desktop-settings-status"><span>KP 备团台 ${esc(s.version)}</span><span>${esc(s.providerName)} · ${s.configured?'已保存本机密钥':'尚未配置密钥'}</span></div>
 <div class="form-row"><label for="desktop-provider">AI 服务商</label><select id="desktop-provider">${Object.values(PROVIDERS).map(p=>'<option value="'+p.id+'" '+(p.id===s.provider?'selected':'')+'>'+p.name+'</option>').join('')}</select></div>
 <p class="desktop-help">当前使用：${esc(PROVIDERS[s.activeProvider]?.name||s.activeProvider)}。保存连接设置后切换；各服务商的密钥与模型独立保留。</p>
 <div class="form-row"><label for="desktop-key">${esc(s.providerName)} API 密钥</label><input id="desktop-key" type="password" autocomplete="off" placeholder="只在需要新增或替换时填写" spellcheck="false"></div>
 <div class="button-group">${H.btn('desktop-save-key','安全保存 '+esc(s.providerName)+' 密钥')}${H.btn('desktop-import-key','从本机配置文件导入','ghost')}</div>
 <div class="form-row"><label for="desktop-model">模型</label><input id="desktop-model" value="${esc(model)}" maxlength="100" list="desktop-model-options"><datalist id="desktop-model-options">${s.provider==='deepseek'?'<option value="deepseek-flash"></option><option value="deepseek-v4-pro"></option>':'<option value="gpt-4.1-mini"></option>'}</datalist></div>
 <div class="form-row"><label for="desktop-proxy">本机 HTTP 代理（可选）</label><input id="desktop-proxy" value="${esc(proxy)}" placeholder="留空使用系统代理，或 http://127.0.0.1:端口"></div>
 <div class="button-group">${H.btn('desktop-save-settings','保存连接设置')}${H.btn('desktop-test','保存并测试','ghost')}</div><p id="desktop-test-result" class="desktop-help" role="status"></p>
 <p class="desktop-help">PDF、OCR 和资料整理可离线使用。点击 AI 提取时，仅向所选官方服务商发送选中文字，费用由对应服务商收取。密钥加密保存在当前 Windows 用户下，不会进入项目备份。</p>
 <div class="desktop-settings-status"><span>资料目录</span>${H.btn('desktop-data','打开目录','ghost small')}</div><code class="desktop-data-path">${esc(s.dataDirectory)}</code>`,H.btn('close','关闭'),true);
}
document.addEventListener('change',async event=>{if(event.target.id!=='desktop-provider')return;const selected=event.target.value;if(document.getElementById('desktop-key').value.trim()){event.target.value=settingsProvider;H.toast('请先保存已填写的密钥，再切换服务商。');return;}modelDrafts[settingsProvider]=document.getElementById('desktop-model').value;proxyDraft=document.getElementById('desktop-proxy').value;try{await appSettings(selected);}catch(e){H.toast(e.message);}});
async function newProject(state){await flush();try{const next=await D.createProject(state);return next;}catch(e){H.toast(e.message);return null;}}
const actions={
 'desktop-library':()=>library(),'desktop-archived':()=>library(true),'desktop-open':switchTo,
 'desktop-new':()=>H.actions.import(),
 'desktop-archive':async id=>{await D.archiveProject(id,true);await library();},'desktop-unarchive':async id=>{await D.archiveProject(id,false);await library(true);},
 'desktop-settings':appSettings,
 'desktop-save-key':async()=>{const field=document.getElementById('desktop-key');await D.setKey(settingsProvider,field.value);field.value='';H.toast('密钥已安全保存。');await appSettings(settingsProvider);},
 'desktop-import-key':async()=>{const result=await D.importKey(settingsProvider);if(!result.canceled){H.toast('密钥已从本机文件导入并加密保存。');await appSettings(settingsProvider);}},
 'desktop-save-settings':async()=>{const saved=await D.saveSettings(selection());H.toast(saved.providerName+' 连接设置已保存。');await appSettings(saved.provider);},
 'desktop-test':async()=>{const button=document.querySelector('[data-action="desktop-test"]'),result=document.getElementById('desktop-test-result');button.disabled=true;result.textContent='正在检查网络与模型访问…';try{await D.saveSettings(selection());const r=await D.testConnection();result.textContent=r.message;}catch(e){result.textContent=e.message;}finally{if(button.isConnected)button.disabled=false;}},
 'desktop-data':()=>D.revealData(),
 'desktop-backup':async()=>{await flush();const r=await D.backup(H.getState()._projectId);if(!r.canceled)H.toast('完整项目备份已保存。');},
 'desktop-restore':async()=>{await flush();const result=await D.restore();if(result)location.reload();},
 'desktop-history':async()=>{await flush();const records=await D.history(H.getState()._projectId);H.modal('项目历史',`<p class="desktop-help">保留最近 10 个保存版本。恢复前会保存当前状态；原 PDF 校对记录以现存文件为准。</p>`+records.map(r=>'<article class="desktop-history"><span>'+esc(new Date(r.at).toLocaleString('zh-CN'))+'</span>'+H.btn('desktop-restore-history','恢复此版本','secondary small',`data-id="${r.name}"`)+'</article>').join(''),H.btn('close','关闭'),true);},
 'desktop-restore-history':async name=>{await flush();await D.restoreHistory(H.getState()._projectId,name);location.reload();}
};
window.KeeperDesktopUI={saveSnapshot,newProject,paint,flush,switchTo,connect:hooks=>{H=hooks;Object.assign(H.actions,actions);D.onClose(()=>{window.dispatchEvent(new Event('keeper-before-close'));return flush();});paint();}};
try{const boot=await D.bootstrap();window.KeeperDesktopInitialState=boot.state;await import('./app.mjs');if(boot.taskWarnings)H.toast(boot.taskWarnings+' 项提取记录无法读取，原文件已保留，其他项目可正常使用。');}catch(error){document.getElementById('app').innerHTML='<main class="desktop-start-error"><h1>无法打开本地资料</h1><p>'+esc(error.message)+'</p><p>请保留资料目录，重新打开应用或从备份恢复。</p></main>';}
