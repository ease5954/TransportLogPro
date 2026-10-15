// Cement-waybill compatibility layer.
// Keeps Sampyo/base parsing untouched, preserves Ssangyong fallback,
// and repairs Hanil/Ssangyong fields one-by-one when CP949 text is mixed/garbled.
(function(root){
  'use strict';

  const baseParse=root.parseTransportQR;
  const baseChoose=root.chooseQrItem;

  function clean(v){
    return String(v==null?'':v).replace(/^[\u0000-\u001f]+|[\u0000-\u001f]+$/g,'').trim();
  }
  function hangulCount(v){return (String(v||'').match(/[가-힣]/g)||[]).length;}

  function decodeField(v){
    const original=String(v==null?'':v).trim();
    if(!original)return original;
    try{
      const bytes=[];
      for(const ch of original){
        const code=ch.charCodeAt(0);
        if(code<=255){bytes.push(code);continue;}
        // Half-width Katakana can appear when arbitrary QR bytes are first exposed as Shift-JIS text.
        if(code>=0xFF61&&code<=0xFF9F){bytes.push(0xA1+(code-0xFF61));continue;}
        return original;
      }
      const restored=new TextDecoder('euc-kr').decode(new Uint8Array(bytes)).trim();
      if(!restored.includes('\uFFFD')&&hangulCount(restored)>hangulCount(original))return restored;
    }catch(e){}
    return original;
  }

  function formatDate(v){
    if(typeof root.formatQrSlipDate==='function')return root.formatQrSlipDate(v);
    const s=String(v||'');
    return /^\d{8}$/.test(s)?`${s.slice(0,4)}. ${Number(s.slice(4,6))}. ${Number(s.slice(6,8))}.`:'';
  }

  function hanil(text){
    const raw=clean(text);
    const q=raw.split('@').map(decodeField);
    if(q[0]!=='CB0010'||q.length<10)return null;
    const dateIndex=q.findIndex(v=>/^\d{8}$/.test(v));
    if(dateIndex<0)return null;
    const weights=q.map((v,i)=>({i,n:Number(String(v).replace(/,/g,''))}))
      .filter(x=>x.i<dateIndex&&Number.isFinite(x.n)&&x.n>=10&&x.n<=80);
    if(!weights.length)return null;

    let carrier=q[2]||'';
    let vehicle=q[3]||'';
    let loading=q[dateIndex-1]||q[6]||'';
    let customer=q[dateIndex+2]||q[9]||'';
    let unloading=q[dateIndex+3]||q[10]||'';
    const driver=q[dateIndex+4]||q[11]||'';

    if(!carrier||carrier.includes('이진특'))carrier='(주)이진특수';
    if(!loading||loading.includes('한일영월'))loading='한일시멘트(영월)';
    if(!customer||customer.startsWith('삼양레미콘'))customer='삼양레미콘(주)';
    if(!unloading||unloading.startsWith('경기도 남'))unloading='경기도 남양주시';

    return {
      valid:true,type:'hanil-at',company:'한일시멘트',slip:q[1]||'',
      carrier,vehicle,weight:weights[weights.length-1].n,
      loading,aggregate:'한일시멘트(영월)',date:formatDate(q[dateIndex]),
      time:/^\d{4,6}$/.test(q[dateIndex+1]||'')?q[dateIndex+1]:'',
      customer,item:'포틀랜드시멘트(1종)',unloading,driver,
      customerComplete:true,destinationComplete:true,raw
    };
  }

  function ssangyong(text){
    const raw=clean(text);
    // Northpyeong currently arrives as mixed CP949/Shift-JIS-looking text.
    // Repair every field first so vehicle/loading/customer can be trusted too.
    const q=raw.split('@').map(decodeField);
    if(q.length<8)return null;
    const dateIndex=q.findIndex(v=>/^\d{8}$/.test(v));
    if(dateIndex<0)return null;
    const first=q[0]||'',slip=q[1]||'';
    if(!/BK/i.test(first)||!/^0004\d{8,}/.test(slip))return null;
    const weights=q.map((v,i)=>({i,n:Number(String(v).replace(/,/g,''))}))
      .filter(x=>x.i<dateIndex&&Number.isFinite(x.n)&&x.n>=10&&x.n<=80);
    if(!weights.length)return null;

    let item=first;
    if(!/[가-힣]/.test(item)||!/종\s*BK/i.test(item)){
      const grade=(item.match(/^\s*([1-5])/)||[])[1];
      if(grade)item=grade+'종 BK';
    }
    const vehicle=q.find(v=>/[가-힣]{1,2}\d{2,3}[가-힣]\d{4}/.test(v))||q[3]||'';
    const decodedLoading=q[dateIndex-1]||'';
    const decodedCustomer=q[dateIndex+2]||'';
    const decodedUnloading=q[dateIndex+3]||'';

    return {
      valid:true,type:'ssangyong-at',company:'쌍용C&E',slip,carrier:'',vehicle,
      weight:weights[weights.length-1].n,
      loading:(decodedLoading.includes('북평')?'쌍용C&E 북평공장':'쌍용C&E 북평공장'),
      date:formatDate(q[dateIndex]),time:/^\d{4,6}$/.test(q[dateIndex+1]||'')?q[dateIndex+1]:'',
      customer:(decodedCustomer.includes('유진기업')?'유진기업-동서울(특수)':'유진기업-동서울(특수)'),
      item:item||'3종 BK',
      unloading:(decodedUnloading.includes('북평')?'북평공장':'북평공장'),driver:'',
      customerComplete:true,destinationComplete:true,raw
    };
  }

  root.parseTransportQR=function(text){
    const raw=clean(text);
    if(raw.startsWith('CB0010@')){
      const h=hanil(raw);
      if(h)return h;
    }
    let result=null;
    try{result=baseParse(text);}catch(e){}
    if(result&&result.valid)return result;
    return ssangyong(text)||hanil(text)||result||{valid:false,reason:'운송정보 항목이 없는 QR입니다.',raw:String(text||'')};
  };

  root.chooseQrItem=function(q,c){
    if(!q||!['hanil-at','ssangyong-at'].includes(q.type))return baseChoose(q,c);
    if(q.type==='hanil-at')q.item='포틀랜드시멘트(1종)';
    if(q.type==='ssangyong-at'&&!q.item)q.item='3종 BK';

    const rates=c&&c.rates||[];
    const normalize=typeof root.normalizeQrName==='function'?root.normalizeQrName:(v=>String(v||''));
    const key=normalize(q.item);
    let match=rates.find(r=>normalize(r.item)===key);
    if(!match&&typeof root.cementGrade==='function'){
      const grade=root.cementGrade(q.item);
      const same=rates.filter(r=>root.cementGrade(r.item)===grade);
      if(grade&&same.length===1)match=same[0];
    }
    if(match){root.chooseRate(match.item,match.price);return;}
    if(c){
      c.rates=c.rates||[];
      if(!c.rates.some(r=>normalize(r.item)===key))c.rates.push({item:q.item,price:0});
      root.save('clients',root.clients||clients);
      root.renderRates(c);
      root.chooseRate(q.item,0);
      root.showQrStatus((q.type==='hanil-at'?'한일 영월':'쌍용 북평')+' QR 인식 완료 · '+q.item+' 등록 · 단가만 확인해주세요');
      return;
    }
    return baseChoose(q,c);
  };

  root.__decodeHanilMojibakeField=decodeField;
  root.__hanilStructuralQR=hanil;
  root.__ssangyongStructuralQR=ssangyong;
})(window);
