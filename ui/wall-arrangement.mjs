// Explicit arranging mode keeps hover previews from covering a drop target.
export function createWallArrangement({getContext,swap,save,refresh,toast}){
  const mime='application/x-keeper-wall-card';
  let scope=null,enabled=false,selected=null,drag=null,suppressClickUntil=0;
  const tiles=()=>[...document.querySelectorAll('#fact-list [data-evidence-id]')];
  const tileFor=id=>tiles().find(tile=>tile.dataset.evidenceId===id);
  function active(){
    const next=getContext();
    if(next!==scope){scope=next;enabled=false;selected=null;drag=null;}
    return enabled&&scope!==null;
  }
  function highlight(){
    for(const tile of tiles()){
      tile.classList.toggle('is-swap-selected',tile.dataset.evidenceId===selected);
      if(enabled)tile.querySelector('.evidence-title').setAttribute('aria-pressed',String(tile.dataset.evidenceId===selected));
    }
    const hint=document.querySelector('#wall-arrange-hint');
    if(hint)hint.textContent=selected?'选择另一张卡片交换位置 · Esc 取消选择':'拖到另一张卡片上交换位置，或依次点击两张卡片';
  }
  function clearDrag(){
    drag=null;
    document.querySelectorAll('.is-swap-dragging,.is-swap-target').forEach(tile=>tile.classList.remove('is-swap-dragging','is-swap-target'));
  }
  function paint(){
    const on=active();selected=null;clearDrag();
    document.querySelector('.mosaic-wall')?.classList.toggle('is-arranging',on);
    const button=document.querySelector('[data-action="arrange-wall"]');
    if(button){button.textContent=on?'完成调整':'调整位置';button.setAttribute('aria-pressed',String(on));button.disabled=tiles().length<2&&!on;}
    const hint=document.querySelector('#wall-arrange-hint');if(hint)hint.hidden=!on;
    for(const tile of tiles()){
      tile.draggable=on;
      const title=tile.querySelector('.evidence-title');
      if(on){tile.classList.remove('is-open','is-peeking');title.setAttribute('aria-expanded','false');title.setAttribute('aria-describedby','wall-arrange-hint');}
      else{title.removeAttribute('aria-pressed');title.removeAttribute('aria-describedby');}
    }
    highlight();
  }
  function stop(){enabled=false;selected=null;clearDrag();paint();}
  function exchange(first,second){
    if(!active()||!tileFor(first)||!tileFor(second))return;
    if(swap(first,second)){save();refresh();tileFor(first)?.querySelector('.evidence-title').focus();toast('已交换位置');}
    else{selected=null;highlight();}
  }
  function choose(id){
    if(!active()||performance.now()<suppressClickUntil)return;
    if(!selected){selected=id;highlight();}
    else if(selected===id){selected=null;highlight();}
    else exchange(selected,id);
  }
  document.addEventListener('dragstart',event=>{
    const tile=event.target.closest('#fact-list [data-evidence-id]');if(!tile)return;
    if(!active()||document.querySelector('#app')?.inert){event.preventDefault();return;}
    selected=null;highlight();
    drag={id:tile.dataset.evidenceId,scope,token:crypto.randomUUID()};
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData(mime,drag.token);
    tile.classList.add('is-swap-dragging');
  });
  document.addEventListener('dragover',event=>{
    if(!active()||!drag||drag.scope!==scope)return;
    const target=event.target.closest('#fact-list [data-evidence-id]');
    document.querySelectorAll('.is-swap-target').forEach(tile=>{if(tile!==target)tile.classList.remove('is-swap-target');});
    if(!target||target.dataset.evidenceId===drag.id)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';target.classList.add('is-swap-target');
  });
  document.addEventListener('dragleave',event=>{
    const tile=event.target.closest('#fact-list [data-evidence-id]');
    if(tile&&(!event.relatedTarget||!tile.contains(event.relatedTarget)))tile.classList.remove('is-swap-target');
  });
  document.addEventListener('drop',event=>{
    if(!active()||!drag||drag.scope!==scope)return;
    const target=event.target.closest('#fact-list [data-evidence-id]'),source=drag.id,valid=event.dataTransfer.getData(mime)===drag.token;
    // Internal drags never become a document import, even if released over the upload area.
    event.preventDefault();event.stopImmediatePropagation();clearDrag();suppressClickUntil=performance.now()+250;
    if(valid&&target)exchange(source,target.dataset.evidenceId);
  },true);
  document.addEventListener('dragend',()=>{if(drag)suppressClickUntil=performance.now()+250;clearDrag();});
  document.addEventListener('click',event=>{if(active()&&selected&&!event.target.closest('[data-evidence-id],[data-action="arrange-wall"]')){selected=null;highlight();}});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active()){event.preventDefault();if(selected||drag){selected=null;clearDrag();highlight();}else stop();}
  });
  window.addEventListener('blur',()=>{selected=null;clearDrag();highlight();});
  return {active,paint,choose,stop,toggle(){const on=active();enabled=!on;paint();}};
}
