export function validFocus(step,blocks){if(step.focus===undefined)return true;const f=step.focus,b=blocks.find(b=>b.block_id===f?.block_id);return !!b&&step.target_ids.length===1&&step.target_ids[0]===f.block_id&&Number.isInteger(f.start)&&Number.isInteger(f.end)&&f.start>=0&&f.end<=b.text.length&&f.end>f.start&&!!b.text.slice(f.start,f.end).trim();}
export function focusedBlock(step,block){if(step.focus?.block_id!==block.block_id)return block;if(!validFocus(step,[block]))throw new Error('批次原文片段范围无效。');const f=step.focus;return {...block,text:block.text.slice(f.start,f.end),source_start:(block.source_start||0)+f.start};}
export function splitFailedStep(step,input){
 const truncated=step.failure?.code==='output_truncated'||(!step.failure?.code||step.failure.code==='unknown')&&/输出未完成|截断/.test(step.error||'');if(step.status!=='failed'||!truncated)return [step];
 if(step.review_indexes!==undefined){if(step.review_indexes.length<=1)return [step];const mid=Math.ceil(step.review_indexes.length/2);return [step.review_indexes.slice(0,mid),step.review_indexes.slice(mid)].map(review_indexes=>({stage:'review',target_ids:[],review_indexes,status:'pending'}));}
 const ids=step.target_ids.length?step.target_ids:step.stage==='review'?input.blocks.map(b=>b.block_id):[];
 const child=extra=>({stage:step.stage,status:'pending',...extra});
 if(ids.length>1){const mid=Math.ceil(ids.length/2);return [child({target_ids:ids.slice(0,mid)}),child({target_ids:ids.slice(mid)})];}
 const b=input.blocks.find(b=>b.block_id===ids[0]);if(!b||!validFocus(step,input.blocks))return [step];const start=step.focus?.start||0,end=step.focus?.end??b.text.length;if(end-start<240)return [step];
 let mid=Math.floor((start+end)/2),line=b.text.lastIndexOf('\n',mid);if(line>start+(end-start)*.3)mid=line+1;if(/[\uD800-\uDBFF]/.test(b.text[mid-1]))mid--;if(!b.text.slice(start,mid).trim()||!b.text.slice(mid,end).trim())return [step];
 return [child({target_ids:ids,focus:{block_id:b.block_id,start,end:mid}}),child({target_ids:ids,focus:{block_id:b.block_id,start:mid,end}})];
}
