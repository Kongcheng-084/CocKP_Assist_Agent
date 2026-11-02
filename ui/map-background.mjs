// Images are decoded and re-encoded locally; executable SVG and remote URLs are never stored.
export function openMapBackground(H){
  const {esc}=H,project=H.getState()._projectId,documentId=H.getState().pdf?.id;
  let alive=true,preview=null,source=null,crop={x:0,y:0,w:1,h:1},drag=null,pdf=null,generation=0,renderTask=null;
  const $=s=>document.querySelector(s),button=(name,label)=>`<button class="map-button" data-map-bg="${name}" type="button">${label}</button>`;
  H.modal('地图底图',`<div class="map-background-picker"><label class="map-file-label">选择本地图片<input id="map-image-file" type="file" accept="image/png,image/jpeg,image/webp"></label>${documentId?`<label>PDF 页码 <input id="map-pdf-page" type="number" min="1" max="${H.getState().pdf.pageCount}" value="1"></label>${button('page','读取本页')}`:''}</div><p class="map-muted" id="map-bg-status">选择图片${documentId?'或当前模组的一页 PDF':''}，拖动预览框选地图区域。</p><div class="map-crop-container"><canvas id="map-crop-canvas" aria-label="底图裁切预览"></canvas></div><div class="map-background-picker">${button('reset','使用整张')}<span class="map-muted">更换底图保留标记坐标与原底图占用范围。</span></div>`,button('cancel','取消')+button('apply','使用选中区域'),true);
  const valid=()=>alive&&H.getState()._projectId===project&&!!$('#map-crop-canvas');
  function message(value){if(valid())$('#map-bg-status').textContent=value;}
  function draw(){
    if(!valid()||!preview)return;const canvas=$('#map-crop-canvas'),ratio=Math.min(1,720/preview.width,400/preview.height);canvas.width=Math.max(1,Math.round(preview.width*ratio));canvas.height=Math.max(1,Math.round(preview.height*ratio));
    const ctx=canvas.getContext('2d');ctx.drawImage(preview,0,0,canvas.width,canvas.height);const {x,y,w,h}=crop;ctx.fillStyle='#513d3533';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(preview,x*preview.width,y*preview.height,w*preview.width,h*preview.height,x*canvas.width,y*canvas.height,w*canvas.width,h*canvas.height);ctx.strokeStyle='#987f74';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(x*canvas.width+1,y*canvas.height+1,w*canvas.width-2,h*canvas.height-2);
  }
  async function image(file){
    if(!file)return;if(file.size>25*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 25 MB 以内的 PNG、JPEG 或 WebP 图片。');
    const token=++generation;renderTask?.cancel();preview=null;source=null;message('正在读取图片…');
    const bitmap=await createImageBitmap(file);if(!valid()||token!==generation){bitmap.close();return;}
    const scale=Math.min(1,4096/bitmap.width,4096/bitmap.height,Math.sqrt(8000000/(bitmap.width*bitmap.height))),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(bitmap.width*scale));canvas.height=Math.max(1,Math.floor(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();preview=canvas;source={kind:'image',name:file.name.slice(0,240)};crop={x:0,y:0,w:1,h:1};draw();message('拖动预览框选地图区域，或直接使用整张。');
  }
  async function page(){
    const number=Number($('#map-pdf-page').value);if(!Number.isInteger(number)||number<1||number>H.getState().pdf.pageCount)throw Error('请选择有效的 PDF 页码。');
    const token=++generation;renderTask?.cancel();preview=null;source=null;message('正在读取 PDF 页面…');
    if(!pdf){const lib=await import('./vendor/pdfjs/pdf.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',document.baseURI).href;const doc=await window.keeperDesktop.pdfGet('documents',documentId);if(!valid()||token!==generation)return;if(!doc)throw Error('原 PDF 缺失，请先在模组资料中关联原文件。');pdf=await lib.getDocument({data:new Uint8Array(doc.bytes),cMapUrl:new URL('./vendor/pdfjs/cmaps/',document.baseURI).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',document.baseURI).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',document.baseURI).href,isEvalSupported:false}).promise;}
    if(!valid()||token!==generation){if(!alive)await pdf?.loadingTask?.destroy();return;}const page=await pdf.getPage(number),base=page.getViewport({scale:1}),scale=Math.min(2.5,4096/base.width,4096/base.height,Math.sqrt(8000000/(base.width*base.height))),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;if(!valid()||token!==generation)return;
    preview=canvas;source={kind:'pdf',name:H.getState().sourceName.slice(0,240),documentId,page:number};crop={x:0,y:0,w:1,h:1};draw();message('拖动框选地图区域。保存时会记录 PDF 页码与裁切范围。');
  }
  const position=event=>{const r=$('#map-crop-canvas').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))};};
  const down=event=>{if(!valid()||!preview||event.target.id!=='map-crop-canvas'||event.button!==0)return;drag=position(event);event.target.setPointerCapture(event.pointerId);event.preventDefault();};
  const move=event=>{if(!valid()||!drag)return;const p=position(event);crop={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),w:Math.max(.001,Math.abs(p.x-drag.x)),h:Math.max(.001,Math.abs(p.y-drag.y))};crop.w=Math.min(crop.w,1-crop.x);crop.h=Math.min(crop.h,1-crop.y);draw();};
  const up=()=>{drag=null;};
  const file=event=>{if(event.target.id==='map-image-file')image(event.target.files[0]).catch(e=>message(e.message));};
  async function click(event){
    const action=event.target.closest('[data-map-bg]')?.dataset.mapBg;if(!action||!valid())return;
    try{
      if(action==='cancel'){H.close();return;}if(action==='page'){await page();return;}if(action==='reset'){crop={x:0,y:0,w:1,h:1};draw();return;}
      if(action==='apply'){
        if(!preview||!source)throw Error('请先选择图片或读取 PDF 页面。');const apply=event.target;apply.disabled=true;
        try{const canvas=document.createElement('canvas'),x=Math.floor(crop.x*preview.width),y=Math.floor(crop.y*preview.height);canvas.width=Math.max(1,Math.round(crop.w*preview.width));canvas.height=Math.max(1,Math.round(crop.h*preview.height));canvas.getContext('2d').drawImage(preview,x,y,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||blob.size>6*1024*1024)throw Error('裁切后的底图超过 6 MB，请缩小选取区域后重试。');if(!valid())return;
          await H.onApply(new Uint8Array(await blob.arrayBuffer()),{...source,...(source.kind==='pdf'?{crop:{...crop}}:{})},valid);if(valid())H.close();
        }finally{if(apply.isConnected)apply.disabled=false;}
      }
    }catch(e){if(e.name!=='RenderingCancelledException')message(e.message||'底图读取失败，请重试。');}
  }
  document.addEventListener('click',click);document.addEventListener('change',file);document.addEventListener('pointerdown',down);document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
  return ()=>{alive=false;generation++;renderTask?.cancel();pdf?.loadingTask?.destroy().catch(()=>{});document.removeEventListener('click',click);document.removeEventListener('change',file);document.removeEventListener('pointerdown',down);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);preview=null;};
}
