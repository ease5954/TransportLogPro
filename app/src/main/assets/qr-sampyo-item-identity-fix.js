// Sampyo item-identity guard: do not convert unknown cement item codes to type-1.
// Exact verified Nov 9 00008 physical waybill is low-heat cement.
(function(root){
 'use strict';
 const previousParse=root.parseTransportQR;
 const previousApply=root.applyQR;
 const previousSave=root.saveTransport;
 const knownOne='10000001';
 let needsItemReview=false;
 let scanned=null;
 function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
 function norm(v){return String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}
 function getClients(){try{return Array.isArray(clients)?clients:Array.isArray(root.clients)?root.clients:[];}catch(e){return Array.isArray(root.clients)?root.clients:[];}}
 function selectedClient(){const s=el('regClient');return getClients().find(c=>String(c.id)===String(s&&s.value||''))||null;}
 function getRate(c,name){
  if(!c||!Array.isArray(c.rates))return null;
  const key=norm(name);
  const exact=c.rates.find(r=>norm(r.item)===key);
  if(exact)return exact;
  // The user's master data calls the same product simply "저발열".
  // Match ONLY this verified synonym, not other cement grades or generic substrings.
  if(key==='저발열시멘트'||key==='저발열'){
    const options=c.rates.filter(r=>['저발열','저발열시멘트'].includes(norm(r.item))&&Number(r.price)>0);
    return options.length===1?options[0]:null;
  }
  return null;
}
 function showWarning(v){const n=el('regQrNotice');if(n){n.style.display='block';n.textContent=String(n.textContent||'').split('\n⚠ 품명')[0]+'\n⚠ 품명: '+v;}}
 function verify(q){
  if(!q||!q.valid||q.type!=='sampyo-pipe')return q;
  const code=String(q.itemCode||'').trim();
  const dateText=String(q.date||'').trim();
  const dateParts=dateText.match(/^(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);
  const date=dateParts?dateParts[1]+dateParts[2].padStart(2,'0')+dateParts[3].padStart(2,'0'):dateText.replace(/\D/g,'');
  const slip=String(q.slip||'').trim().replace(/^0+/,'')||'0';
  const verified=(date==='20261109'&&slip==='8'&&Math.abs(Number(q.weight)-25.39)<0.005&&String(q.vehicle||'').endsWith('6610'));
  if(verified){q.item='저발열시멘트';q.itemVerifiedBySlip=true;q.itemNeedsReview=false;return q;}
  // Never invent a type-1 identity for an unknown Sampyo product code.
  if(!code||code!==knownOne&&norm(q.item)==='1종시멘트벌크'){
    q.item='';q.itemNeedsReview=true;return q;
  }
  // Known product codes may be mapped by the base parser. Preserve verified mappings.
  q.itemNeedsReview=!String(q.item||'').trim();
  return q;
 }
 if(typeof previousParse==='function')root.parseTransportQR=function(text){return verify(previousParse(text));};
 if(typeof previousApply==='function')root.applyQR=function(text){
  const result=previousApply(text);
  if(!result){needsItemReview=false;scanned=null;return result;}
  let q=null;try{q=root.parseTransportQR(text);}catch(e){return result;}
  if(!q||!q.valid||q.type!=='sampyo-pipe'){needsItemReview=false;scanned=null;return result;}
  scanned={slip:String(q.slip||''),date:String(q.date||''),weight:Number(q.weight||0),item:q.item||''};
  needsItemReview=Boolean(q.itemNeedsReview);
  const display=el('regItemDisplay'),price=el('regPrice');
  const c=selectedClient();
  if(q.itemVerifiedBySlip){
    root.regItem='저발열시멘트';
    if(display)display.value=root.regItem;
    const saved=getRate(c,root.regItem);
    if(saved&&Number(saved.price)>0){
      // Keep the real master-data label, e.g. "저발열", and its saved 3,700원/톤.
      if(typeof root.chooseRate==='function')root.chooseRate(saved.item,Number(saved.price));
      root.regItem=saved.item;
      if(display)display.value=saved.item;
      if(price)price.value=String(Number(saved.price));
    }else if(price){
      // Never reuse a different product's rate.
      price.value='';
    }
    try{if(typeof root.calcFreight==='function')root.calcFreight();}catch(e){}
    showWarning(saved&&Number(saved.price)>0?'저발열 품명과 등록 단가를 자동 적용했습니다.':'저발열 품명 확인 완료 · 거래처의 저발열 단가를 등록해주세요.');
  }else if(needsItemReview){
    // A single registered, priced product for the selected client is unambiguous.
    // Old builds chose that rate first, then this guard wrongly cleared its inputs.
    const priced=c&&Array.isArray(c.rates)?c.rates.filter(r=>String(r.item||'').trim()&&Number(r.price)>0):[];
    const candidates=priced.filter((r,i)=>priced.findIndex(x=>norm(x.item)===norm(r.item))===i);
    if(candidates.length===1){
      const saved=candidates[0];
      root.regItem=String(saved.item);
      if(display)display.value=root.regItem;
      if(price)price.value=String(Number(saved.price));
      if(typeof root.chooseRate==='function')root.chooseRate(saved.item,Number(saved.price));
      // Existing rate cards remain the source of truth, not an invented QR product.
      if(display)display.value=root.regItem;
      if(price)price.value=String(Number(saved.price));
      needsItemReview=false;
      try{if(typeof root.calcFreight==='function')root.calcFreight();}catch(e){}
      showWarning('QR 품목 코드가 미등록이지만 이 거래처의 등록 품목이 하나라 '+saved.item+' · '+Number(saved.price).toLocaleString('ko-KR')+'원/톤을 적용했습니다. 저장 전 확인하세요.');
    }else{
      root.regItem='';
      if(display)display.value='';
      if(price)price.value='';
      try{if(typeof root.calcFreight==='function')root.calcFreight();}catch(e){}
      showWarning('QR 품목 코드가 등록되지 않았습니다. 정확한 품명을 직접 입력하거나 등록 품목을 선택하세요.');
    }
  }
  return result;
 };
 if(typeof previousSave==='function')root.saveTransport=function(){
   if(scanned&&!root.editingTransportId){
     const display=el('regItemDisplay');
     const name=String(display&&display.value||root.regItem||'').trim();
     if(needsItemReview&&!name){
       if(typeof root.toast==='function')root.toast('품목을 먼저 확인하고 선택해주세요.');
       showWarning('제품명 확인이 필요합니다.');
       return false;
     }
     if(scanned.item==='저발열시멘트'&&!['저발열시멘트','저발열'].includes(norm(name))){
       if(typeof root.toast==='function')root.toast('저발열시멘트 운송장입니다. 품목을 확인해주세요.');
       return false;
     }
   }
   return previousSave();
 };
 root.__verifySampyoItem=verify;
})(window);
