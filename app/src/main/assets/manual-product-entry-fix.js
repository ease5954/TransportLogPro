// Direct product entry support for quick transport registration (v1.8.4).
(function(root){
  'use strict';
  function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
  function norm(v){try{return typeof root.normalizeQrName==='function'?root.normalizeQrName(v):String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}catch(e){return String(v||'').replace(/\s+/g,'').toLowerCase();}}
  function saveClients(){try{if(typeof root.save==='function')root.save('clients',clients);else if(typeof save==='function')save('clients',clients);}catch(e){}}
  function currentClient(){const s=el('regClient');return s?(clients||[]).find(c=>String(c&&c.id)===String(s.value||''))||null:null;}
  function selectedItem(){const d=el('regItemDisplay');return String(d&&d.value||root.regItem||'').trim();}
  function enableProductInput(){
    const d=el('regItemDisplay');if(!d)return false;
    d.readOnly=false;
    try{d.removeAttribute('readonly');}catch(e){}
    d.placeholder='제품명을 직접 입력하거나 등록 물품을 선택하세요';
    const sync=function(){root.regItem=String(d.value||'').trim();};
    d.addEventListener('input',sync);d.addEventListener('change',sync);d.addEventListener('blur',sync);
    return true;
  }
  function persistProductOnSelectedClient(){
    const c=currentClient();const item=selectedItem();if(!c||!item)return false;
    c.rates=Array.isArray(c.rates)?c.rates:[];
    const price=Number(String(el('regPrice')&&el('regPrice').value||0).replace(/,/g,''))||0;
    const loading=String(el('regLoading')&&el('regLoading').value||'').trim();
    const unloading=String(el('regUnloading')&&el('regUnloading').value||'').trim();
    const aggregate=String(el('regAggregate')&&el('regAggregate').value||'').trim();
    const transport=String(el('regTransport')&&el('regTransport').value||'').trim();
    let r=c.rates.find(x=>norm(x&&x.item)===norm(item));
    if(!r){r={item,price};c.rates.push(r);}else{r.item=item;r.price=price;}
    if(loading)r.loading=loading;if(unloading)r.unloading=unloading;if(aggregate)r.aggregate=aggregate;if(transport)r.transport=transport;
    if(loading)c.loading=loading;if(unloading)c.unloading=unloading;if(aggregate)c.aggregate=aggregate;if(transport)c.transport=transport;
    root.regItem=item;saveClients();return true;
  }
  enableProductInput();
  const previousSaveTransport=root.saveTransport;
  if(typeof previousSaveTransport==='function'){
    root.saveTransport=function(){
      const item=selectedItem();if(item)root.regItem=item;
      persistProductOnSelectedClient();
      return previousSaveTransport();
    };
  }
  root.__enableManualProductEntry=enableProductInput;
  root.__persistManualProductEntry=persistProductOnSelectedClient;
})(window);
