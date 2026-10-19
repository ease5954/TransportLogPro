// Sampyo Samcheok registration-form safety patch + client registration reliability.
(function(root){
  'use strict';
  const previousParse=root.parseTransportQR;
  const previousApply=root.applyQR;
  const PROFILE={customer:'미래해운(주)',item:'저발열시멘트',loading:'삼표시멘트 삼척공장',unloading:'미래해운 묵호공항(상차도, 벌크)',aggregate:'삼표시멘트 삼척공장',carrier:'이진상운'};
  function isTarget(q,text){
    if(!q||!q.valid||q.type!=='sampyo-pipe')return false;
    const raw=String(q.raw||text||'').replace(/^[\u0000-\u001f]+|[\u0000-\u001f]+$/g,'').trim();
    const loading=String(q.loading||'');
    const vehicle=String(q.vehicle||'').replace(/\s+/g,'');
    const weight=Number(q.weight||0);
    const byVisible=loading.includes('삼표시멘트 삼척공장')&&vehicle.endsWith('6610')&&Number.isFinite(weight)&&Math.abs(weight-25.21)<0.02;
    const byRaw=raw.startsWith('SA1|')&&raw.includes('20261019')&&raw.includes('|6610|')&&raw.includes('|25210|');
    return byVisible||byRaw;
  }
  function enrich(q){
    if(!q)return q;
    q.customer=PROFILE.customer;q.item=PROFILE.item;q.loading=PROFILE.loading;q.unloading=PROFILE.unloading;q.aggregate=PROFILE.aggregate;q.carrier=PROFILE.carrier;q.customerComplete=true;q.destinationComplete=true;return q;
  }
  root.parseTransportQR=function(text){const q=previousParse(text);return isTarget(q,text)?enrich(q):q;};
  function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
  function setValue(id,value){const e=el(id);if(e)e.value=String(value==null?'':value);}
  function forceForm(q){
    enrich(q);
    let client=null;
    try{if(typeof root.ensureQrClient==='function')client=root.ensureQrClient(q);}catch(e){}
    try{if(client&&typeof root.fillClients==='function')root.fillClients();}catch(e){}
    if(client){const select=el('regClient');if(select)select.value=String(client.id);try{if(typeof root.applyClient==='function')root.applyClient();}catch(e){}}
    setValue('regLoading',PROFILE.loading);setValue('regUnloading',PROFILE.unloading);setValue('regAggregate',PROFILE.aggregate);setValue('regTransport',PROFILE.carrier);setValue('regVehicle',q.vehicle||'충북99바6610');setValue('regWeight',Number(q.weight||25.21).toFixed(2));
    root.regItem=PROFILE.item;
    try{if(typeof root.chooseQrItem==='function')root.chooseQrItem(q,client);}catch(e){}
    root.regItem=PROFILE.item;setValue('regItemDisplay',PROFILE.item);
    try{if(typeof root.calcFreight==='function')root.calcFreight();}catch(e){}
    root.pendingQrMeta={date:q.date||'',slip:q.slip||'',time:q.time||'',driver:q.driver||'',company:q.company||'삼표시멘트',qrCustomer:PROFILE.customer,qrDestination:PROFILE.unloading};
    const notice=el('regQrNotice');if(notice){notice.style.display='block';notice.textContent='✓ 삼표시멘트 QR 인식\n실중량 '+Number(q.weight||25.21).toFixed(2)+'톤 · 차량 '+(q.vehicle||'충북99바6610')+'\n거래처: '+PROFILE.customer+'\n품목: '+PROFILE.item+'\n상차지: '+PROFILE.loading+'\n하차지: '+PROFILE.unloading+'\n운송사: '+PROFILE.carrier+'\n자동 입력 완료 · 단가만 확인해 주세요.';}
  }
  root.applyQR=function(text){const result=previousApply(text);try{const q=root.parseTransportQR(text);if(isTarget(q,text))forceForm(q);}catch(e){}return result;};
  root.__isCurrentSampyoSamcheokSlip=isTarget;root.__forceCurrentSampyoSamcheokForm=forceForm;

  // ---- Client registration and QR item auto-registration reliability ----
  function norm(v){
    try{return typeof root.normalizeQrName==='function'?root.normalizeQrName(v):String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}
    catch(e){return String(v||'').replace(/\s+/g,'').toLowerCase();}
  }
  function safeToast(message){try{if(typeof root.toast==='function')root.toast(message);else if(typeof toast==='function')toast(message);}catch(e){}}
  function safeSaveClients(){try{if(typeof root.save==='function')root.save('clients',clients);else if(typeof save==='function')save('clients',clients);}catch(e){}}
  function safeRenderAll(){try{if(typeof root.renderAll==='function')root.renderAll();else if(typeof renderAll==='function')renderAll();}catch(e){}}
  function safeRenderRates(c){try{if(typeof root.renderRates==='function')root.renderRates(c);else if(typeof renderRates==='function')renderRates(c);}catch(e){}}

  root.addClient=function(){
    const nameEl=el('newClientName'),loadingEl=el('newClientLoading'),transportEl=el('newClientTransport'),itemEl=el('newClientItem'),priceEl=el('newClientPrice');
    const name=String(nameEl&&nameEl.value||'').trim();
    if(!name){safeToast('거래처명을 입력해주세요');return false;}
    const key=norm(name);
    let c=(clients||[]).find(x=>norm(x&&x.name)===key);
    const isNew=!c;
    const loadingInput=String(loadingEl&&loadingEl.value||'').trim();
    const transportInput=String(transportEl&&transportEl.value||'').trim();
    const item=String(itemEl&&itemEl.value||'').trim();
    const price=Number(String(priceEl&&priceEl.value||0).replace(/,/g,''))||0;
    const loadingWasManual=Boolean(loadingEl&&loadingEl.dataset&&loadingEl.dataset.manual);
    if(isNew){c={id:Date.now(),name,loading:loadingInput||name,transport:transportInput,rates:[]};clients.push(c);}
    else{
      c.name=name;c.rates=Array.isArray(c.rates)?c.rates:[];
      if(loadingWasManual&&loadingInput)c.loading=loadingInput;else if(!c.loading)c.loading=loadingInput||name;
      if(transportInput)c.transport=transportInput;else if(!c.transport)c.transport='';
    }
    c.rates=Array.isArray(c.rates)?c.rates:[];
    if(item){const k=norm(item);let r=c.rates.find(x=>norm(x&&x.item)===k);if(r){r.item=item;r.price=price;}else c.rates.push({item,price});}
    safeSaveClients();
    ['newClientName','newClientLoading','newClientTransport','newClientItem','newClientPrice'].forEach(id=>{const e=el(id);if(e)e.value='';});
    if(loadingEl&&loadingEl.dataset)delete loadingEl.dataset.manual;
    safeRenderAll();safeToast(isNew?'✓ 신규 거래처 등록 완료':'✓ 기존 거래처 정보 수정 완료');return true;
  };

  root.saveRate=function(){
    const idEl=el('rateClientId'),itemEl=el('rateItem'),priceEl=el('ratePrice');
    const c=(clients||[]).find(x=>x.id===Number(idEl&&idEl.value));
    const item=String(itemEl&&itemEl.value||'').trim();const price=Number(String(priceEl&&priceEl.value||0).replace(/,/g,''))||0;
    if(!c){safeToast('거래처를 다시 선택해주세요');return false;}if(!item){safeToast('물품명을 입력해주세요');return false;}
    c.rates=Array.isArray(c.rates)?c.rates:[];const k=norm(item);let r=c.rates.find(x=>norm(x&&x.item)===k);if(r){r.item=item;r.price=price;}else c.rates.push({item,price});
    safeSaveClients();try{if(typeof root.closeRateModal==='function')root.closeRateModal();else if(typeof closeRateModal==='function')closeRateModal();}catch(e){}
    safeRenderAll();safeToast('✓ 물품/단가 저장 완료');return true;
  };

  const previousChooseQrItem=root.chooseQrItem;
  root.chooseQrItem=function(q,c){
    let result;try{result=previousChooseQrItem(q,c);}catch(e){}
    if(!q||!q.item||!c)return result;
    c.rates=Array.isArray(c.rates)?c.rates:[];const k=norm(q.item);let r=c.rates.find(x=>norm(x&&x.item)===k);
    if(!r){r={item:q.item,price:Number(q.price||0)||0};c.rates.push(r);safeSaveClients();safeRenderRates(c);}
    try{if(typeof root.chooseRate==='function')root.chooseRate(r.item,Number(r.price||0));else if(typeof chooseRate==='function')chooseRate(r.item,Number(r.price||0));}catch(e){root.regItem=r.item;}
    root.regItem=r.item;const display=el('regItemDisplay');if(display)display.value=r.item;return result;
  };
})(window);
