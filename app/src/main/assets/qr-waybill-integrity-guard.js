// QR waybill integrity: no guessing customers, protect price and prevent duplicate transport records.
(function(root){
  'use strict';
  const priorParse=root.parseTransportQR;
  const priorApply=root.applyQR;
  const priorSave=root.saveTransport;
  function el(id){return root.document&&root.document.getElementById?root.document.getElementById(id):null;}
  function norm(v){return String(v==null?'':v).replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}
  function lists(){try{return Array.isArray(logs)?logs:[];}catch(e){return Array.isArray(root.logs)?root.logs:[];}}
  function message(v){try{if(typeof root.toast==='function')root.toast(v);else if(typeof toast==='function')toast(v);}catch(e){}}
  function number(v){const n=Number(String(v||'').replace(/,/g,''));return Number.isFinite(n)?n:0;}
  function validVehicle(v){return /[가-힣]{1,2}\d{2,3}[가-힣]\d{4}/.test(String(v||''));}
  function decode(v){
    try{if(typeof root.__decodeHanilMojibakeField==='function')return root.__decodeHanilMojibakeField(v);}catch(e){}
    return String(v||'');
  }
  function dateFrom(v){const d=String(v||'').replace(/\D/g,'');return d.length===8?d:'';}
  function identify(q){
    if(!q||!q.valid)return '';
    const slip=String(q.slip||'').trim().toUpperCase().replace(/\s+/g,'');
    const company=norm(q.company||q.type||'');
    if(slip&&slip.length>=5)return company+'|'+slip;
    // Some carriers use four-digit daily slips: pair them with date + truck + weight.
    if(slip&&slip.length>=3&&q.date&&q.weight&&validVehicle(q.vehicle))
      return company+'|'+dateFrom(q.date)+'|'+slip+'|'+norm(q.vehicle)+'|'+Number(q.weight).toFixed(3);
    // The raw QR payload is unique even when the slip is missing.
    const raw=String(q.raw||'').replace(/^[\u0000-\u001f]+|[\u0000-\u001f]+$/g,'').trim();
    if(raw.length<12)return '';
    let hash=2166136261;
    for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return company+'|raw|'+(hash>>>0).toString(16);
  }
  function repairNorthpyeong(q,text){
    if(!q||!q.valid||q.type!=='ssangyong-at')return q;
    const raw=String(q.raw||text||'');
    const a=raw.split('@').map(decode);
    const di=a.findIndex(x=>/^20\d{6}$/.test(String(x||'')));
    const joined=a.join(' ');
    // Do not hard-code an unrelated destination: use the waybill's own receiver.
    let customer=di>=0?String(a[di+2]||'').trim():'';
    if(!/[가-힣]/.test(customer)||/^\d+$/.test(customer))customer='';
    if(/동양/.test(joined)&&/파주/.test(joined))customer='동양-파주(특수)';
    else if(/유진기업/.test(joined)&&/동서울/.test(joined))customer='유진기업-동서울(특수)';
    // Old parser inserted a constant customer even if none was decoded.
    if(customer){q.customer=customer;q.customerComplete=true;}
    else{q.customer='';q.customerComplete=false;}
    const vehicle=a.map(decode).find(validVehicle);
    if(vehicle)q.vehicle=String(vehicle).match(/[가-힣]{1,2}\d{2,3}[가-힣]\d{4}/)[0];
    else if(!validVehicle(q.vehicle))q.vehicle='';
    // Keep explicitly decoded destination if present. Never invent a different receiver.
    const unloading=di>=0?decode(a[di+3]||'').trim():'';
    if(unloading&&/[가-힣]/.test(unloading))q.unloading=unloading;
    if(!q.customerComplete)q.destinationComplete=Boolean(q.unloading);
    return q;
  }
  if(typeof priorParse==='function'){
    root.parseTransportQR=function(text){const q=priorParse(text);return repairNorthpyeong(q,text);};
  }
  let scan=null;
  if(typeof priorApply==='function'){
    root.applyQR=function(text){
      // Calling the prior QR handler may refresh the selected client, item and form.
      const result=priorApply(text);
      if(!result){scan=null;return result;}
      try{
        const q=root.parseTransportQR(text);
        if(q&&q.valid){
          scan={key:identify(q),date:q.date||'',weight:Number(q.weight)||0,
                vehicle:q.vehicle||'',slip:q.slip||'',company:q.company||'',
                item:q.item||'',loading:q.loading||'',customer:q.customer||''};
          const current=root.pendingQrMeta||{};
          root.pendingQrMeta={...current,slip:q.slip||'',company:q.company||'',qrKey:scan.key,
                              date:q.date||current.date||'',qrCustomer:q.customer||''};
          // Restore a corrected receiver after older handlers' client hard-coding.
          if(q.type==='ssangyong-at'){
            if(q.customer){
              let client=null;
              try{client=(clients||[]).find(c=>norm(c.name)===norm(q.customer));}catch(e){}
              if(client){
                const sel=el('regClient');if(sel)sel.value=String(client.id);
                if(typeof root.applyClient==='function')root.applyClient();
                if(typeof root.chooseQrItem==='function')root.chooseQrItem(q,client);
                const display=el('regItemDisplay');if(display&&q.item)display.value=q.item;
                root.regItem=q.item||root.regItem;
                if(q.weight)el('regWeight').value=String(q.weight);
              }else{
                // Unknown customer: require manual selection; never use the unrelated client.
                const sel=el('regClient');if(sel)sel.value='';
                const manual=el('regClientManual');if(manual)manual.value=q.customer;
                root.regItem=q.item||'';
                const display=el('regItemDisplay');if(display)display.value=root.regItem;
                const price=el('regPrice');if(price)price.value='';
              }
            }else{
              const sel=el('regClient');if(sel)sel.value='';
              const price=el('regPrice');if(price)price.value='';
            }
            if(el('regVehicle'))el('regVehicle').value=q.vehicle||'';
            if(el('regLoading'))el('regLoading').value=q.loading||'';
            if(el('regUnloading'))el('regUnloading').value=q.unloading||'';
            if(el('regWeight')&&q.weight)el('regWeight').value=String(q.weight);
            try{root.calcFreight();}catch(e){}
          }
        }
      }catch(e){scan=null;}
      return result;
    };
  }
  function exactDuplicate(meta,rows){
    if(!meta||!meta.key)return null;
    return rows.find(x=>x.qrKey&&x.qrKey===meta.key)||null;
  }
  function probableLegacyDuplicate(meta,rows){
    if(!meta||!meta.date||!meta.weight)return null;
    return rows.find(x=>{
      if(x.qrKey)return false;
      if(dateFrom(x.date)!==dateFrom(meta.date))return false;
      if(Math.abs(number(x.weight)-meta.weight)>0.005)return false;
      if(meta.vehicle&&validVehicle(meta.vehicle)&&validVehicle(x.vehicle))
        return norm(meta.vehicle)===norm(x.vehicle);
      return false;
    })||null;
  }
  if(typeof priorSave==='function'){
    let saving=false;
    root.saveTransport=function(){
      if(saving)return false;
      const editing=Boolean(root.editingTransportId);
      const meta=!editing?scan:null;
      const rows=lists();
      if(!editing&&meta){
        const exact=exactDuplicate(meta,rows);
        if(exact){message('이미 등록된 운송장입니다. 중복 저장하지 않았습니다.');return false;}
        const legacy=probableLegacyDuplicate(meta,rows);
        if(legacy){message('같은 날짜·중량·차량의 운송내역이 이미 있습니다. 먼저 내역을 확인하세요.');return false;}
      }
      const price=number(el('regPrice')&&el('regPrice').value);
      if(price<=0){message('단가를 확인해주세요. 0원으로는 저장할 수 없습니다.');return false;}
      const weight=number(el('regWeight')&&el('regWeight').value);
      if(weight<=0){message('중량을 확인해주세요.');return false;}
      // Prevent an uncertain QR receiver from silently saving under an old selection.
      if(!editing&&meta&&meta.company==='쌍용C&E'&&meta.customer){
        const chosen=el('regClient');
        let client=null;try{client=(clients||[]).find(c=>String(c.id)===String(chosen&&chosen.value||''));}catch(e){}
        const manual=el('regClientManual');
        const chosenName=String(manual&&manual.value||client&&client.name||'').trim();
        if(chosenName&&norm(chosenName)!==norm(meta.customer)){
          message('QR 거래처와 선택 거래처가 다릅니다. 거래처를 확인해주세요.');return false;
        }
      }
      saving=true;
      const before=rows.length;
      let result;
      try{result=priorSave();}finally{saving=false;}
      if(!editing&&meta&&rows.length>before){
        const newLog=rows[rows.length-1];
        if(newLog){
          newLog.qrKey=meta.key||'';
          newLog.qrSlip=meta.slip||'';
          newLog.qrCompany=meta.company||'';
          try{if(typeof root.save==='function')root.save('logs',rows);else if(typeof save==='function')save('logs',rows);}catch(e){}
          scan=null;
        }
      }
      return result;
    };
  }
  root.__qrWaybillKey=identify;
  root.__qrDuplicateCheck=exactDuplicate;
})(window);
