// Cement-waybill compatibility layer.
// Keeps Sampyo/base parsing untouched and adds structural fallbacks for
// Hanil Yeongwol, Ssangyong Northpyeong, Halla Cement, and SP Nature waybills.
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
    const s=String(v||'').replace(/\D/g,'');
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

  const SP_NATURE_QR={
    plant:{U02:'(주)에스피네이처 천안슬래그공장'},
    customer:{'2140620000':'미래해운(주)'},
    destination:{'2140620000':'미래해운(주)_동해부(강릉)_천안SP'},
    item:{'1A3010102':'고로슬래그 미분말'},
    vehicle:{'6610':'충북99바6610'}
  };

  function spNature(text){
    const raw=clean(text);
    const p=raw.split('|').map(v=>String(v||'').trim());
    if(p[0]!=='U02'||p.length<9)return null;
    const date=formatDate(p[1]);
    const kg=Number(String(p[8]||'').replace(/,/g,''));
    if(!date||!Number.isFinite(kg)||kg<=0)return {valid:false,reason:'에스피네이처 운송장의 납품량을 확인할 수 없습니다.',raw};
    const suffix=p[3]||'';
    let vehicle='';
    if(typeof root.resolveQrVehicle==='function')vehicle=root.resolveQrVehicle(suffix)||'';
    if(!vehicle)vehicle=SP_NATURE_QR.vehicle[suffix]||suffix;
    const customer=SP_NATURE_QR.customer[p[4]]||'';
    const unloading=SP_NATURE_QR.destination[p[4]]||'';
    const item=SP_NATURE_QR.item[p[6]]||'고로슬래그 미분말';
    return {
      valid:true,type:'spnature-pipe',company:'에스피네이처',date,
      time:/^\d{6}$/.test(p[2]||'')?String(p[2]).slice(0,4):String(p[2]||'').slice(0,4),
      vehicle,customer,customerCode:p[4]||'',unloading,
      item,itemCode:p[6]||'',slip:p[7]||'',weight:kg/1000,round:p[9]||'',
      loading:SP_NATURE_QR.plant[p[0]]||'(주)에스피네이처 천안슬래그공장',
      aggregate:SP_NATURE_QR.plant[p[0]]||'(주)에스피네이처 천안슬래그공장',
      price:0,carrier:'',customerComplete:Boolean(customer),destinationComplete:Boolean(unloading),raw
    };
  }

  function labelValue(text,labels){
    const escaped=labels.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    const re=new RegExp('(?:'+escaped+')\\s*[:=]?\\s*([^@|;\\n\\r]+)','i');
    const m=String(text||'').match(re);
    return m?clean(m[1]):'';
  }

  function pickNetWeight(text){
    const direct=String(text||'').match(/(?:실중량|순중량|NET(?:\s*WEIGHT)?)\s*[:=]?\s*(\d{1,2}(?:\.\d{1,3})?)/i);
    if(direct){const n=Number(direct[1]);if(n>=10&&n<=80)return n;}
    const nums=(String(text||'').match(/\b\d{1,2}\.\d{1,3}\b/g)||[])
      .map(Number).filter(n=>Number.isFinite(n)&&n>=10&&n<=80);
    for(let i=0;i<nums.length;i++)for(let j=0;j<nums.length;j++){
      if(i===j)continue;
      const diff=Math.abs(nums[i]-nums[j]);
      for(let k=0;k<nums.length;k++){
        if(k===i||k===j)continue;
        if(nums[k]>=15&&nums[k]<=45&&Math.abs(diff-nums[k])<=0.08)return nums[k];
      }
    }
    const likely=nums.filter(n=>n>=20&&n<=35);
    if(likely.length)return likely[likely.length-1];
    return nums.length?nums[nums.length-1]:0;
  }

  function halla(text){
    const raw=clean(text);
    if(!raw)return null;
    const repaired=raw.split(/(@|\||;|\n|\r)/).map(part=>/^(?:@|\||;|\n|\r)$/.test(part)?part:decodeField(part)).join('');
    if(/CB0010@/i.test(repaired)||/\bBK\b/i.test(repaired)||repaired.startsWith('U02|'))return null;

    const vehicle=(repaired.match(/[가-힣]{1,2}\d{2,3}[가-힣]\d{4}/)||[])[0]||'';
    const dateMatch=(repaired.match(/20\d{2}[-./]?\d{2}[-./]?\d{2}/)||[])[0]||'';
    const dateDigits=dateMatch.replace(/\D/g,'');
    const weight=pickNetWeight(repaired);
    const explicitHalla=/(?:한라시멘트|HALLA\s*CEMENT|HALLA)|(?:P\s*\/?\s*C\s*BULK)|(?:포틀랜드\s*시멘트\s*1종)/i.test(repaired);
    const slipCandidates=(repaired.match(/\b\d{9,12}\b/g)||[]).filter(v=>v!==dateDigits);
    const slip=(labelValue(repaired,['반출증 No','반출증번호','반출증','전표번호','출하번호']).match(/\d{6,14}/)||[])[0]||slipCandidates[0]||'';
    const structural=Boolean(vehicle&&dateDigits&&weight&&slip);
    if(!explicitHalla&&!structural)return null;

    const customer=labelValue(repaired,['거래처명','거래처','판매처','고객사'])||
      ((repaired.match(/[^@|;\n\r]{0,20}(?:미래해운|[가-힣A-Za-z0-9]+\s*(?:주식회사|\(주\)))[^@|;\n\r]{0,20}/)||[])[0]||'');
    const carrier=labelValue(repaired,['운송업체','운송사명','운송사'])||(/미래해운/.test(repaired)?'미래해운(주)':'');
    const unloading=labelValue(repaired,['하차지','도착지','납품처','현장명']);
    const driver=labelValue(repaired,['기사성명','기사명','운전기사','기사']);
    const timeMatch=(repaired.match(/(?:^|[^\d])([01]\d|2[0-3]):([0-5]\d)(?!\d)/)||[]);
    const time=timeMatch.length>=3?timeMatch[1]+timeMatch[2]:'';

    return {
      valid:true,type:'halla-port',company:'한라시멘트',slip,
      carrier,vehicle,weight,
      loading:'한라시멘트 항만공장',aggregate:'한라시멘트 항만공장',
      date:formatDate(dateDigits),time,
      customer:clean(customer),item:'포틀랜드시멘트(1종)',unloading:clean(unloading),driver:clean(driver),
      customerComplete:Boolean(clean(customer)),destinationComplete:Boolean(clean(unloading)),raw:repaired
    };
  }

  root.parseTransportQR=function(text){
    const raw=clean(text);
    const sp=spNature(raw);if(sp)return sp;
    if(raw.startsWith('CB0010@')){
      const h=hanil(raw);
      if(h)return h;
    }
    let result=null;
    try{result=baseParse(text);}catch(e){}
    if(result&&result.valid)return result;
    return ssangyong(text)||hanil(text)||halla(text)||result||{valid:false,reason:'운송정보 항목이 없는 QR입니다.',raw:String(text||'')};
  };

  // Always show the currently selected/decoded product on the registration form.
  function ensureProductDisplay(){
    if(document.getElementById('regItemDisplay'))return document.getElementById('regItemDisplay');
    const client=document.getElementById('regClient');
    const choices=document.getElementById('rateChoices');
    if(!client||!choices||!client.parentNode)return null;
    const wrap=document.createElement('div');
    wrap.id='regItemDisplayWrap';
    wrap.style.marginTop='12px';
    const label=document.createElement('label');
    label.className='label';
    label.textContent='제품명(품목)';
    const input=document.createElement('input');
    input.id='regItemDisplay';
    input.className='input';
    input.readOnly=true;
    input.placeholder='QR 스캔 또는 물품을 선택하세요';
    wrap.appendChild(label);
    wrap.appendChild(input);
    client.parentNode.insertBefore(wrap,choices);
    return input;
  }
  function syncProductDisplay(item){
    const input=ensureProductDisplay();
    if(input)input.value=String(item==null?'':item);
  }

  const baseChooseRate=root.chooseRate;
  root.chooseRate=function(item,price){
    const result=baseChooseRate(item,price);
    syncProductDisplay(item||root.regItem||'');
    return result;
  };

  const baseApplyClient=root.applyClient;
  root.applyClient=function(){
    root.regItem='';
    syncProductDisplay('');
    return baseApplyClient();
  };

  root.chooseQrItem=function(q,c){
    if(!q||!['hanil-at','ssangyong-at','halla-port','spnature-pipe'].includes(q.type)){
      const result=baseChoose(q,c);
      syncProductDisplay(root.regItem||q&&q.item||'');
      return result;
    }
    if(q.type==='hanil-at'||q.type==='halla-port')q.item='포틀랜드시멘트(1종)';
    if(q.type==='ssangyong-at'&&!q.item)q.item='3종 BK';
    if(q.type==='spnature-pipe'&&!q.item)q.item='고로슬래그 미분말';

    const rates=c&&c.rates||[];
    const normalize=typeof root.normalizeQrName==='function'?root.normalizeQrName:(v=>String(v||''));
    const key=normalize(q.item);
    let match=rates.find(r=>normalize(r.item)===key);
    if(!match&&typeof root.cementGrade==='function'){
      const grade=root.cementGrade(q.item);
      const same=rates.filter(r=>root.cementGrade(r.item)===grade);
      if(grade&&same.length===1)match=same[0];
    }
    if(match){root.chooseRate(match.item,match.price);syncProductDisplay(match.item);return;}
    if(c){
      c.rates=c.rates||[];
      if(!c.rates.some(r=>normalize(r.item)===key))c.rates.push({item:q.item,price:0});
      root.save('clients',root.clients||clients);
      root.renderRates(c);
      root.chooseRate(q.item,0);
      syncProductDisplay(q.item);
      const name=q.type==='hanil-at'?'한일 영월':q.type==='ssangyong-at'?'쌍용 북평':q.type==='halla-port'?'한라 항만':'에스피네이처';
      root.showQrStatus(name+' QR 인식 완료 · '+q.item+' 등록 · 단가만 확인해주세요');
      return;
    }
    const result=baseChoose(q,c);
    root.regItem=q.item||root.regItem||'';
    syncProductDisplay(root.regItem);
    return result;
  };

  const baseApplyQR=root.applyQR;
  root.applyQR=function(text){
    const result=baseApplyQR(text);
    syncProductDisplay(root.regItem||'');
    return result;
  };

  const baseSaveTransport=root.saveTransport;
  root.saveTransport=function(){
    const result=baseSaveTransport();
    if(!root.regItem)syncProductDisplay('');
    return result;
  };

  ensureProductDisplay();
  syncProductDisplay(root.regItem||'');

  root.__decodeHanilMojibakeField=decodeField;
  root.__hanilStructuralQR=hanil;
  root.__ssangyongStructuralQR=ssangyong;
  root.__hallaStructuralQR=halla;
  root.__spNatureStructuralQR=spNature;
})(window);