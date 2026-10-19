// Sampyo Samcheok registration-form safety patch.
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
})(window);
