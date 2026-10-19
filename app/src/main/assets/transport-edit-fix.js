// Transport history edit support for 1.8.5.
// Loaded last so all QR/client/product registration behavior remains unchanged.
(function(root){
  'use strict';

  const previousRenderHistory=root.renderHistory;
  const previousSaveTransport=root.saveTransport;
  const previousDeleteLog=root.deleteLog;

  function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
  function norm(v){
    try{return typeof root.normalizeQrName==='function'?root.normalizeQrName(v):String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}
    catch(e){return String(v||'').replace(/\s+/g,'').toLowerCase();}
  }
  function money(v){try{return typeof fmt==='function'?fmt(v):Number(v||0).toLocaleString('ko-KR');}catch(e){return String(v||0);}}
  function html(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}catch(e){return String(v==null?'':v);}}
  function safeToast(message){try{if(typeof root.toast==='function')root.toast(message);else if(typeof toast==='function')toast(message);}catch(e){}}
  function saveAll(){
    try{if(typeof root.save==='function'){root.save('logs',logs);root.save('clients',clients);}else if(typeof save==='function'){save('logs',logs);save('clients',clients);}}catch(e){}
  }
  function currentClient(){
    const select=el('regClient');
    return select?(clients||[]).find(c=>String(c&&c.id)===String(select.value||''))||null:null;
  }
  function selectedItem(){
    const display=el('regItemDisplay');
    return String(display&&display.value||root.regItem||'').trim();
  }
  function setValue(id,value){const e=el(id);if(e)e.value=String(value==null?'':value);}
  function setProduct(value){root.regItem=String(value||'');setValue('regItemDisplay',root.regItem);}
  function setSaveButtonMode(editing){
    if(!root.document||typeof root.document.querySelectorAll!=='function')return;
    root.document.querySelectorAll('button[onclick="saveTransport()"],button[data-quick-save="1"]').forEach(btn=>{
      btn.textContent=editing?'✓ 수정 내용 저장':'✓ 운송일보 저장';
    });
    const cancel=el('transportEditCancel');
    if(cancel)cancel.style.display=editing?'block':'none';
  }
  function showEditNotice(log){
    const n=el('regQrNotice');
    if(!n)return;
    n.style.display='block';
    n.style.background='#fff7df';
    n.style.borderColor='#f0c862';
    n.textContent='✎ 운송내역 수정 중\n'+String(log.client||'')+' · '+String(log.item||'-')+' · '+Number(log.weight||0)+'톤\n수정 후 “수정 내용 저장”을 눌러주세요.';
  }
  function clearEditNotice(){
    const n=el('regQrNotice');
    if(!n)return;
    n.style.display='none';
    n.textContent='';
    n.style.background='#eaf8f0';
    n.style.borderColor='#b7dfc4';
  }
  function clearEditState(){
    root.editingTransportId=null;
    root.pendingQrMeta=null;
    clearEditNotice();
    setSaveButtonMode(false);
  }
  function ensureClientForLog(log){
    let c=(clients||[]).find(x=>norm(x&&x.name)===norm(log.client));
    if(!c)return null;
    c.rates=Array.isArray(c.rates)?c.rates:[];
    if(log.item){
      let r=c.rates.find(x=>norm(x&&x.item)===norm(log.item));
      if(!r){r={item:log.item,price:Number(log.price||0)};c.rates.push(r);}
      if(log.loading)r.loading=log.loading;
      if(log.unloading)r.unloading=log.unloading;
      if(log.aggregate)r.aggregate=log.aggregate;
      if(log.transport)r.transport=log.transport;
    }
    return c;
  }

  root.renderHistory=function(){
    let a=[];
    try{a=typeof filteredLogs==='function'?filteredLogs().slice():[];}catch(e){
      try{previousRenderHistory();}catch(_e){}
      return;
    }
    a.sort((x,y)=>Number(y.id||0)-Number(x.id||0));
    const trips=el('histTrips'),weight=el('histWeight'),freight=el('histFreight'),list=el('historyList');
    if(trips)trips.textContent=a.length+'건';
    if(weight)weight.textContent=money(a.reduce((s,x)=>s+Number(x.weight||0),0))+'톤';
    if(freight)freight.textContent=money(a.reduce((s,x)=>s+Number(x.freight||0),0))+'원';
    if(!list)return;
    list.innerHTML=a.length?a.map(x=>`<div class="list"><div class="listtop"><span>${html(x.date)}</span><span>${html(x.vehicle||'')}</span></div><div class="listtitle">${html(x.client)} · ${html(x.item||'-')}</div><div class="listinfo"><span>${html(x.loading||'-')} → ${html(x.unloading||'-')}</span><span class="amt">${money(x.freight)}원</span></div><div class="listinfo" style="margin-top:6px"><span>${money(x.weight)}톤 · ${money(x.price)}원/톤</span><span><button style="border:0;background:none;color:#168a4c;font-weight:900;margin-right:12px" onclick="editTransport(${Number(x.id)})">수정</button><button style="border:0;background:none;color:#d33" onclick="deleteLog(${Number(x.id)})">삭제</button></span></div></div>`).join(''):'<div class="empty">운송내역이 없습니다.</div>';
  };

  root.editTransport=function(id){
    const log=(logs||[]).find(x=>Number(x&&x.id)===Number(id));
    if(!log){safeToast('수정할 운송내역을 찾지 못했습니다');return false;}
    root.editingTransportId=Number(log.id);
    root.pendingQrMeta={date:log.date||''};

    try{if(typeof root.go==='function')root.go('register');else if(typeof go==='function')go('register');}catch(e){}
    try{if(typeof root.fillClients==='function')root.fillClients();else if(typeof fillClients==='function')fillClients();}catch(e){}

    const c=ensureClientForLog(log);
    const select=el('regClient');
    const manual=el('regClientManual');
    if(c&&select){
      select.value=String(c.id);
      try{if(typeof root.applyClient==='function')root.applyClient();else if(typeof applyClient==='function')applyClient();}catch(e){}
      if(manual)manual.value=String(log.client||'');
    }else{
      if(select)select.value='';
      if(manual)manual.value=String(log.client||'');
    }

    setProduct(log.item||'');
    setValue('regWeight',Number(log.weight||0));
    setValue('regPrice',Number(log.price||0));
    setValue('regLoading',log.loading||'');
    setValue('regUnloading',log.unloading||'');
    setValue('regAggregate',log.aggregate||'');
    setValue('regTransport',log.transport||'');
    setValue('regVehicle',log.vehicle||'');
    try{if(typeof root.calcFreight==='function')root.calcFreight();else if(typeof calcFreight==='function')calcFreight();}catch(e){}
    showEditNotice(log);
    setSaveButtonMode(true);
    if(root.scrollTo)root.scrollTo(0,0);
    return true;
  };

  root.cancelTransportEdit=function(){
    clearEditState();
    try{if(typeof root.go==='function')root.go('history');else if(typeof go==='function')go('history');}catch(e){}
    safeToast('수정을 취소했습니다');
    return true;
  };

  root.saveTransport=function(){
    if(!root.editingTransportId)return previousSaveTransport();

    const old=(logs||[]).find(x=>Number(x&&x.id)===Number(root.editingTransportId));
    if(!old){clearEditState();safeToast('수정할 운송내역을 찾지 못했습니다');return false;}

    let c=currentClient();
    if(!c&&typeof root.__ensureDirectClientForSave==='function'){
      try{c=root.__ensureDirectClientForSave();}catch(e){}
    }
    if(!c){safeToast('거래처를 선택하거나 직접 입력해주세요');return false;}

    const w=Number(el('regWeight')&&el('regWeight').value||0);
    if(w<=0){safeToast('중량을 입력해주세요');return false;}
    const item=selectedItem();
    if(!item){safeToast('제품명을 입력해주세요');return false;}
    const p=Number(String(el('regPrice')&&el('regPrice').value||0).replace(/,/g,''))||0;

    old.client=String(c.name||old.client||'');
    old.item=item;
    old.weight=w;
    old.price=p;
    old.freight=Math.round(w*p);
    old.loading=String(el('regLoading')&&el('regLoading').value||'').trim();
    old.unloading=String(el('regUnloading')&&el('regUnloading').value||'').trim();
    old.aggregate=String(el('regAggregate')&&el('regAggregate').value||'').trim();
    old.transport=String(el('regTransport')&&el('regTransport').value||'').trim();
    old.vehicle=String(el('regVehicle')&&el('regVehicle').value||'').trim();

    if(typeof root.__persistManualProductEntry==='function'){
      root.regItem=item;
      try{root.__persistManualProductEntry(c);}catch(e){}
    }else{
      c.rates=Array.isArray(c.rates)?c.rates:[];
      let r=c.rates.find(x=>norm(x&&x.item)===norm(item));
      if(!r){r={item,price:p};c.rates.push(r);}else{r.item=item;r.price=p;}
      if(old.loading)r.loading=old.loading;
      if(old.unloading)r.unloading=old.unloading;
      if(old.aggregate)r.aggregate=old.aggregate;
      if(old.transport)r.transport=old.transport;
    }
    if(old.loading)c.loading=old.loading;
    if(old.unloading)c.unloading=old.unloading;
    if(old.aggregate)c.aggregate=old.aggregate;
    if(old.transport)c.transport=old.transport;

    saveAll();
    setValue('regWeight','');
    setValue('regPrice','');
    setProduct('');
    setValue('regLoading','');
    setValue('regUnloading','');
    setValue('regAggregate','');
    setValue('regTransport','');
    setValue('regVehicle','');
    const manual=el('regClientManual');if(manual)manual.value='';
    clearEditState();
    safeToast('✓ 운송내역 수정 완료');
    try{if(typeof root.go==='function')root.go('history');else if(typeof go==='function')go('history');}catch(e){}
    return true;
  };

  root.deleteLog=function(id){
    if(Number(root.editingTransportId)===Number(id))clearEditState();
    return previousDeleteLog(id);
  };

  root.__transportEditLoaded=true;
})(window);
