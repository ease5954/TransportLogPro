// Quick registration polish for 1.8.7.
// Keeps existing QR, client/product, save and edit behavior unchanged.
(function(root){
  'use strict';
  function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
  function num(v){const s=String(v==null?'':v).replace(/,/g,'').replace(/\s+/g,'').trim();const n=Number(s);return Number.isFinite(n)?n:0;}
  function calc(){const w=num(el('regWeight')&&el('regWeight').value);const p=num(el('regPrice')&&el('regPrice').value);const f=Math.round(w*p);const out=el('regFreight');if(out)out.textContent=f.toLocaleString('ko-KR')+'원';return f;}
  root.calcFreight=calc;
  ['regWeight','regPrice'].forEach(id=>{const e=el(id);if(e&&typeof e.addEventListener==='function')['input','change','keyup','compositionend'].forEach(t=>e.addEventListener(t,calc));});
  function norm(v){try{return typeof root.normalizeQrName==='function'?root.normalizeQrName(v):String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}catch(e){return String(v||'').replace(/\s+/g,'').toLowerCase();}}
  function syncDirectClientLoading(){
    const manual=el('regClientManual'),select=el('regClient'),loading=el('regLoading'),aggregate=el('regAggregate');
    if(!manual||!loading)return false;
    const name=String(manual.value||'').trim();if(!name)return false;
    let existing=null;try{existing=(clients||[]).find(c=>norm(c&&c.name)===norm(name))||null;}catch(e){}
    if(existing){if(!String(loading.value||'').trim())loading.value=String(existing.loading||existing.name||name);if(aggregate&&!String(aggregate.value||'').trim())aggregate.value=String(existing.aggregate||existing.loading||existing.name||name);return true;}
    if(!select||!String(select.value||'').trim()){
      loading.value=name;
      if(loading.dataset)loading.dataset.autoFromClient='1';
      if(aggregate&&!String(aggregate.value||'').trim()){aggregate.value=name;if(aggregate.dataset)aggregate.dataset.autoFromClient='1';}
      return true;
    }
    return false;
  }
  const manual=el('regClientManual');if(manual&&typeof manual.addEventListener==='function')['change','blur'].forEach(t=>manual.addEventListener(t,()=>{if(root.setTimeout)root.setTimeout(syncDirectClientLoading,0);else syncDirectClientLoading();}));
  const newName=el('newClientName'),newLoading=el('newClientLoading');if(newName&&newLoading&&typeof newName.addEventListener==='function')newName.addEventListener('input',()=>{if(!(newLoading.dataset&&newLoading.dataset.manual))newLoading.value=String(newName.value||'').trim();});

  // 1.8.7: transport-edit-fix restores the historical row after applyClient().
  // If an older row has an empty loading/aggregate field, do not overwrite the
  // registered client's route with blank values. Restore the client fallback.
  const previousEditTransport=root.editTransport;
  if(typeof previousEditTransport==='function'){
    root.editTransport=function(id){
      const ok=previousEditTransport(id);
      if(!ok)return ok;
      const loading=el('regLoading'),aggregate=el('regAggregate'),select=el('regClient'),manualInput=el('regClientManual');
      let c=null;
      try{c=(clients||[]).find(x=>String(x&&x.id)===String(select&&select.value||''))||null;}catch(e){}
      const manualName=String(manualInput&&manualInput.value||'').trim();
      const fallback=String(c&&c.loading||c&&c.name||manualName||'').trim();
      const aggregateFallback=String(c&&c.aggregate||c&&c.loading||c&&c.name||manualName||'').trim();
      if(loading&&!String(loading.value||'').trim()&&fallback)loading.value=fallback;
      if(aggregate&&!String(aggregate.value||'').trim()&&aggregateFallback)aggregate.value=aggregateFallback;
      return ok;
    };
  }

  root.__reliableCalcFreight=calc;
  root.__syncDirectClientLoading=syncDirectClientLoading;
  calc();
})(window);
