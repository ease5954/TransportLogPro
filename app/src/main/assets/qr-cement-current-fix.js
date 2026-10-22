// Current cement QR resilience patch for Sampyo Samcheok and Ssangyong Northpyeong.
(function(root){
  'use strict';
  const prevParse=root.parseTransportQR;
  function clean(v){return String(v==null?'':v).replace(/^[\u0000-\u001f]+|[\u0000-\u001f]+$/g,'').trim();}
  function decodeField(v){
    const s=String(v||'').trim(); if(!s)return s;
    try{const bytes=[];for(const ch of s){const c=ch.charCodeAt(0);if(c<=255)bytes.push(c);else if(c>=0xFF61&&c<=0xFF9F)bytes.push(0xA1+(c-0xFF61));else return s;}const r=new TextDecoder('euc-kr').decode(new Uint8Array(bytes));return /[가-힣]/.test(r)?r:s;}catch(e){return s;}
  }
  function dateFmt(s){const d=String(s||'').replace(/\D/g,'');if(!/^\d{8}$/.test(d))return '';return d.slice(0,4)+'. '+Number(d.slice(4,6))+'. '+Number(d.slice(6,8))+'.';}
  function findWeight(a,dateIndex){const vals=a.map((v,i)=>({i,n:Number(String(v).replace(/,/g,''))})).filter(x=>x.i<dateIndex&&Number.isFinite(x.n)&&x.n>=10&&x.n<=80);return vals.length?vals[vals.length-1].n:0;}
  function vehicleOf(a){return a.find(v=>/[가-힣]{1,2}\d{2,3}[가-힣]\d{4}/.test(v))||a.find(v=>/\d{4}$/.test(v))||'';}
  function enrichSampyo(q,raw){
    if(!q||!q.valid||q.type!=='sampyo-pipe')return q;
    const isSamcheok=String(q.loading||'').includes('삼표시멘트 삼척공장')||clean(raw).startsWith('SA1|');
    if(!isSamcheok)return q;
    if(!q.customer)q.customer='미래해운(주)';
    if(!q.item)q.item='1종시멘트벌크';
    if(!q.loading)q.loading='삼표시멘트 삼척공장';
    if(!q.aggregate)q.aggregate='삼표시멘트 삼척공장';
    if(!q.unloading)q.unloading='미래해운(주)';
    if(!q.carrier)q.carrier='이진상운';
    q.customerComplete=true;q.destinationComplete=true;
    return q;
  }
  function looseSsangyong(raw){
    const r=clean(raw); if(!r.includes('@'))return null;
    const a=r.split('@').map(decodeField);
    const di=a.findIndex(v=>/^\d{8}$/.test(String(v).replace(/\D/g,''))); if(di<0)return null;
    const joined=a.join(' ');
    const first=a[0]||'';
    const looks=/쌍용|북평|\bBK\b|[1-5]\s*종/i.test(joined)||/BK/i.test(first);
    if(!looks)return null;
    const w=findWeight(a,di); if(!w)return null;
    let item=first;
    const grade=(first.match(/([1-5])\s*종?/)||[])[1];
    if(!/[가-힣]/.test(item)||item.length>30)item=grade?grade+'종 BK':'3종 BK';
    if(!/종/.test(item)&&grade)item=grade+'종 BK';
    return {valid:true,type:'ssangyong-at',company:'쌍용C&E',slip:String(a[1]||'').trim(),carrier:'',vehicle:vehicleOf(a),weight:w,
      loading:'쌍용C&E 북평공장',aggregate:'쌍용C&E 북평공장',date:dateFmt(a[di]),time:/^\d{4,6}$/.test(a[di+1]||'')?a[di+1]:'',
      customer:'유진기업-동서울(특수)',item:item||'3종 BK',unloading:'북평공장',driver:'',customerComplete:true,destinationComplete:true,raw:r};
  }
  root.parseTransportQR=function(text){
    let q=null; try{q=prevParse(text);}catch(e){}
    const raw=clean(text);
    if(q&&q.valid){q=enrichSampyo(q,raw);if(q.type==='ssangyong-at')return q;if(q.type==='sampyo-pipe')return q;}
    const sy=looseSsangyong(raw); if(sy)return sy;
    return q||{valid:false,reason:'운송정보 항목이 없는 QR입니다.',raw};
  };

  // Final form repair after every successful scan.
  const prevApply=root.applyQR;
  if(typeof prevApply==='function')root.applyQR=function(text){
    const ok=prevApply(text);
    try{
      const q=root.parseTransportQR(text);
      if(q&&q.valid&&q.type==='sampyo-pipe'){
        const sel=document.getElementById('regClient');
        let c=null; try{c=(clients||[]).find(x=>String(x.id)===String(sel&&sel.value||''))||null;}catch(e){}
        if(!c&&typeof root.ensureQrClient==='function'){c=root.ensureQrClient(q);if(c&&typeof root.fillClients==='function')root.fillClients();if(c&&sel)sel.value=String(c.id);}
        if(c&&typeof root.applyClient==='function')root.applyClient();
        if(typeof root.chooseQrItem==='function')root.chooseQrItem(q,c);
        const set=(id,v)=>{const e=document.getElementById(id);if(e&&v)e.value=String(v);};
        set('regLoading',q.loading);set('regUnloading',q.unloading);set('regAggregate',q.aggregate);set('regTransport',q.carrier);set('regVehicle',q.vehicle);set('regWeight',Number(q.weight||0).toFixed(2));
        if(typeof root.__applySavedRateAfterQr==='function')root.__applySavedRateAfterQr(q);
        if(typeof root.calcFreight==='function')root.calcFreight();
      }
    }catch(e){}
    return ok;
  };
})(window);
