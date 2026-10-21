// Quick registration polish for 1.9.0.
// Keeps existing QR, client/product, save and edit behavior unchanged.
(function(root){
  'use strict';
  function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}

  function ensureHistoryQuickRegisterButton(){
    const history=el('history');
    if(!history||!root.document||typeof root.document.createElement!=='function')return false;
    if(el('historyQuickRegister'))return true;
    const tabs=typeof history.querySelector==='function'?history.querySelector('.tabs'):null;
    if(!tabs||!tabs.parentNode)return false;
    const button=root.document.createElement('button');
    button.id='historyQuickRegister';
    button.type='button';
    button.className='btn primary';
    button.style.margin='8px 0 4px';
    button.textContent='＋ 바로 운송 등록';
    button.setAttribute('aria-label','빠른 운송 등록 화면으로 이동');
    button.addEventListener('click',function(){
      try{
        if(typeof root.go==='function')root.go('register');
        else if(typeof go==='function')go('register');
      }catch(e){}
    });
    tabs.parentNode.insertBefore(button,tabs);
    return true;
  }

  function normalizeDigits(v){return String(v==null?'':v).replace(/[０-９]/g,ch=>String(ch.charCodeAt(0)-0xFF10)).replace(/．/g,'.').replace(/，/g,',').replace(/−/g,'-').trim();}
  function num(v){const s=normalizeDigits(v).replace(/,/g,'').replace(/\s+/g,'').trim();const n=Number(s);return Number.isFinite(n)?n:0;}
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

  const previousEditTransport=root.editTransport;
  if(typeof previousEditTransport==='function'){
    root.editTransport=function(id){
      const ok=previousEditTransport(id);if(!ok)return ok;
      const loading=el('regLoading'),aggregate=el('regAggregate'),select=el('regClient'),manualInput=el('regClientManual');
      let c=null;try{c=(clients||[]).find(x=>String(x&&x.id)===String(select&&select.value||''))||null;}catch(e){}
      const manualName=String(manualInput&&manualInput.value||'').trim();
      const fallback=String(c&&c.loading||c&&c.name||manualName||'').trim();
      const aggregateFallback=String(c&&c.aggregate||c&&c.loading||c&&c.name||manualName||'').trim();
      if(loading&&!String(loading.value||'').trim()&&fallback)loading.value=fallback;
      if(aggregate&&!String(aggregate.value||'').trim()&&aggregateFallback)aggregate.value=aggregateFallback;
      return ok;
    };
  }

  // Android IME can finish composition at the same moment the save button is
  // pressed. Snapshot the visible weight/price before the existing save chain
  // clears the inputs, then verify the just-saved row and repair it if needed.
  const previousSaveTransport=root.saveTransport;
  let lastWeight=0,lastPrice=0;
  function captureSaveValues(){
    const w=num(el('regWeight')&&el('regWeight').value),p=num(el('regPrice')&&el('regPrice').value);
    if(w>0)lastWeight=w;
    if(p>=0)lastPrice=p;
    return {weight:w,price:p};
  }
  ['regWeight','regPrice'].forEach(id=>{const e=el(id);if(e&&typeof e.addEventListener==='function')['input','change','keyup','compositionend','blur'].forEach(t=>e.addEventListener(t,captureSaveValues));});
  if(typeof previousSaveTransport==='function'){
    root.saveTransport=function(){
      const weightEl=el('regWeight'),priceEl=el('regPrice');
      const before=captureSaveValues();
      const snapshotWeight=before.weight>0?before.weight:lastWeight;
      const snapshotPrice=before.price>=0?before.price:lastPrice;
      const rawPrice=String(priceEl&&priceEl.value||'').trim();
      if(weightEl&&snapshotWeight>0)weightEl.value=String(snapshotWeight);
      if(priceEl&&rawPrice!==''&&snapshotPrice>=0)priceEl.value=String(snapshotPrice);
      const beforeLength=Array.isArray(logs)?logs.length:0;
      const editingId=Number(root.editingTransportId||0)||0;
      const result=previousSaveTransport();
      let saved=null;
      if(editingId&&Array.isArray(logs))saved=logs.find(x=>Number(x&&x.id)===editingId)||null;
      else if(Array.isArray(logs)&&logs.length>beforeLength)saved=logs[logs.length-1]||null;
      if(saved){
        let changed=false;
        if((!Number.isFinite(Number(saved.weight))||Number(saved.weight)<=0)&&snapshotWeight>0){saved.weight=snapshotWeight;changed=true;}
        if((!Number.isFinite(Number(saved.price))||Number(saved.price)<=0)&&rawPrice!==''&&snapshotPrice>0){saved.price=snapshotPrice;changed=true;}
        const w=Number(saved.weight||0),p=Number(saved.price||0),freight=Math.round(w*p);
        if(w>0&&p>=0&&Number(saved.freight)!==freight){saved.freight=freight;changed=true;}
        if(changed){
          try{if(typeof root.save==='function')root.save('logs',logs);else if(typeof save==='function')save('logs',logs);}catch(e){}
          try{if(typeof root.renderHistory==='function')root.renderHistory();else if(typeof renderHistory==='function')renderHistory();}catch(e){}
        }
        lastWeight=0;lastPrice=0;
      }
      return result;
    };
  }

  root.__reliableCalcFreight=calc;
  root.__syncDirectClientLoading=syncDirectClientLoading;
  root.__captureQuickSaveValues=captureSaveValues;
  root.__ensureHistoryQuickRegisterButton=ensureHistoryQuickRegisterButton;
  ensureHistoryQuickRegisterButton();
  calc();
})(window);
