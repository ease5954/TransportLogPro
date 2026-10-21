// QR scan pricing safety patch.
// A saved client/item rate is the source of truth. QR embedded price is only a fallback.
(function(root){
  'use strict';
  function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
  function norm(v){
    try{return typeof root.normalizeQrName==='function'?root.normalizeQrName(v):String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}
    catch(e){return String(v||'').replace(/\s+/g,'').toLowerCase();}
  }
  function grade(v){const m=String(v||'').match(/([1-5])\s*종/);return m?m[1]:'';}
  function selectedClient(){
    const select=el('regClient');
    const id=String(select&&select.value||'');
    try{return (root.clients||clients||[]).find(c=>String(c&&c.id)===id)||null;}catch(e){return null;}
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
  function applySavedRate(q){
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
  const previousApply=root.applyQR;
  if(typeof previousApply==='function'){
    root.applyQR=function(text){
      const result=previousApply(text);
      try{
        const q=typeof root.parseTransportQR==='function'?root.parseTransportQR(text):null;
        if(q&&q.valid)applySavedRate(q);
      }catch(e){}
      return result;
    };
  }
  root.__applySavedRateAfterQr=applySavedRate;
  root.__findSavedQrRate=findSavedRate;
})(window);
