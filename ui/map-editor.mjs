import * as M from './map-core.mjs';
import {statsHtml} from './character-ui.mjs';
import {openMapBackground} from './map-background.mjs';
import {exportMapPng} from './map-export.mjs';

export function createMapEditor(H){
  const {esc,C}=H,$=s=>document.querySelector(s);
  let selection=new Set(),edgeId=null,tool='select',connectionFrom=null,libraryOpen=true,search='',filter='scene',gesture=null,scope='',dialogCancel=null;
  const histories=new Map(),assetUrls=new Map();let paintToken=0,dragFact=null;
  let preview=false,expanded=false,previewSearch='';
  const previewViews=new Map(),viewKey=()=>key()+':'+map()?.id;
  function view(){if(!preview)return map().view;const k=viewKey();if(!previewViews.has(k))previewViews.set(k,{...map().view});return previewViews.get(k);}
  function setView(v){if(preview)previewViews.set(viewKey(),v);else{map().view=v;H.save();}}
  function fit(){const b=M.bounds(map()),r=$('.map-stage').getBoundingClientRect(),z=Math.max(.15,Math.min(1.8,(r.width-80)/Math.max(1,b.w),(r.height-80)/Math.max(1,b.h)));setView({x:(r.width-b.w*z)/2-b.x*z,y:(r.height-b.h*z)/2-b.y*z,z});world();}
  function selectPreviewNode(id){if(!map().nodes.some(n=>n.id===id))return;selection=new Set([id]);edgeId=null;draw();$('.map-stage').focus({preventScroll:true});}
  function focusNode(id){const n=map().nodes.find(n=>n.id===id);if(!n)return;selection=new Set([id]);edgeId=null;draw();const r=$('.map-stage').getBoundingClientRect(),z=Math.min(2,Math.max(view().z,.8));setView({x:r.width/2-(n.x+n.w/2)*z,y:r.height/2-(n.y+n.h/2)*z,z});world();$('.map-stage').focus({preventScroll:true});}
  function previewResults(){const q=previewSearch.trim().toLowerCase();if(!q)return '';const list=map().nodes.filter(n=>{const f=M.factFor(state(),group(),n);return f&&(f.title+' '+f.text).toLowerCase().includes(q);});list.sort((a,b)=>{const rank=n=>{const title=(M.factFor(state(),group(),n)?.title||'').toLowerCase();return title===q?0:title.includes(q)?1:2;};return rank(a)-rank(b);});return '<div class="map-find-list">'+(list.slice(0,20).map(n=>button('locate',esc(M.factFor(state(),group(),n).title),'data-id="'+n.id+'"')).join('')||'<span>没有匹配的地图块</span>')+(list.length>20?'<span>显示前 20 项，请缩小搜索范围</span>':'')+'</div>';}
  function previewHtml(m){return '<div class="map-topbar"><span class="map-preview-label">带团预览 · KP</span><select id="map-picker" aria-label="当前地图">'+g().items.map(item=>'<option value="'+item.id+'" '+(item.id===m.id?'selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select><span class="map-toolbar-spacer"></span>'+button('expand',expanded?'收起地图':'展开地图')+button('edit-mode','返回编辑')+'</div><div class="map-tools"><input id="map-preview-search" type="search" placeholder="搜索地图中的场景、人物、线索、描述" aria-label="搜索地图中的资料" value="'+esc(previewSearch)+'"><span class="map-toolbar-spacer"></span>'+button('zoom-out','−','aria-label="缩小地图"')+'<span id="map-zoom">'+Math.round(view().z*100)+'%</span>'+button('zoom-in','＋','aria-label="放大地图"')+button('actual-size','100%')+button('fit','查看全图')+'</div><div id="map-find-results">'+previewResults()+'</div><div class="map-workspace"><div class="map-stage" tabindex="0" aria-label="带团地图，拖动浏览，滚轮缩放，点击地图块查看资料"><div class="map-world"></div><div class="map-stage-note">拖动浏览 · 点击查看 · 滚轮缩放</div></div><aside class="map-inspector" '+(selection.size||edgeId?'':'hidden')+'>'+previewInspector()+'</aside></div>';}
  function previewInspector(){const m=map(),close=button('deselect','×','aria-label="关闭地图详情"');
    if(edgeId){const e=m.edges.find(e=>e.id===edgeId);if(!e)return '';const status=M.evidenceStatus(state(),e);return '<header><b>'+esc(e.label||M.MAP_KINDS[e.kind])+'</b>'+close+'</header><p class="map-muted">'+(e.provenance==='custom'?'KP 自定义':status!=='valid'?'引用待核对':e.confirmed?'原文 · 已核对':'原文 · 待核对')+'</p><p class="map-fact-text">'+esc(e.notes||'未填写说明')+'</p>'+[e.from,e.to].map(id=>{const n=m.nodes.find(n=>n.id===id);return button('locate',esc(M.factFor(state(),group(),n)?.title||'关联缺失'),'data-id="'+id+'"');}).join('')+e.evidence.map((ref,i)=>'<blockquote>'+esc(ref.quote)+button('edge-source','查看原文','data-id="'+i+'"')+'</blockquote>').join('');}
    const n=m.nodes.find(n=>selection.has(n.id));if(!n)return '';const f=M.factFor(state(),group(),n);if(!f)return '<header><b>'+(n.sourceType==='description'?'描述已移除':'关联事实已移除')+'</b>'+close+'</header><p class="map-muted">可返回编辑检查关联。</p>';
    const linked=m.edges.filter(e=>e.from===n.id||e.to===n.id);return '<header><b>'+esc(f.title)+'</b>'+close+'</header><p class="map-muted">'+(f.category==='description'?'描述 · KP 文本':esc(C.categories[f.category]||'资料')+' · '+(f.approved?'已确认':'待确认'))+'</p><p class="map-fact-text">'+esc(f.text)+'</p>'+statsHtml(f,esc)+(f.category==='description'?'':button('fact-source','查看出处',f.sources.length?'':'disabled'))+(linked.length?'<hr><b>相连地点</b><div class="map-neighbors">'+linked.map(e=>{const other=m.nodes.find(x=>x.id===(e.from===n.id?e.to:e.from));return button('locate',esc(M.factFor(state(),group(),other)?.title||'关联缺失')+' · '+esc(e.label||M.MAP_KINDS[e.kind]),'data-id="'+other.id+'"');}).join('')+'</div>':'');
  }
  const state=()=>H.getState(),group=()=>C.activeGroup(state()),key=()=>state()._projectId+':'+group(),g=()=>M.mapGroup(state(),group()),map=()=>M.currentMap(state(),group());
  const active=()=>state().view==='facts'&&state().wall==='scene'&&state().sceneView==='map';
  const available=()=>active()&&!$('#app')?.inert;
  const history=()=>{if(!histories.has(key()))histories.set(key(),new M.MapHistory());return histories.get(key());};
  const button=(action,label,extra='')=>`<button type="button" class="map-button" data-map-action="${action}" ${extra}>${label}</button>`;
  const input=(name,label,value,type='number',extra='')=>`<label>${label}<input data-map-field="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const select=(name,label,value,options)=>`<label>${label}<select data-map-field="${name}">${Object.entries(options).map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
  function sync(){const next=key()+':'+(map()?.id||'');if(next!==scope){cancelGesture();scope=next;selection.clear();edgeId=null;connectionFrom=null;tool='select';}}
  function change(fn){if(preview)throw Error('请先返回编辑模式。');cancelGesture();const before=M.clone(g());try{fn(map());}catch(error){state().maps={...state().maps,[group()]:before};throw error;}if(!M.validMapState({[group()]:g()})){state().maps[group()]=before;throw Error('地图数据超出有效范围，请检查尺寸与坐标。');}if(history().record(before,g()))H.save();draw();}
  function cancelGesture(){if(!gesture)return;const prev=gesture;gesture=null;if(prev.type==='preview-pan'){previewViews.set(prev.viewKey,prev.view);return;}if(prev.before&&state().maps?.[prev.group]){const changed=JSON.stringify(state().maps[prev.group])!==JSON.stringify(prev.before);state().maps[prev.group]=prev.before;if(changed)H.save();}}
  function beforeRender(){cancelGesture();paintToken++;if(!active()){expanded=false;preview=false;document.body.classList.remove('map-expanded-active');}}
  function switcher(){return `<div class="map-view-switch" role="group" aria-label="场景展示方式">${button('cards','卡片',`aria-pressed="${state().sceneView!=='map'}"`)}${button('map','地图',`aria-pressed="${state().sceneView==='map'}"`)}</div>`;}
  function html(){return '<section class="map-editor-root" aria-label="场景地图编辑器"></section>';}
  function draw(){
    sync();const root=$('.map-editor-root');if(!root||!active())return;const m=map();if(preview&&!m){preview=false;expanded=false;}
    root.classList.toggle('is-preview',preview);root.classList.toggle('is-expanded',preview&&expanded);document.body.classList.toggle('map-expanded-active',preview&&expanded);
    if(preview&&m){root.innerHTML=previewHtml(m);world();loadAsset();return;}
    root.innerHTML=`<div class="map-topbar"><select id="map-picker" aria-label="当前地图">${g().items.map(item=>`<option value="${item.id}" ${item.id===m?.id?'selected':''}>${esc(item.name)}</option>`).join('')||'<option>尚无地图</option>'}</select>${button('new','＋ 新地图')}${m?button('rename','重命名')+button('delete-map','删除地图'):''}<span class="map-toolbar-spacer"></span>${button('undo','撤销',history().past.length?'':'disabled')+button('redo','重做',history().future.length?'':'disabled')+(m?button('font-settings','默认字号')+button('preview','带团预览')+button('export','导出 PNG'):'')}</div>${m?`<div class="map-tools">${button('library',libraryOpen?'收起资料':'资料栏')}${button('select','选择',`aria-pressed="${tool==='select'}"`)}${button('pan','平移',`aria-pressed="${tool==='pan'}"`)}${button('connect','连接',`aria-pressed="${tool==='connect'}"`)}${button('background','底图')}${m.background?button('background-settings','底图设置'):''}<label><input id="map-snap" type="checkbox" ${m.snap?'checked':''}> 网格吸附</label><span class="map-toolbar-spacer"></span>${button('zoom-out','−','aria-label="缩小地图"')}<span id="map-zoom">${Math.round(m.view.z*100)}%</span>${button('zoom-in','＋','aria-label="放大地图"')}${button('fit','适应画布')}</div><div class="map-workspace ${libraryOpen?'with-library':''} ${selection.size||edgeId||tool==='background'?'with-inspector':''}">${libraryOpen?library():''}<div class="map-stage" tabindex="0" aria-label="地图画布，拖动标记，滚轮缩放，空白处拖动平移"><div class="map-world"></div><div class="map-marquee" hidden></div><div class="map-stage-note">${tool==='connect'?(connectionFrom?'选择终点 · Esc 取消':'依次选择两个场景标记'):tool==='pan'?'拖动画布平移':'示意布局 · Shift 多选 / 框选 · 滚轮缩放'}</div></div><aside class="map-inspector" ${selection.size||edgeId||tool==='background'?'':'hidden'}>${inspector()}</aside></div>`:'<div class="map-empty">'+button('new','创建地图')+'</div>'}`;
    if(m){world();loadAsset();}
  }
  function library(){
    const facts=(filter==='description'?(state().descriptions||[]):C.groupFacts(state()).filter(f=>f.category===filter)).filter(f=>!search||(f.title+' '+f.text).toLowerCase().includes(search.toLowerCase()));
    return `<aside class="map-library"><div class="map-library-tabs">${[['scene','场景'],['npc','人物'],['clue','线索'],['description','描述']].map(([id,title])=>button('filter',title,`data-id="${id}" aria-pressed="${filter===id}"`)).join('')}</div><input id="map-library-search" placeholder="搜索资料" aria-label="搜索地图资料" value="${esc(search)}"><div class="map-library-list">${facts.map(f=>`<div class="map-library-fact" draggable="true" data-map-fact="${f.id}" data-map-kind="${filter==='description'?'description':'fact'}"><span>${esc(f.title)}</span>${button('add','＋',`data-id="${f.id}" aria-label="放置 ${esc(f.title)}"`)}</div>`).join('')||'<p class="map-muted">本组没有匹配资料</p>'}</div></aside>`;
  }
  function world(){
    const m=map(),el=$('.map-world');if(!m||!el)return;const v=view();
    el.style.transform=`translate(${v.x}px,${v.y}px) scale(${v.z})`;
    const b=m.background,url=b?assetUrls.get(state()._projectId+':'+b.assetId):null;
    el.innerHTML=`${b?`<div class="map-background ${tool==='background'?'is-selected':''}" data-map-background style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;transform:rotate(${b.rotation}deg);opacity:${b.opacity}">${url?`<img src="${url}" alt="${esc(b.source.name)}" draggable="false">`:'<span>正在加载底图…</span>'}</div>`:''}<svg class="map-links" aria-label="场景连接">${m.edges.map(edgeSvg).join('')}</svg>${m.nodes.map(nodeHtml).join('')}`;
    const stage=$('.map-stage');stage.style.backgroundSize=`${20*v.z}px ${20*v.z}px`;stage.style.backgroundPosition=`${v.x}px ${v.y}px`;
    $('#map-zoom').textContent=Math.round(v.z*100)+'%';
  }
  function nodeHtml(n){const f=M.factFor(state(),group(),n);return `<div class="map-node ${selection.has(n.id)?'is-selected':''} ${connectionFrom===n.id?'is-connecting':''} ${n.locked?'is-locked':''}" data-map-node="${n.id}" tabindex="0" role="button" aria-label="${esc(f?.title||(n.sourceType==='description'?'描述已移除':'事实已移除'))}" aria-pressed="${selection.has(n.id)}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;background:${M.MAP_COLORS[n.color]};--map-node-font:${M.nodeFontSize(map(),n)}px"><small>${f?{scene:'场景',npc:'人物',clue:'线索',description:'描述'}[f.category]||'已改分类':'关联缺失'}${n.locked?' · 锁定':''}</small><span>${esc(f?.title||(n.sourceType==='description'?'描述已移除':'事实已移除'))}</span>${!preview&&selection.has(n.id)&&!n.locked?'<span class="map-resize" data-map-resize aria-label="调整标记大小"></span>':''}</div>`;}
  function edgeSvg(e){
    const p=M.edgePath(map(),e),status=M.evidenceStatus(state(),e),selected=edgeId===e.id;if(!p.length)return '';
    const mid=p[Math.floor(p.length/2)],a=p[0],b=p.at(-1),label=e.label||M.MAP_KINDS[e.kind];
    return `<g class="map-edge ${selected?'is-selected':''} ${preview&&(selection.has(e.from)||selection.has(e.to))?'is-related':''} ${e.provenance==='source'&&(!e.confirmed||status!=='valid')?'is-unchecked':''}"><path data-map-edge="${e.id}" d="${p.map((v,i)=>(i?'L':'M')+v.x+' '+v.y).join(' ')}"/><text data-map-edge="${e.id}" x="${p.length>2?mid.x:(a.x+b.x)/2}" y="${(p.length>2?mid.y:(a.y+b.y)/2)-9}">${esc(label)}</text>${selected&&!preview?e.points.map((v,i)=>`<circle data-map-bend="${e.id}" data-point="${i}" cx="${v.x}" cy="${v.y}" r="6"/>`).join(''):''}</g>`;
  }
  function inspector(){
    const m=map();if(!m)return '';if(preview)return previewInspector();const close=button('deselect','×','aria-label="关闭地图详情"');
    if(tool==='background'&&m.background){const b=m.background;return `<header><b>底图设置</b>${close}</header><div class="map-field-grid">${input('x','X',b.x)}${input('y','Y',b.y)}${input('w','宽度',b.w)}${input('h','高度',b.h)}${input('rotation','旋转',b.rotation)}${input('opacity','透明度',b.opacity,'number','min="0.05" max="1" step="0.05"')}</div><label><input data-map-field="locked" type="checkbox" ${b.locked?'checked':''}> 锁定底图</label><p class="map-muted">${esc(b.source.name)}${b.source.kind==='pdf'?' · PDF 第 '+b.source.page+' 页':''}</p>${button('apply-background','应用设置')}${button('background','替换底图')}${button('remove-background','移除底图')}<p class="map-muted">替换或移除底图会保留所有标记坐标。</p>`;}
    if(edgeId){const e=m.edges.find(e=>e.id===edgeId);if(!e)return '';const status=M.evidenceStatus(state(),e);return `<header><b>连接关系</b>${close}</header>${select('kind','类型',e.kind,M.MAP_KINDS)}<div class="map-field-grid">${select('fromAnchor','起点位置',e.fromAnchor||'center',M.MAP_ANCHORS)}${select('toAnchor','终点位置',e.toAnchor||'center',M.MAP_ANCHORS)}</div>${input('label','显示名称',e.label,'text','maxlength="120"')}<label>说明<textarea data-map-field="notes" maxlength="4000">${esc(e.notes)}</textarea></label>${button('apply-edge','保存关系')}<hr><b>${e.provenance==='custom'?'KP 自定义':status!=='valid'?'引用待核对':e.confirmed?'原文 · 已核对':'原文 · 待核对'}</b>${e.evidence.map((ref,i)=>`<blockquote>${esc(ref.quote)}${button('edge-source','查看原文',`data-id="${i}"`)}</blockquote>`).join('')}${button('cite','关联原文')}${e.provenance==='source'?button('confirm-edge',e.confirmed?'撤销核对':'确认关系',status==='valid'?'':'disabled')+button('custom-edge','改为 KP 自定义'):''}<hr>${button('bend','添加折点')}${e.points.length?button('clear-bends','清除折点'):''}${button('remove','删除连接')}<p class="map-muted">连接关系单独核对，不改变事实的确认或玩家批准。</p>`;}
    const nodes=m.nodes.filter(n=>selection.has(n.id));if(!nodes.length)return '';
    if(nodes.length>1)return `<header><b>已选择 ${nodes.length} 个标记</b>${close}</header>${input('fontSize','字号（10–48）',M.nodeFontSize(m,nodes[0]),'number','min="10" max="48" step="1"')}${button('apply-font','应用到所选')}${button('inherit-font','恢复默认字号')}${button('align-left','左对齐')}${button('align-top','顶对齐')}${button('distribute','水平等距')}${button('duplicate','复制标记')}${button('lock','锁定所选')}${button('unlock','解锁所选')}${button('remove','移除标记')}<p class="map-muted">锁定的标记不参与移动与对齐。</p>`;
    const n=nodes[0],f=M.factFor(state(),group(),n);
    return `<header><b>${esc(f?.title||(n.sourceType==='description'?'描述已移除':'事实已移除'))}</b>${close}</header><div class="map-field-grid">${input('x','X',Math.round(n.x))}${input('y','Y',Math.round(n.y))}${input('w','宽度',Math.round(n.w))}${input('h','高度',Math.round(n.h))}</div>${input('fontSize','标题字号（10–48）',M.nodeFontSize(m,n),'number','min="10" max="48" step="1"')}<label><input data-map-field="inheritFontSize" type="checkbox" ${n.fontSize===undefined?'checked':''}> 跟随地图默认字号</label>${select('color','颜色',n.color,{sand:'淡棕',rose:'淡粉',sage:'淡绿',paper:'纸白'})}<p class="map-muted">尺寸为画布单位，不代表实际距离。</p>${button('apply-node','应用设置',n.locked?'disabled':'')}${button(n.locked?'unlock':'lock',n.locked?'解锁':'锁定')}${button('duplicate','复制标记')}${button('remove','移除标记')}${f?`<hr><span class="map-muted">${f.category==='description'?'描述 · KP 文本':f.approved?'事实已确认':'事实待确认'}</span><p class="map-fact-text">${esc(f.text)}</p>${statsHtml(f,esc)}${f.category==='description'?'':button('fact-source','查看出处',f.sources.length?'':'disabled')}${button('edit-fact',f.category==='description'?'编辑描述':'编辑事实')}`:'<p class="map-muted">关联的事实已不在当前记录中。</p>'}`;
  }
  function inspect(){const el=$('.map-inspector');if(!el)return;el.hidden=!(selection.size||edgeId||tool==='background');el.innerHTML=inspector();el.parentElement.classList.toggle('with-inspector',!el.hidden);}
  async function loadAsset(){const m=map(),b=m?.background;if(!b)return;const cache=state()._projectId+':'+b.assetId;if(assetUrls.has(cache))return;const token=++paintToken;try{const bytes=await window.keeperDesktop.mapAssetGet(state()._projectId,b.assetId);if(token!==paintToken||!active())return;if(assetUrls.size>=6){const [old,url]=assetUrls.entries().next().value;URL.revokeObjectURL(url);assetUrls.delete(old);}assetUrls.set(cache,URL.createObjectURL(new Blob([bytes],{type:'image/png'})));world();}catch(e){if(token===paintToken)H.toast('底图无法读取，请从完整备份恢复或重新选择。');}}
  function stagePoint(event){const r=$('.map-stage').getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
  function center(){const r=$('.map-stage')?.getBoundingClientRect();return M.screenToWorld(map().view,{x:(r?.width||500)/2,y:(r?.height||500)/2});}
  function values(){return Object.fromEntries([...document.querySelectorAll('.map-inspector [data-map-field]')].map(el=>[el.dataset.mapField,el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value]));}
  function deselect(){selection.clear();edgeId=null;connectionFrom=null;tool='select';draw();}
  function undo(redo=false){cancelGesture();const restored=redo?history().redo(g()):history().undo(g());if(restored){state().maps[group()]=restored;selection.clear();edgeId=null;H.save();draw();}}
  const actions={
    preview:()=>{cancelGesture();preview=true;selection.clear();edgeId=null;connectionFrom=null;tool='select';dragFact=null;previewSearch='';const first=!previewViews.has(viewKey());draw();if(first)fit();},
    'edit-mode':()=>{cancelGesture();preview=false;expanded=false;selection.clear();edgeId=null;draw();},
    expand:()=>{expanded=!expanded;draw();},
    locate:focusNode,'actual-size':()=>zoom(1/view().z),
    'font-settings':()=>H.modal('地图默认字号','<label class="map-dialog-label">标题字号<input id="map-default-font" type="number" min="10" max="48" step="1" value="'+(map().fontSize??13)+'"></label><p class="map-muted">应用于跟随默认字号的地图块，新放入的地图块也会使用此字号。</p>',button('cancel-dialog','取消')+button('save-font','保存')),
    'save-font':()=>{const size=Number($('#map-default-font').value);if(!M.validFontSize(size))throw Error('字号请输入 10–48 的整数。');change(m=>m.fontSize=size);H.close();},
    'apply-font':()=>{const v=values();change(m=>M.setNodeFontSize(m,[...selection],v.fontSize));},
    'inherit-font':()=>change(m=>M.setNodeFontSize(m,[...selection],null)),
    cards:()=>{beforeRender();state().sceneView='cards';H.save();H.render();},map:()=>{state().sceneView='map';H.save();H.render();},
    new:()=>{H.modal('新地图',`<label class="map-dialog-label">名称<input id="map-new-name" maxlength="80" value="新地图"></label><label class="map-muted"><input id="map-seed-scenes" type="checkbox"> 放入本组全部场景，仅整理排列，不自动连线</label>`,button('cancel-dialog','取消')+button('create-map','创建'));},
    'create-map':()=>{const name=$('#map-new-name').value,populate=$('#map-seed-scenes').checked;H.close();change(()=>{const m=M.createMap(state(),group(),name);if(populate){const scenes=C.groupFacts(state()).filter(f=>f.category==='scene');if(scenes.length>2000)throw Error('场景超过单图上限，请逐条选择放置。');scenes.forEach((f,i)=>M.addNode(state(),group(),m,f.id,{x:(i%3)*240,y:Math.floor(i/3)*150}));}});},
    rename:()=>{H.modal('地图名称',`<label class="map-dialog-label">名称<input id="map-rename" maxlength="80" value="${esc(map().name)}"></label>`,button('cancel-dialog','取消')+button('save-name','保存'));},
    'save-name':()=>{const name=$('#map-rename').value.trim();if(!name)throw Error('请填写地图名称。');H.close();change(m=>m.name=name);},
    'delete-map':()=>H.modal('删除地图',`<p>删除“${esc(map().name)}”及其摆放和连接。原有事实保留，可通过撤销恢复地图。</p>`,button('cancel-dialog','取消')+button('confirm-delete-map','删除')),
    'confirm-delete-map':()=>{H.close();change(m=>{const data=g();data.items=data.items.filter(item=>item.id!==m.id);data.activeId=data.items[0]?.id||null;});},
    'cancel-dialog':()=>H.close(),library:()=>{libraryOpen=!libraryOpen;draw();},filter:id=>{filter=id;draw();},
    select:()=>{tool='select';connectionFrom=null;draw();},pan:()=>{tool='pan';connectionFrom=null;draw();},connect:()=>{tool='connect';connectionFrom=null;selection.clear();edgeId=null;draw();},deselect,
    add:id=>change(m=>{const n=M.addNode(state(),group(),m,id,center(),filter==='description'?'description':'fact');n.x-=n.w/2;n.y-=n.h/2;selection=new Set([n.id]);edgeId=null;tool='select';}),
    undo:()=>undo(),redo:()=>undo(true),
    'zoom-in':()=>zoom(1.2),'zoom-out':()=>zoom(1/1.2),fit,
    'apply-node':()=>{const v=values();change(m=>{const n=m.nodes.find(n=>selection.has(n.id));if(n&&!n.locked){Object.assign(n,{x:v.x,y:v.y,w:v.w,h:v.h,color:v.color});M.setNodeFontSize(m,[n.id],v.inheritFontSize?null:v.fontSize);}});},
    lock:()=>change(m=>{m.nodes.filter(n=>selection.has(n.id)).forEach(n=>n.locked=true);}),unlock:()=>change(m=>{m.nodes.filter(n=>selection.has(n.id)).forEach(n=>n.locked=false);}),
    duplicate:()=>change(m=>selection=new Set(M.duplicateNodes(m,[...selection]))),
    remove:()=>change(m=>{if(edgeId){m.edges=m.edges.filter(e=>e.id!==edgeId);edgeId=null;}else{M.removeNodes(m,[...selection]);selection.clear();}}),
    'align-left':()=>align('x'),'align-top':()=>align('y'),distribute:()=>change(m=>{const list=m.nodes.filter(n=>selection.has(n.id)&&!n.locked).sort((a,b)=>a.x-b.x);if(list.length<3)return;const first=list[0].x,gap=(list.at(-1).x-first)/(list.length-1);list.forEach((n,i)=>n.x=first+gap*i);}),
    'apply-edge':()=>{const v=values();change(m=>{const e=m.edges.find(e=>e.id===edgeId);Object.assign(e,{kind:v.kind,fromAnchor:v.fromAnchor,toAnchor:v.toAnchor,label:v.label,notes:v.notes,confirmed:false});});},
    bend:()=>change(m=>{const e=m.edges.find(e=>e.id===edgeId),p=M.edgePath(m,e);if(e.points.length<30)e.points.push({x:(p.at(-2).x+p.at(-1).x)/2,y:(p.at(-2).y+p.at(-1).y)/2});}),
    'clear-bends':()=>change(m=>m.edges.find(e=>e.id===edgeId).points=[]),
    cite:()=>{const e=map().edges.find(e=>e.id===edgeId);H.modal('关联连接关系的原文',`<label class="map-dialog-label">原文段落<select id="map-cite-block">${state().blocks.map(b=>`<option value="${b.id}">${esc((b.page?'PDF 第 '+b.page+' 页 · ':'')+(b.title||b.id))}</option>`).join('')}</select></label><pre id="map-cite-preview" class="map-cite-preview">${esc(state().blocks[0]?.text||'没有原文资料')}</pre><label class="map-dialog-label">逐字引文<textarea id="map-cite-quote" maxlength="3000">${esc(e.evidence[0]?.quote||'')}</textarea></label><label><input id="map-cite-confirm" type="checkbox"> 我已核对这条连接关系</label>`,button('cancel-dialog','取消')+button('save-citation','保存引用'),true);},
    'save-citation':()=>{const blockId=$('#map-cite-block').value,quote=$('#map-cite-quote').value.trim(),confirmed=$('#map-cite-confirm').checked;change(m=>M.setEvidence(state(),m.edges.find(e=>e.id===edgeId),[{blockId,quote}],confirmed));H.close();},
    'confirm-edge':()=>change(m=>{const e=m.edges.find(e=>e.id===edgeId);if(M.evidenceStatus(state(),e)!=='valid')throw Error('请先核对已变化的原文。');e.confirmed=!e.confirmed;}),
    'custom-edge':()=>change(m=>{const e=m.edges.find(e=>e.id===edgeId);e.provenance='custom';e.confirmed=false;e.evidence=[];}),
    'edge-source':id=>{const e=map().edges.find(e=>e.id===edgeId);H.source([e.evidence[Number(id)].blockId]);},
    'fact-source':()=>{const f=M.factFor(state(),group(),map().nodes.find(n=>selection.has(n.id)));if(f)H.source(f.sources);},
    'edit-fact':()=>{const n=map().nodes.find(n=>selection.has(n.id));if(n){if(n.sourceType==='description')H.editDescription(n.factId);else H.edit(n.factId);}},
    background:()=>{dialogCancel?.();const context=key()+':'+map().id;dialogCancel=openMapBackground({...H,getState:state,onApply:async(bytes,source,isValid)=>{if(context!==key()+':'+map()?.id)throw Error('当前地图已变化，请重新选择底图。');const image=await window.keeperDesktop.mapAssetPut(state()._projectId,bytes);if(!isValid()||context!==key()+':'+map()?.id)return;change(m=>{const old=m.background,scale=Math.min(1,1100/image.width);m.background={assetId:image.id,width:image.width,height:image.height,x:old?.x||0,y:old?.y||0,w:old?.w||image.width*scale,h:old?.h||image.height*scale,rotation:old?.rotation||0,opacity:old?.opacity||.8,locked:true,source};tool='background';selection.clear();edgeId=null;});}});},
    'background-settings':()=>{tool='background';selection.clear();edgeId=null;draw();},
    'apply-background':()=>{const v=values();change(m=>Object.assign(m.background,v));},'remove-background':()=>change(m=>{m.background=null;tool='select';}),
    export:async()=>{const snapshot=M.clone(map()),project=state()._projectId,titles=new Map(snapshot.nodes.map(n=>[n.id,{title:M.factFor(state(),group(),n)?.title||'关联事实已移除'}]));for(const edge of snapshot.edges)if(edge.provenance==='source'&&M.evidenceStatus(state(),edge)!=='valid')edge.confirmed=false;await exportMapPng(snapshot,n=>titles.get(n.id),id=>window.keeperDesktop.mapAssetGet(project,id));H.toast('KP 地图已导出。');}
  };
  function align(axis){change(m=>{const list=m.nodes.filter(n=>selection.has(n.id)&&!n.locked);if(list.length){const v=Math.min(...list.map(n=>n[axis]));list.forEach(n=>n[axis]=v);}});}
  function zoom(factor,p){const v=view(),r=$('.map-stage').getBoundingClientRect();setView(M.zoomAt(v,p||{x:r.width/2,y:r.height/2},v.z*factor));world();}
  document.addEventListener('click',async event=>{
    const el=event.target.closest('[data-map-action]');if(!el||el.disabled)return;event.preventDefault();
    if(preview&&!['edit-mode','expand','locate','actual-size','zoom-in','zoom-out','fit','deselect','fact-source','edge-source','cards','map','cancel-dialog'].includes(el.dataset.mapAction))return;
    try{await actions[el.dataset.mapAction]?.(el.dataset.id);}catch(e){H.toast(e.message||'地图操作未完成。');}
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='map-picker'){cancelGesture();g().activeId=event.target.value;H.save();draw();}
    if(event.target.id==='map-snap'&&!preview)change(m=>m.snap=event.target.checked);
    if(event.target.id==='map-cite-block')$('#map-cite-preview').textContent=state().blocks.find(b=>b.id===event.target.value)?.text||'';
  });
  document.addEventListener('input',event=>{if(event.target.id==='map-preview-search'){previewSearch=event.target.value;$('#map-find-results').innerHTML=previewResults();}if(event.target.matches('[data-map-field=fontSize]')){const inherit=$('[data-map-field=inheritFontSize]');if(inherit)inherit.checked=false;}if(event.target.id==='map-library-search'){search=event.target.value;const list=$('.map-library-list');if(list){const temp=document.createElement('div');temp.innerHTML=library();list.innerHTML=temp.querySelector('.map-library-list').innerHTML;}}});
  // Pointer gestures use the same world coordinates at every zoom level.
  document.addEventListener('pointerdown',event=>{
    if(!available()||event.button!==0&&event.button!==1||!event.target.closest('.map-stage'))return;
    if(preview){cancelGesture();const node=event.target.closest('[data-map-node]'),edge=event.target.closest('[data-map-edge]');gesture={type:'preview-pan',start:stagePoint(event),view:{...view()},viewKey:viewKey(),mapId:map().id,pointerId:event.pointerId,moved:false,nodeId:event.button===0?node?.dataset.mapNode:null,edgeId:event.button===0?edge?.dataset.mapEdge:null};$('.map-stage').setPointerCapture(event.pointerId);event.preventDefault();return;}
    cancelGesture();const m=map(),start=stagePoint(event),worldStart=M.screenToWorld(m.view,start),nodeEl=event.target.closest('[data-map-node]'),edgeEl=event.target.closest('[data-map-edge]'),bend=event.target.closest('[data-map-bend]'),background=event.target.closest('[data-map-background]');
    let type='pan',node=null;
    if(tool==='connect'&&nodeEl){node=m.nodes.find(n=>n.id===nodeEl.dataset.mapNode);const f=M.factFor(state(),group(),node);if(f?.category!=='scene'){H.toast('连接工具用于场景之间的通道。');return;}if(!connectionFrom){connectionFrom=node.id;world();$('.map-stage-note').textContent='选择终点 · Esc 取消';}else if(connectionFrom!==node.id){const from=connectionFrom;change(m=>{const e=M.connect(m,from,node.id);edgeId=e.id;connectionFrom=null;tool='select';});}event.preventDefault();return;}
    if(event.button===1||tool==='pan')type='pan';
    else if(bend){type='bend';edgeId=bend.dataset.mapBend;selection.clear();}
    else if(nodeEl){node=m.nodes.find(n=>n.id===nodeEl.dataset.mapNode);if(event.shiftKey){if(selection.has(node.id))selection.delete(node.id);else selection.add(node.id);}else if(!selection.has(node.id))selection=new Set([node.id]);edgeId=null;tool='select';type=event.target.closest('[data-map-resize]')?'resize':'nodes';}
    else if(edgeEl){edgeId=edgeEl.dataset.mapEdge;selection.clear();tool='select';type='edge';}
    else if(tool==='background'&&background&&!m.background.locked)type='background';
    else{selection.clear();edgeId=null;if(event.shiftKey)type='marquee';}
    gesture={type,start,worldStart,view:{...m.view},before:M.clone(g()),group:group(),mapId:m.id,nodeId:node?.id,point:bend?Number(bend.dataset.point):null,pointerId:event.pointerId,moved:false};
    $('.map-stage').setPointerCapture(event.pointerId);event.preventDefault();world();inspect();
  });
  document.addEventListener('pointermove',event=>{
    if(gesture?.type==='preview-pan'){if(gesture.pointerId!==event.pointerId)return;if(gesture.viewKey!==viewKey()){cancelGesture();return;}const p=stagePoint(event),dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;gesture.moved=gesture.moved||Math.hypot(dx,dy)>3;if(gesture.moved){setView({...gesture.view,x:Math.max(-100000,Math.min(100000,gesture.view.x+dx)),y:Math.max(-100000,Math.min(100000,gesture.view.y+dy))});world();}return;}
    if(!gesture||gesture.pointerId!==event.pointerId)return;const m=map();if(!m||m.id!==gesture.mapId){cancelGesture();return;}const p=stagePoint(event),dx=(p.x-gesture.start.x)/m.view.z,dy=(p.y-gesture.start.y)/m.view.z;gesture.moved=gesture.moved||Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>3;const original=gesture.before.items.find(m=>m.id===gesture.mapId);
    if(gesture.type==='pan'){m.view.x=Math.max(-100000,Math.min(100000,gesture.view.x+p.x-gesture.start.x));m.view.y=Math.max(-100000,Math.min(100000,gesture.view.y+p.y-gesture.start.y));}
    if(gesture.type==='nodes'){const list=m.nodes.filter(n=>selection.has(n.id)&&!n.locked),anchor=original.nodes.find(n=>n.id===(list[0]?.id));if(anchor){const sx=M.snapped(anchor.x+dx,m.snap)-anchor.x,sy=M.snapped(anchor.y+dy,m.snap)-anchor.y;for(const n of list){const old=original.nodes.find(o=>o.id===n.id);n.x=M.snapped(old.x+sx,false);n.y=M.snapped(old.y+sy,false);}}}
    if(gesture.type==='resize'){const n=m.nodes.find(n=>n.id===gesture.nodeId),old=original.nodes.find(n=>n.id===gesture.nodeId);if(!n.locked){n.w=Math.max(48,Math.min(2000,M.snapped(old.w+dx,m.snap)));n.h=Math.max(36,Math.min(2000,M.snapped(old.h+dy,m.snap)));}}
    if(gesture.type==='background'){m.background.x=M.snapped(original.background.x+dx,m.snap);m.background.y=M.snapped(original.background.y+dy,m.snap);}
    if(gesture.type==='bend'){const e=m.edges.find(e=>e.id===edgeId),old=original.edges.find(e=>e.id===edgeId).points[gesture.point];e.points[gesture.point]={x:M.snapped(old.x+dx,m.snap),y:M.snapped(old.y+dy,m.snap)};}
    if(gesture.type==='marquee'){const el=$('.map-marquee');el.hidden=false;Object.assign(el.style,{left:Math.min(p.x,gesture.start.x)+'px',top:Math.min(p.y,gesture.start.y)+'px',width:Math.abs(p.x-gesture.start.x)+'px',height:Math.abs(p.y-gesture.start.y)+'px'});const end=M.screenToWorld(m.view,p),x=Math.min(gesture.worldStart.x,end.x),y=Math.min(gesture.worldStart.y,end.y),right=Math.max(gesture.worldStart.x,end.x),bottom=Math.max(gesture.worldStart.y,end.y);selection=new Set(m.nodes.filter(n=>n.x>=x&&n.y>=y&&n.x+n.w<=right&&n.y+n.h<=bottom).map(n=>n.id));}
    world();
  });
  document.addEventListener('pointerup',event=>{
    if(!gesture||gesture.pointerId!==event.pointerId)return;const previous=gesture;gesture=null;$('.map-marquee')?.setAttribute('hidden','');
    if(previous.type==='preview-pan'){if(!previous.moved&&previous.nodeId){selectPreviewNode(previous.nodeId);return;}if(!previous.moved){selection.clear();edgeId=previous.edgeId||null;}draw();$('.map-stage')?.focus({preventScroll:true});return;}
    if(previous.type!=='pan'&&previous.type!=='marquee'&&previous.type!=='edge')history().record(previous.before,g());
    if(previous.moved&&JSON.stringify(previous.before)!==JSON.stringify(g()))H.save();draw();
  });
  document.addEventListener('pointercancel',()=>{if(gesture){cancelGesture();if(active())draw();}});
  window.addEventListener('blur',()=>{if(gesture){cancelGesture();if(active())draw();}});
  document.addEventListener('wheel',event=>{if(!available()||!event.target.closest('.map-stage'))return;event.preventDefault();if(gesture)return;zoom(Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.002),stagePoint(event));},{passive:false});
  document.addEventListener('keydown',event=>{
    if(available()&&preview&&expanded&&event.key==='Tab'){const targets=[...document.querySelectorAll('.map-editor-root button:not(:disabled),.map-editor-root input,.map-editor-root select,.map-editor-root [tabindex="0"]')].filter(el=>el.getClientRects().length),first=targets[0],last=targets.at(-1);if(first&&(!event.target.closest('.map-editor-root')||event.shiftKey&&event.target===first||!event.shiftKey&&event.target===last)){event.preventDefault();(event.shiftKey?last:first).focus();}}
    if(available()&&preview&&event.key==='Escape'&&event.target.id==='map-preview-search'){event.preventDefault();previewSearch='';event.target.value='';$('#map-find-results').innerHTML='';$('.map-stage').focus();return;}
    if(!available()||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(preview){
      const node=event.target.closest('[data-map-node]');if(node&&['Enter',' '].includes(event.key)){event.preventDefault();selectPreviewNode(node.dataset.mapNode);return;}
      if(event.key==='Escape'){event.preventDefault();cancelGesture();if(selection.size||edgeId)deselect();else if(expanded){expanded=false;draw();}return;}
      if(event.target.closest('.map-stage')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const v=view(),step=event.shiftKey?120:40;setView({...v,x:Math.max(-100000,Math.min(100000,v.x+(event.key==='ArrowLeft'?step:event.key==='ArrowRight'?-step:0))),y:Math.max(-100000,Math.min(100000,v.y+(event.key==='ArrowUp'?step:event.key==='ArrowDown'?-step:0)))});world();}
      if(['Delete','Backspace'].includes(event.key)||(event.ctrlKey||event.metaKey)&&['z','y','d'].includes(event.key.toLowerCase()))event.preventDefault();
      return;
    }
    if(event.key==='Escape'){cancelGesture();deselect();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey);}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();undo(true);}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'&&selection.size){event.preventDefault();actions.duplicate();}
    if((event.key==='Delete'||event.key==='Backspace')&&(selection.size||edgeId)){event.preventDefault();actions.remove();}
    const node=event.target.closest('[data-map-node]');if(node&&['Enter',' '].includes(event.key)){event.preventDefault();selection=new Set([node.dataset.mapNode]);edgeId=null;tool='select';world();inspect();document.querySelector('[data-map-node="'+node.dataset.mapNode+'"]')?.focus({preventScroll:true});}
    if(selection.size&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const step=map().snap?20:event.shiftKey?10:1;change(m=>{for(const n of m.nodes.filter(n=>selection.has(n.id)&&!n.locked)){n.x=M.snapped(n.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),false);n.y=M.snapped(n.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),false);}});}
  });
  document.addEventListener('dragstart',event=>{const fact=event.target.closest('[data-map-fact]');if(!fact||!available()||preview)return;dragFact={id:fact.dataset.mapFact,sourceType:fact.dataset.mapKind,scope:key()};event.dataTransfer.setData('application/x-keeper-map-fact',dragFact.id);event.dataTransfer.effectAllowed='copy';});
  document.addEventListener('dragover',event=>{if(!preview&&available()&&dragFact&&dragFact.scope===key()&&event.target.closest('.map-stage')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
  document.addEventListener('drop',event=>{if(preview||!available()||!dragFact||dragFact.scope!==key()||!event.target.closest('.map-stage'))return;event.preventDefault();const {id,sourceType}=dragFact;dragFact=null;change(m=>{const n=M.addNode(state(),group(),m,id,M.screenToWorld(m.view,stagePoint(event)),sourceType);n.x-=n.w/2;n.y-=n.h/2;selection=new Set([n.id]);edgeId=null;});});
  document.addEventListener('dragend',()=>dragFact=null);
  window.addEventListener('keeper-before-close',()=>{cancelGesture();dialogCancel?.();dialogCancel=null;});
  return {switcher,html,paint:draw,beforeRender,cancelGesture,cancelDialog(){dialogCancel?.();dialogCancel=null;}};
}
