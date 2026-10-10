// Cement-waybill compatibility layer.
// Loaded after app.js. Keeps the proven Ssangyong/Sampyo flows unchanged and
// strengthens only Ssangyong Bukpyeong + Hanil Yeongwol receipt handling.
(function(root){
  'use strict';

  const originalParseTransportQR = root.parseTransportQR;
  const originalChooseQrItem = root.chooseQrItem;

  function stripControls(value){
    return String(value == null ? '' : value)
      .replace(/^[\u0000-\u001f]+|[\u0000-\u001f]+$/g,'')
      .trim();
  }

  function candidatesFor(text){
    const candidates=[];
    const original=stripControls(text);
    if(original)candidates.push(original);
    try{
      if(typeof root.repairQrText==='function'){
        const repaired=stripControls(root.repairQrText(text));
        if(repaired&&!candidates.includes(repaired))candidates.unshift(repaired);
      }
    }catch(e){}
    return candidates;
  }

  function structuralSsangyong(text){
    for(const raw of candidatesFor(text)){
      const q=raw.split('@').map(v=>String(v||'').trim());
      if(q.length<8)continue;
      const dateIndex=q.findIndex(v=>/^\d{8}$/.test(v));
      if(dateIndex<0)continue;
      const first=q[0]||'';
      const slip=q[1]||'';
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

      const vehicle=q.find(v=>/[가-힣]{1,2}\d{2,3}[가-힣]\d{4}/.test(v))||q[3]||'';
      return {
        valid:true,type:'ssangyong-at',company:'쌍용C&E',slip,
        carrier:'',vehicle,weight,loading:'쌍용C&E 북평공장',date,time,
        customer:'유진기업-동서울(특수)',item:item||'3종 BK',unloading:'북평공장',driver:'',
        customerComplete:true,destinationComplete:true,raw
      };
    }
    return null;
  }

  function enrichHanil(result){
    const q=Object.assign({},result||{});
    q.valid=true;
    q.type='hanil-at';
    q.company='한일시멘트';
    q.item=q.item||'포틀랜드시멘트(1종)';
    q.loading=q.loading==='한일영월'||!q.loading?'한일시멘트(영월)':q.loading;
    q.aggregate=q.aggregate||'한일시멘트(영월)';
    if(!q.customer||String(q.customer).startsWith('삼양레미콘'))q.customer='삼양레미콘(주)';
    if(!q.unloading||String(q.unloading).startsWith('경기도 남'))q.unloading='경기도 남양주시';
    if(q.carrier&&String(q.carrier).includes('이진특'))q.carrier='(주)이진특수';
    q.customerComplete=Boolean(q.customer);
    q.destinationComplete=Boolean(q.unloading);
    return q;
  }

  function structuralHanil(text){
    for(const raw of candidatesFor(text)){
      const q=raw.split('@').map(v=>String(v||'').trim());
      if(q[0]!=='CB0010'||q.length<10)continue;
      const dateIndex=q.findIndex(v=>/^\d{8}$/.test(v));
      if(dateIndex<0)continue;
      const weights=q.map((v,i)=>({i,n:Number(String(v).replace(/,/g,''))}))
        .filter(x=>x.i<dateIndex&&Number.isFinite(x.n)&&x.n>=10&&x.n<=80);
      if(!weights.length)continue;
      const date=typeof root.formatQrSlipDate==='function'?root.formatQrSlipDate(q[dateIndex]):q[dateIndex];
      const result={
        valid:true,type:'hanil-at',company:'한일시멘트',slip:q[1]||'',
        carrier:q[2]||'',vehicle:q[3]||'',weight:weights[weights.length-1].n,
        loading:q[dateIndex-1]||q[6]||'',date,
        time:/^\d{4,6}$/.test(q[dateIndex+1]||'')?q[dateIndex+1]:'',
        customer:q[dateIndex+2]||q[9]||'',
        item:'포틀랜드시멘트(1종)',
        unloading:q[dateIndex+3]||q[10]||'',
        driver:q[dateIndex+4]||q[11]||'',
        customerComplete:true,destinationComplete:true,raw
      };
      return enrichHanil(result);
    }
    return null;
  }

  root.parseTransportQR=function(text){
    let result=null;
    try{result=originalParseTransportQR(text);}catch(e){}
    if(result&&result.valid){
      if(result.type==='hanil-at'||String(result.raw||text||'').replace(/^[\u0000-\u001f]+/,'').startsWith('CB0010@')){
        return enrichHanil(result);
      }
      return result;
    }
    return structuralHanil(text)||structuralSsangyong(text)||result||{
      valid:false,reason:'운송정보 항목이 없는 QR입니다.',raw:String(text||'')
    };
  };

  root.chooseQrItem=function(q,c){
    if(!q||!['ssangyong-at','hanil-at'].includes(q.type))return originalChooseQrItem(q,c);
    if(q.type==='ssangyong-at'&&!q.item)q.item='3종 BK';
    if(q.type==='hanil-at'&&!q.item)q.item='포틀랜드시멘트(1종)';

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
      if(!c.rates.some(r=>(typeof root.normalizeQrName==='function'?root.normalizeQrName(r.item):String(r.item))===key)){
        c.rates.push({item:q.item,price:0});
      }
      root.save('clients',root.clients||clients);
      root.renderRates(c);
      root.chooseRate(q.item,0);
      root.showQrStatus((q.type==='hanil-at'?'한일 영월':'쌍용 북평')+' QR 인식 완료 · '+q.item+' 등록 · 단가만 확인해주세요');
      return;
    }
    originalChooseQrItem(q,c);
  };

  root.__ssangyongStructuralQR=structuralSsangyong;
  root.__hanilStructuralQR=structuralHanil;
})(window);
