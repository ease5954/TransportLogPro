// Ssangyong Bukpyeong QR final compatibility layer.
// Loaded after app.js so only the Ssangyong flow is strengthened.
(function(root){
  'use strict';

  const originalParseTransportQR = root.parseTransportQR;
  const originalChooseQrItem = root.chooseQrItem;

  function stripControls(value){
    return String(value == null ? '' : value)
      .replace(/^[\u0000-\u001f]+|[\u0000-\u001f]+$/g,'')
      .trim();
  }

  function structuralSsangyong(text){
    const candidates=[];
    const original=stripControls(text);
    if(original)candidates.push(original);
    try{
      if(typeof root.repairQrText==='function'){
        const repaired=stripControls(root.repairQrText(text));
        if(repaired&&!candidates.includes(repaired))candidates.unshift(repaired);
      }
    }catch(e){}

    for(const raw of candidates){
      const q=raw.split('@').map(v=>String(v||'').trim());
      if(q.length<8)continue;
      const dateIndex=q.findIndex(v=>/^\d{8}$/.test(v));
      if(dateIndex<0)continue;
      const first=q[0]||'';
      const slip=q[1]||'';
      // Ssangyong Northpyeong slips consistently carry BK in the first field
      // and a long 0004... dispatch number in the second field. These ASCII
      // markers survive even when CP949 Hangul is mangled by the scanner.
      if(!/BK/i.test(first)||!/^0004\d{8,}/.test(slip))continue;

      const weights=q.map((v,i)=>({i,n:Number(String(v).replace(/,/g,''))}))
        .filter(x=>x.i<dateIndex&&Number.isFinite(x.n)&&x.n>=10&&x.n<=80);
      if(!weights.length)continue;
      const weight=weights[weights.length-1].n;
      const date=typeof root.formatQrSlipDate==='function'
        ?root.formatQrSlipDate(q[dateIndex])
        :q[dateIndex];
      const time=/^\d{4,6}$/.test(q[dateIndex+1]||'')?q[dateIndex+1]:'';

      let item=first;
      if(!/[가-힣]/.test(item)){
        const grade=(item.match(/^\s*([1-5])/)||[])[1];
        if(grade)item=grade+'종 BK';
      }

      let vehicle=q.find(v=>/[가-힣]{1,2}\d{2,3}[가-힣]\d{4}/.test(v))||q[3]||'';
      return {
        valid:true,
        type:'ssangyong-at',
        company:'쌍용C&E',
        slip,
        carrier:'',
        vehicle,
        weight,
        loading:'쌍용C&E 북평공장',
        date,
        time,
        customer:'유진기업-동서울(특수)',
        item:item||'3종 BK',
        unloading:'북평공장',
        driver:'',
        customerComplete:true,
        destinationComplete:true,
        raw
      };
    }
    return null;
  }

  root.parseTransportQR=function(text){
    let result=null;
    try{result=originalParseTransportQR(text);}catch(e){}
    if(result&&result.valid)return result;
    return structuralSsangyong(text)||result||{valid:false,reason:'운송정보 항목이 없는 QR입니다.',raw:String(text||'')};
  };

  root.chooseQrItem=function(q,c){
    if(!q||q.type!=='ssangyong-at')return originalChooseQrItem(q,c);
    if(!q.item)q.item='3종 BK';

    const rates=c&&c.rates||[];
    const key=typeof root.normalizeQrName==='function'?root.normalizeQrName(q.item):String(q.item);
    let match=rates.find(r=>(typeof root.normalizeQrName==='function'?root.normalizeQrName(r.item):String(r.item))===key);
    if(!match&&typeof root.cementGrade==='function'){
      const grade=root.cementGrade(q.item);
      const same=rates.filter(r=>root.cementGrade(r.item)===grade);
      if(grade&&same.length===1)match=same[0];
    }
    if(match){root.chooseRate(match.item,match.price);return;}

    if(c){
      c.rates=c.rates||[];
      // Register the QR item even when its price is not known yet. This removes
      // the misleading "no registered item" state while still requiring the
      // user to confirm the unit price before calculating freight.
      const rate={item:q.item,price:0};
      c.rates.push(rate);
      root.save('clients',root.clients||clients);
      root.renderRates(c);
      root.chooseRate(q.item,0);
      root.showQrStatus('쌍용 QR 인식 완료 · '+q.item+' 등록 · 단가만 확인해주세요');
      return;
    }
    originalChooseQrItem(q,c);
  };

  root.__ssangyongStructuralQR=structuralSsangyong;
})(window);
