// Product-code confirmations for Sampyo QR, scoped to client and exact QR item code.
// Never infer low-heat cement from weight or a client's unrelated product prices.
(function(root){
 'use strict';
 const oldParse=root.parseTransportQR, oldApply=root.applyQR;
 let pending=null;
 const KEY='transportlog_qr_item_map_v1';
 function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
 function norm(s){return String(s||'').replace(/[^a-zA-Z0-9가-힣]/g,'').toLowerCase();}
 function clientsList(){try{return Array.isArray(clients)?clients:[];}catch(e){return Array.isArray(root.clients)?root.clients:[];}}
 function selectedClient(){const id=String(el('regClient')&&el('regClient').value||'');return clientsList().find(c=>String(c.id)===id)||null;}
 function savedMap(){try{const a=JSON.parse(root.localStorage.getItem(KEY)||'{}');return a&&typeof a==='object'&&!Array.isArray(a)?a:{};}catch(e){return {};}}
 function saveMap(map){try{root.localStorage.setItem(KEY,JSON.stringify(map));return true;}catch(e){return false;}}
 function rateFor(c,item){if(!c||!Array.isArray(c.rates))return null;
   const key=norm(item);
   const found=c.rates.find(r=>norm(r.item)===key&&Number(r.price)>0);
   if(found)return found;
   if(key==='저발열시멘트'||key==='저발열'){
     const same=c.rates.filter(r=>['저발열','저발열시멘트'].includes(norm(r.item))&&Number(r.price)>0);
     const prices=[...new Set(same.map(r=>Number(r.price)))];
     if(prices.length===1)return same.find(r=>norm(r.item)==='저발열')||same[0];
   }
   return null;
 }
 function codeKey(c,code){return norm(c&&c.name)+'|'+String(code||'').trim();}
 function exactCode(q){return String(q&&q.itemCode||'').trim();}
 function hasVerifiedSource(q){return Boolean(q&&q.itemVerifiedBySlip)||exactCode(q)==='10000001';}
 function showNotice(text){
   const n=el('regQrNotice');if(n){n.style.display='block';const prefix=String(n.textContent||'').split('\n⚠ 품명')[0];n.textContent=prefix+'\n⚠ 품명: '+text;}
 }
 function setChoice(rate){
   if(!rate||Number(rate.price)<=0)return false;
   root.regItem=String(rate.item);
   if(typeof root.chooseRate==='function')root.chooseRate(rate.item,Number(rate.price));
   const item=el('regItemDisplay'),price=el('regPrice');
   if(item)item.value=String(rate.item);
   if(price)price.value=String(Number(rate.price));
   // Correct both value and highlighted card after other QR overlays.
   if(root.document&&typeof root.document.querySelectorAll==='function'){
     root.document.querySelectorAll('.choice').forEach(b=>{
       let name='';try{name=decodeURIComponent(b.dataset.item||'');}catch(e){}
       b.classList.toggle('active',norm(name)===norm(rate.item));
     });
   }
   try{if(typeof root.calcFreight==='function')root.calcFreight();}catch(e){}
   return true;
 }
 function clearUnknown(){
   root.regItem='';
   const item=el('regItemDisplay'),price=el('regPrice');
   if(item)item.value='';if(price)price.value='';
   if(root.document&&typeof root.document.querySelectorAll==='function'){
     root.document.querySelectorAll('.choice').forEach(b=>b.classList.remove('active'));
   }
   try{if(typeof root.calcFreight==='function')root.calcFreight();}catch(e){}
 }
 // The top-level QR flow has already chosen the client and weight. Fix only product/price.
 if(typeof oldApply==='function')root.applyQR=function(raw){
   const ok=oldApply(raw);
   if(!ok){pending=null;return ok;}
   let q=null;try{q=oldParse(raw);}catch(e){pending=null;return ok;}
   if(!q||!q.valid||q.type!=='sampyo-pipe'){pending=null;return ok;}
   const c=selectedClient();
   if(!c){pending=null;return ok;}
   const code=exactCode(q),key=code?codeKey(c,code):'';
   const map=savedMap(), learned=key?map[key]:null;
   const verified=Boolean(q.itemVerifiedBySlip);
   // A verified slip or known code must retain its authentic product, not an old guess.
   const selected=verified?rateFor(c,'저발열시멘트'):learned?rateFor(c,learned):hasVerifiedSource(q)?rateFor(c,q.item):null;
   if(selected){setChoice(selected);pending=null;
     showNotice(learned?'이전에 확인한 QR 품목 코드로 '+selected.item+' · '+Number(selected.price).toLocaleString('ko-KR')+'원/톤을 적용했습니다.':'확인된 품목 '+selected.item+' · '+Number(selected.price).toLocaleString('ko-KR')+'원/톤을 적용했습니다.');
     return ok;
   }
   // A genuinely unrecognized QR code with multiple possible products is ambiguous.
   const priced=(c.rates||[]).filter(r=>Number(r.price)>0&&String(r.item||'').trim());
   const distinct=[...new Set(priced.map(r=>['저발열','저발열시멘트'].includes(norm(r.item))?'저발열':norm(r.item)))];
   if(distinct.length===1&&priced.length>0){
      const rate=rateFor(c,priced[0].item);
      if(rate){setChoice(rate);pending=null;showNotice('등록된 품목이 하나라 '+rate.item+' · '+Number(rate.price).toLocaleString('ko-KR')+'원/톤을 적용했습니다.');return ok;}
   }
   pending={clientName:norm(c.name),code,key};
   clearUnknown();
   showNotice('미확인 QR 품목 코드 '+(code||'(없음)')+' · 아래 등록된 품목 카드를 한 번 누르세요. 저장 단가가 즉시 입력됩니다.'+(code?' 다음 같은 코드는 자동 적용됩니다.':''));
   return ok;
 };
 // The card's built-in onclick still handles the route, loading and freight;
 // this bubbling handler merely learns the user's explicit correction.
 function chosenCard(event){
   if(!pending)return;
   let target=event&&event.target;
   while(target&&target!==el('rateChoices')){
     if(target.classList&&target.classList.contains('choice'))break;
     target=target.parentNode;
   }
   if(!target||target===el('rateChoices'))return;
   let item='';try{item=decodeURIComponent(target.dataset.item||'');}catch(e){}
   const c=selectedClient();
   if(!c||norm(c.name)!==pending.clientName)return;
   const rate=rateFor(c,item);
   if(!rate)return;
   setChoice(rate);
   if(pending.key){const map=savedMap();map[pending.key]=rate.item;saveMap(map);}
   pending=null;
   showNotice('선택한 '+rate.item+' 단가 '+Number(rate.price).toLocaleString('ko-KR')+'원/톤 적용 완료. 다음 같은 QR은 자동 적용됩니다.');
 }
 const choices=el('rateChoices');if(choices&&typeof choices.addEventListener==='function')choices.addEventListener('click',chosenCard);
 root.__qrConfirmedProductRate=rateFor;
 root.__qrProductMapKey=codeKey;
})(window);
