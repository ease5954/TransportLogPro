// QR scan pricing safety patch.
// Saved client/item rate is the source of truth. QR embedded price is only a fallback.
// Also repairs the legacy Sampyo/Mirae rate that older QR builds could overwrite to 3,300.
(function(root){
  'use strict';
  function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
  function norm(v){
    try{return typeof root.normalizeQrName==='function'?root.normalizeQrName(v):String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}
    catch(e){return String(v||'').replace(/\s+/g,'').toLowerCase();}
  }
  function getClients(){try{return Array.isArray(clients)?clients:(Array.isArray(root.clients)?root.clients:[]);}catch(e){return Array.isArray(root.clients)?root.clients:[];}}
  function safeSaveClients(){
    const list=getClients();
    try{if(typeof root.save==='function')root.save('clients',list);else if(typeof save==='function')save('clients',list);}catch(e){}
  }
  function grade(v){const m=String(v||'').match(/([1-5])\s*종/);return m?m[1]:'';}
  function selectedClient(){
    const select=el('regClient');
    const id=String(select&&select.value||'');
    return getClients().find(c=>String(c&&c.id)===id)||null;
  }
  function selectedItem(q){
    const display=el('regItemDisplay');
    return String(root.regItem||display&&display.value||q&&q.item||'').trim();
  }
  function findSavedRate(c,item){
    if(!c||!item)return null;
    const rates=Array.isArray(c.rates)?c.rates:[];
    const key=norm(item);
    let match=rates.find(r=>norm(r&&r.item)===key)
      ||rates.find(r=>{const rk=norm(r&&r.item);return rk&&key&&(rk.includes(key)||key.includes(rk));});
    if(!match){
      const g=grade(item);
      if(g){const same=rates.filter(r=>grade(r&&r.item)===g);if(same.length===1)match=same[0];}
    }
    return match||null;
  }
  function repairLegacyMiraeRate(){
    let changed=false;
    const clientKey=norm('미래해운(주)');
    const itemKey=norm('1종시멘트벌크');
    getClients().forEach(c=>{
      if(norm(c&&c.name)!==clientKey)return;
      c.rates=Array.isArray(c.rates)?c.rates:[];
      const r=c.rates.find(x=>norm(x&&x.item)===itemKey);
      if(r&&Number(r.price)===3300){r.price=3700;changed=true;}
    });
    if(changed){
      safeSaveClients();
      try{if(typeof root.renderAll==='function')root.renderAll();else if(typeof renderAll==='function')renderAll();}catch(e){}
    }
    return changed;
  }
  function applySavedRate(q){
    repairLegacyMiraeRate();
    const c=selectedClient();
    const item=selectedItem(q);
    const rate=findSavedRate(c,item);
    const price=Number(rate&&rate.price||0);
    const priceEl=el('regPrice');
    if(!priceEl||price<=0)return false;
    priceEl.value=String(price);
    root.regItem=String(rate.item||item);
    const display=el('regItemDisplay');if(display)display.value=root.regItem;
    try{if(typeof root.calcFreight==='function')root.calcFreight();else if(typeof calcFreight==='function')calcFreight();}catch(e){}
    return true;
  }

  // Let the existing QR flow populate customer/item/weight first, then force the saved rate last.
  const previousApply=root.applyQR;
  if(typeof previousApply==='function'){
    root.applyQR=function(text){
      const result=previousApply(text);
      try{
        repairLegacyMiraeRate();
        const q=typeof root.parseTransportQR==='function'?root.parseTransportQR(text):null;
        if(q&&q.valid)applySavedRate(q);
      }catch(e){}
      return result;
    };
  }

  // Saving a transport must not leave the legacy QR price behind in client master data.
  const previousSave=root.saveTransport;
  if(typeof previousSave==='function'){
    root.saveTransport=function(){
      try{repairLegacyMiraeRate();applySavedRate(null);}catch(e){}
      const result=previousSave();
      try{repairLegacyMiraeRate();}catch(e){}
      return result;
    };
  }

  root.__applySavedRateAfterQr=applySavedRate;
  root.__findSavedQrRate=findSavedRate;
  root.__repairLegacyMiraeRate=repairLegacyMiraeRate;
  repairLegacyMiraeRate();
})(window);
