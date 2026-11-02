(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KeeperPdfCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const labels={pending:'未提取',text:'文字层',needs_ocr:'建议 OCR',review:'需检查',ocr_review:'OCR 待校对',corrected:'已校对',ignored:'已略过',error:'提取失败'};
  function initialPage(page){return {page,text:'',textLayer:'',status:'pending',method:null,confidence:null,imageCount:0,error:null,revision:0};}
  function textFromItems(items){
    let text='',last=null;
    for(const item of items){if(typeof item.str!=='string')continue;
      if(last&&last.str&&item.str&&!text.endsWith('\n')){const y=Math.abs((last.transform?.[5]||0)-(item.transform?.[5]||0));if(y>Math.max(3,(item.height||10)*.6))text+='\n';else if(/[A-Za-z0-9]$/.test(text)&&/^[A-Za-z0-9]/.test(item.str)){const width=last.width??last.str.length*(last.height||10)*.5,gap=(item.transform?.[4]||0)-((last.transform?.[4]||0)+width);if(gap>Math.max(1,(item.height||10)*.15))text+=' ';}}
      text+=item.str;if(item.hasEOL&&!text.endsWith('\n'))text+='\n';last=item;
    }
    return text.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function assess(text,imageCount=0){const visible=text.replace(/\s/g,'');if(visible.length<60)return 'needs_ocr';if(imageCount>0||(visible.match(/\uFFFD/g)||[]).length/visible.length>.01)return 'review';return 'text';}
  function normalizeOcr(text){return String(text).replace(/[ \t]+/g,' ').replace(/([\p{Script=Han}，。！？：；、：“”‘’（）《》])[ \t]+(?=[\p{Script=Han}，。！？：；、：“”‘’（）《》])/gu,'$1').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
  function summarize(pages){const tally={total:pages.length,pending:0,text:0,needs_ocr:0,review:0,ocr_review:0,corrected:0,ignored:0,error:0};for(const p of pages)tally[p.status]=(tally[p.status]||0)+1;tally.toReview=tally.needs_ocr+tally.review+tally.ocr_review+tally.error;return tally;}
  function sourceBlocks(doc,pages){const blocks=[];for(const p of pages){if(p.status==='pending'||p.status==='ignored'||p.status==='error')continue;const chunks=p.text.split(/\n\s*\n/).flatMap(x=>x.match(/[\s\S]{1,1800}/g)||[]).map(x=>x.trim()).filter(Boolean);chunks.forEach((text,i)=>blocks.push({block_id:doc.id.slice(0,18)+'-p'+p.page+'-b'+(i+1),document_id:doc.id,pdf_page:p.page,heading:'第 '+p.page+' 页',text,parse_status:p.status,method:p.method,reviewed:p.status==='corrected',revision:p.revision}));}return blocks;}
  function createProject(doc){return {version:1,title:doc.name.replace(/\.pdf$/i,''),kind:'custom',sourceName:doc.name,players:'未设置',duration:'未设置',step:1,view:'source',wall:'truth',filter:'all',packTab:'all',pendingOnly:false,notes:'',revision:0,pack:null,updatedAt:null,blocks:[],facts:[],pdf:{id:doc.id,name:doc.name,pageCount:doc.pageCount,size:doc.size},sourceMode:'pdf'};}
  function invalidatePage(state,page){let changed=false;const ids=new Set(state.blocks.filter(b=>b.documentId===state.pdf?.id&&b.page===page).map(b=>{b.sourceStale=true;return b.id;}));for(const f of state.facts)if(f.sources.some(id=>ids.has(id))){f.approved=false;f.playerApproved=false;changed=true;}if(changed){state.revision++;state.updatedAt=new Date().toISOString();}return changed;}
  function appendFact(state,record,{title,text,category}){
    title=String(title||'').trim();text=String(text||'').trim();if(!title||!text)throw new Error('请填写标题和内容。');if(!['truth','npc','scene','clue','timeline'].includes(category))throw new Error('请选择资料类别。');
    if(!record.text.includes(text))throw new Error('请从本页文字中选择原文片段；改编可在添加后编辑。');
    const nonce=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);
    const block={id:'pdf-b-'+nonce,number:state.blocks.length+1,page:record.page,documentId:state.pdf.id,title, text,sourceKind:record.method==='ocr'?'ocr':'pdf-text',pageRevision:record.revision,sourceStale:false};
    const fact={id:'pdf-f-'+nonce,category,title,text,sources:[block.id],nature:'source',approved:false,playerApproved:false,edited:false};state.blocks.push(block);state.facts.push(fact);state.revision++;return fact;
  }
  function exportData(doc,pages){return {schema_version:1,document:{id:doc.id,name:doc.name,page_count:doc.pageCount},coverage:pages.map(p=>({pdf_page:p.page,status:p.status,method:p.method,confidence:p.confidence,image_count:p.imageCount,error:p.error})),source_blocks:sourceBlocks(doc,pages)};}
  return {labels,initialPage,textFromItems,assess,normalizeOcr,summarize,sourceBlocks,createProject,invalidatePage,appendFact,exportData};
});
