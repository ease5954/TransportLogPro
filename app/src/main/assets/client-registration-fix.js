// Client/QR item registration reliability patch for 1.8.0.
(function(root){
  'use strict';

  function norm(v){
    try{return typeof normalizeQrName==='function'?normalizeQrName(v):String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}
    catch(e){return String(v||'').replace(/\s+/g,'').toLowerCase();}
  }

  function field(id){
    try{return typeof $==='function'?$(id):root.document&&root.document.getElementById?root.document.getElementById(id):null;}
    catch(e){return null;}
  }

  function safeToast(message){try{if(typeof toast==='function')toast(message);}catch(e){}}
  function safeSaveClients(){try{if(typeof save==='function')save('clients',clients);}catch(e){}}
  function safeRenderAll(){try{if(typeof renderAll==='function')renderAll();}catch(e){}}
  function safeRenderRates(c){try{if(typeof renderRates==='function')renderRates(c);}catch(e){}}

  root.addClient=function(){
    const nameEl=field('newClientName');
    const loadingEl=field('newClientLoading');
    const transportEl=field('newClientTransport');
    const itemEl=field('newClientItem');
    const priceEl=field('newClientPrice');
    if(!nameEl){safeToast('거래처 입력 화면을 찾지 못했습니다');return false;}

    const name=String(nameEl.value||'').trim();
    if(!name){safeToast('거래처명을 입력해주세요');return false;}

    const key=norm(name);
    let c=(clients||[]).find(x=>norm(x&&x.name)===key);
    const isNew=!c;
    const loadingInput=String(loadingEl&&loadingEl.value||'').trim();
    const transportInput=String(transportEl&&transportEl.value||'').trim();
    const item=String(itemEl&&itemEl.value||'').trim();
    const rawPrice=String(priceEl&&priceEl.value||'').replace(/,/g,'').trim();
    const price=rawPrice===''?0:(Number(rawPrice)||0);
    const loadingWasManual=Boolean(loadingEl&&loadingEl.dataset&&loadingEl.dataset.manual);

    if(isNew){
      c={id:Date.now(),name,loading:loadingInput||name,transport:transportInput,rates:[]};
      clients.push(c);
    }else{
      c.name=name;
      c.rates=Array.isArray(c.rates)?c.rates:[];
      if(loadingWasManual&&loadingInput)c.loading=loadingInput;
      else if(!c.loading)c.loading=loadingInput||name;
      if(transportInput)c.transport=transportInput;
      else if(!c.transport)c.transport='';
    }

    c.rates=Array.isArray(c.rates)?c.rates:[];
    if(item){
      const itemKey=norm(item);
      let rate=c.rates.find(r=>norm(r&&r.item)===itemKey);
      if(rate){rate.item=item;rate.price=price;}
      else c.rates.push({item,price});
    }

    safeSaveClients();
    ['newClientName','newClientLoading','newClientTransport','newClientItem','newClientPrice'].forEach(id=>{
      const e=field(id);if(e)e.value='';
    });
    if(loadingEl&&loadingEl.dataset)delete loadingEl.dataset.manual;
    safeRenderAll();
    safeToast(isNew?'✓ 신규 거래처 등록 완료':'✓ 기존 거래처 정보 수정 완료');
    return true;
  };

  root.saveRate=function(){
    const idEl=field('rateClientId'),itemEl=field('rateItem'),priceEl=field('ratePrice');
    const c=(clients||[]).find(x=>x.id===Number(idEl&&idEl.value));
    const item=String(itemEl&&itemEl.value||'').trim();
    const price=Number(String(priceEl&&priceEl.value||0).replace(/,/g,''))||0;
    if(!c){safeToast('거래처를 다시 선택해주세요');return false;}
    if(!item){safeToast('물품명을 입력해주세요');return false;}
    c.rates=Array.isArray(c.rates)?c.rates:[];
    const itemKey=norm(item);
    let rate=c.rates.find(r=>norm(r&&r.item)===itemKey);
    if(rate){rate.item=item;rate.price=price;}
    else c.rates.push({item,price});
    safeSaveClients();
    try{if(typeof closeRateModal==='function')closeRateModal();}catch(e){}
    safeRenderAll();
    safeToast('✓ 물품/단가 저장 완료');
    return true;
  };

  const previousChooseQrItem=root.chooseQrItem;
  root.chooseQrItem=function(q,c){
    let result;
    try{result=previousChooseQrItem(q,c);}catch(e){}
    if(!q||!q.item||!c)return result;

    c.rates=Array.isArray(c.rates)?c.rates:[];
    const itemKey=norm(q.item);
    let rate=c.rates.find(r=>norm(r&&r.item)===itemKey);
    if(!rate){
      rate={item:q.item,price:Number(q.price||0)||0};
      c.rates.push(rate);
      safeSaveClients();
      safeRenderRates(c);
    }

    try{if(typeof chooseRate==='function')chooseRate(rate.item,Number(rate.price||0));}
    catch(e){root.regItem=rate.item;}
    root.regItem=rate.item;
    const display=field('regItemDisplay');if(display)display.value=rate.item;
    return result;
  };
})(window);
