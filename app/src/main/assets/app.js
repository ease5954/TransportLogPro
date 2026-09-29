const KEY='transport_pro_android_v2';
let clients=load('clients',[]),logs=load('logs',[]),expenses=load('expenses',[]),historyFilter='all',qrScanner=null;
const $=id=>document.getElementById(id), fmt=n=>Number(n||0).toLocaleString('ko-KR');
function load(k,d){try{const v=JSON.parse(localStorage.getItem(KEY+'_'+k)||'null');return v??d}catch(e){return d}}
function save(k,v){localStorage.setItem(KEY+'_'+k,JSON.stringify(v))}
function todayText(){return new Date().toLocaleDateString('ko-KR')}
function monthKey(v){const m=String(v||'').match(/(\d{4})\D+(\d{1,2})/);return m?m[1]+'-'+String(Number(m[2])).padStart(2,'0'):''}
function currentMonth(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');clearTimeout(window._tt);window._tt=setTimeout(()=>e.classList.remove('show'),2200)}
function toggleDrawer(){ $('drawer').classList.toggle('show') }
function drawerGo(id){$('drawer').classList.remove('show');go(id)}
function go(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));const s=$(id);if(s)s.classList.add('active');document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.nav===id));window.scrollTo(0,0);renderAll()}
function renderAll(){renderHome();renderClients();renderHistory();renderExpenses();renderSettlement();fillClients()}
function renderHome(){const td=todayText(),today=logs.filter(x=>x.date===td),mk=currentMonth(),mon=logs.filter(x=>monthKey(x.date)===mk);$('todayLabel').textContent=td;$('homeTrips').textContent=today.length+'건';$('homeWeight').textContent=fmt(today.reduce((a,x)=>a+Number(x.weight||0),0))+'톤';$('homeFreight').textContent=fmt(today.reduce((a,x)=>a+Number(x.freight||0),0))+'원';$('homeMonth').textContent=fmt(mon.reduce((a,x)=>a+Number(x.freight||0),0))+'원'}
function syncNewLoading(){const n=$('newClientName').value.trim();if(!$('newClientLoading').dataset.manual)$('newClientLoading').value=n}
$('newClientLoading').addEventListener('input',()=>newClientLoading.dataset.manual='1');
function addClient(){const name=$('newClientName').value.trim();if(!name){toast('거래처명을 입력해주세요');return}let c=clients.find(x=>x.name===name);const loading=$('newClientLoading').value.trim()||name,transport=$('newClientTransport').value.trim(),item=$('newClientItem').value.trim(),price=Number(String($('newClientPrice').value||0).replace(/,/g,''))||0;if(!c){c={id:Date.now(),name,loading,transport,rates:[]};clients.push(c)}else{c.loading=loading;c.transport=transport||c.transport}if(item){const r=c.rates.find(x=>x.item===item);if(r)r.price=price;else c.rates.push({item,price})}save('clients',clients);['newClientName','newClientLoading','newClientTransport','newClientItem','newClientPrice'].forEach(id=>$(id).value='');delete $('newClientLoading').dataset.manual;renderAll();toast('✓ 거래처 저장 완료')}
function renderClients(){const el=$('clientList');if(!clients.length){el.innerHTML='<div class="empty">등록된 거래처가 없습니다.</div>';return}el.innerHTML=clients.map(c=>`<div class="card"><div class="listtop"><span>거래처</span><button style="border:0;background:none;color:#d33" onclick="deleteClient(${c.id})">삭제</button></div><div class="listtitle">${esc(c.name)}</div><div class="hint">상차지 ${esc(c.loading||c.name)} · 운송사 ${esc(c.transport||'-')}</div><div style="margin-top:9px">${(c.rates||[]).map((r,i)=>`<div class="listinfo" style="padding:6px 0"><span>${esc(r.item)}</span><span class="amt">${fmt(r.price)}원/톤 <button style="border:0;background:none;color:#d33" onclick="deleteRate(${c.id},${i})">×</button></span></div>`).join('')||'<div class="hint">등록된 물품 없음</div>'}</div><button class="btn secondary" style="margin-top:8px" onclick="openRateModal(${c.id})">＋ 물품/단가 추가</button></div>`).join('')}
function deleteClient(id){clients=clients.filter(x=>x.id!==id);save('clients',clients);renderAll()}
function openRateModal(id){$('rateClientId').value=id;$('rateItem').value='';$('ratePrice').value='';$('rateModal').classList.add('show')}
function closeRateModal(){$('rateModal').classList.remove('show')}
function saveRate(){const c=clients.find(x=>x.id===Number($('rateClientId').value)),item=$('rateItem').value.trim(),price=Number(String($('ratePrice').value||0).replace(/,/g,''))||0;if(!c||!item){toast('물품명을 입력해주세요');return}const r=(c.rates||[]).find(x=>x.item===item);if(r)r.price=price;else(c.rates||(c.rates=[])).push({item,price});save('clients',clients);closeRateModal();renderAll()}
function deleteRate(id,i){const c=clients.find(x=>x.id===id);if(!c)return;c.rates.splice(i,1);save('clients',clients);renderAll()}
function fillClients(){const el=$('regClient'),old=el.value;el.innerHTML='<option value="">거래처 선택</option>'+clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');if(clients.some(c=>String(c.id)===old))el.value=old}
function applyClient(){const c=clients.find(x=>String(x.id)===$('regClient').value);$('rateChoices').innerHTML='';if(!c)return;$('regLoading').value=c.loading||c.name;$('regUnloading').value='';$('regAggregate').value=c.loading||c.name;$('regTransport').value=c.transport||'';renderRates(c);if((c.rates||[]).length===1)chooseRate(c.rates[0].item,c.rates[0].price)}
function renderRates(c){$('rateChoices').innerHTML=(c.rates||[]).map(r=>`<button class="choice" data-item="${encodeURIComponent(r.item)}" onclick="chooseRate(decodeURIComponent('${encodeURIComponent(r.item)}'),${Number(r.price||0)})">${esc(r.item)}<small>${fmt(r.price)}원/톤</small></button>`).join('')||'<div class="hint">등록된 물품이 없습니다. 거래처 관리에서 추가해주세요.</div>'}
function chooseRate(item,price){window.regItem=item;$('regPrice').value=price;document.querySelectorAll('.choice').forEach(x=>x.classList.toggle('active',decodeURIComponent(x.dataset.item||'')===item));calcFreight()}
function calcFreight(){const f=Math.round(Number($('regWeight').value||0)*Number($('regPrice').value||0));$('regFreight').textContent=fmt(f)+'원'}
function saveTransport(){const c=clients.find(x=>String(x.id)===$('regClient').value);if(!c){toast('거래처를 선택해주세요');return}const w=Number($('regWeight').value||0);if(w<=0){toast('중량을 입력해주세요');return}const p=Number(String($('regPrice').value||0).replace(/,/g,''))||0;const data={id:Date.now(),date:window.pendingQrMeta&&window.pendingQrMeta.date||todayText(),client:c.name,item:window.regItem||'',weight:w,price:p,freight:Math.round(w*p),loading:$('regLoading').value.trim(),unloading:$('regUnloading').value.trim(),aggregate:$('regAggregate').value.trim(),transport:$('regTransport').value.trim(),vehicle:$('regVehicle').value.trim()};logs.push(data);if(data.loading)c.loading=data.loading;if(data.item&&p>0){const r=(c.rates||[]).find(x=>x.item===data.item);if(r)r.price=p}save('logs',logs);save('clients',clients);$('regWeight').value='';$('regFreight').textContent='0원';window.regItem='';window.pendingQrMeta=null;const qrNotice=$('regQrNotice');if(qrNotice)qrNotice.style.display='none';toast('✓ 운송일보 저장 완료');go('history')}
function setHistoryFilter(f,b){historyFilter=f;document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('historyMonth').style.display=f==='month'?'block':'none';renderHistory()}
function filteredLogs(){if(historyFilter==='today')return logs.filter(x=>x.date===todayText());if(historyFilter==='month'){const m=$('historyMonth').value||currentMonth();return logs.filter(x=>monthKey(x.date)===m)}return logs.slice()}
function renderHistory(){const a=filteredLogs().sort((x,y)=>y.id-x.id);$('histTrips').textContent=a.length+'건';$('histWeight').textContent=fmt(a.reduce((s,x)=>s+Number(x.weight||0),0))+'톤';$('histFreight').textContent=fmt(a.reduce((s,x)=>s+Number(x.freight||0),0))+'원';$('historyList').innerHTML=a.length?a.map(x=>`<div class="list"><div class="listtop"><span>${esc(x.date)}</span><span>${esc(x.vehicle||'')}</span></div><div class="listtitle">${esc(x.client)} · ${esc(x.item||'-')}</div><div class="listinfo"><span>${esc(x.loading||'-')} → ${esc(x.unloading||'-')}</span><span class="amt">${fmt(x.freight)}원</span></div><div class="listinfo" style="margin-top:6px"><span>${fmt(x.weight)}톤 · ${fmt(x.price)}원/톤</span><button style="border:0;background:none;color:#d33" onclick="deleteLog(${x.id})">삭제</button></div></div>`).join(''):'<div class="empty">운송내역이 없습니다.</div>'}
function deleteLog(id){logs=logs.filter(x=>x.id!==id);save('logs',logs);renderAll()}
function addExpense(){const amount=Number(String($('expAmount').value||0).replace(/,/g,''));if(amount<=0){toast('금액을 입력해주세요');return}expenses.push({id:Date.now(),date:todayText(),type:$('expType').value,amount,item:$('expItem').value.trim(),vehicle:$('expVehicle').value.trim()});save('expenses',expenses);$('expAmount').value='';$('expItem').value='';renderAll();toast('✓ 저장 완료')}
function renderExpenses(){$('expenseList').innerHTML=expenses.slice().sort((a,b)=>b.id-a.id).map(x=>`<div class="list"><div class="listtop"><span>${esc(x.date)}</span><span>${esc(x.type)}</span></div><div class="listtitle">${esc(x.item||x.type)}</div><div class="listinfo"><span>${esc(x.vehicle||'')}</span><span class="amt">${fmt(x.amount)}원</span></div></div>`).join('')}
function renderSettlement(){const m=$('settlementMonth').value||currentMonth(),ls=logs.filter(x=>monthKey(x.date)===m),es=expenses.filter(x=>monthKey(x.date)===m),income=ls.reduce((a,x)=>a+Number(x.freight||0),0),cost=es.reduce((a,x)=>a+Number(x.amount||0),0);$('setIncome').textContent=fmt(income)+'원';$('setExpense').textContent=fmt(cost)+'원';$('setProfit').textContent=fmt(income-cost)+'원';$('setTrips').textContent=ls.length+'건';$('setWeight').textContent=fmt(ls.reduce((a,x)=>a+Number(x.weight||0),0))+'톤'}
const insurers=[['삼성화재','1588-5114','자동차 사고접수 24시간'],['현대해상','1588-5656','ARS 2번 사고접수'],['DB손해보험','1588-0100','자동차 사고접수'],['KB손해보험','1544-0114','ARS 1번 자동차 사고접수'],['메리츠화재','1566-7711','사고접수/긴급출동'],['한화손해보험','1566-8000','대표 사고접수'],['롯데손해보험','1588-3344','자동차 사고접수'],['흥국화재','1688-1688','ARS 1번 자동차 사고접수'],['AXA손해보험','1566-1566','ARS 3번 사고접수'],['하나손해보험','1566-3000','사고접수/긴급출동'],['KTA 화물공제','1577-8278','화물공제 사고접수']];
function openInsurance(fromDrawer){if(fromDrawer)$('drawer').classList.remove('show');$('insuranceList').innerHTML=insurers.map(x=>`<div class="card phone"><div><b>${x[0]}</b><div class="hint" style="margin-top:5px">${x[1]} · ${x[2]}</div></div><a href="tel:${x[1]}">📞 전화</a></div>`).join('');$('insurance').classList.add('show');$('insurance').scrollTop=0}
function closeInsurance(){$('insurance').classList.remove('show')}
function showAppInfo(fromDrawer){if(fromDrawer)$('drawer').classList.remove('show');$('appInfo').classList.add('show');$('appInfo').scrollTop=0}
function closeAppInfo(){$('appInfo').classList.remove('show')}
function showQrStatus(message){const el=$('qrStatus');if(el)el.textContent=String(message||'');}
function startQRFallback(){
  if(window.AndroidBridge&&typeof window.AndroidBridge.startNativeQrFallbackScan==='function'){
    try{showQrStatus('보조 QR 카메라를 여는 중입니다.');window.AndroidBridge.startNativeQrFallbackScan();return}
    catch(e){showQrStatus('보조 QR 카메라 실행 실패: '+String(e));}
  }
  startQR();
}
function startQR(){if(window.AndroidBridge&&typeof window.AndroidBridge.startNativeQrScan==='function'){try{window.AndroidBridge.startNativeQrScan();return}catch(e){toast('QR 카메라 실행에 실패했습니다');return}}if(!window.Html5Qrcode){toast('QR 모듈을 불러오지 못했습니다');return}if(qrScanner&&qrScanner.isScanning)return;qrScanner=new Html5Qrcode('qr-reader');qrScanner.start({facingMode:'environment'},{fps:10,qrbox:{width:230,height:230}},text=>{qrScanner.stop().catch(()=>{});applyQR(text)},()=>{}).catch(e=>toast('카메라 권한을 허용해주세요'))}
function startQRPhoto(){if(window.AndroidBridge&&typeof window.AndroidBridge.startNativeQrPhotoScan==='function'){try{window.AndroidBridge.startNativeQrPhotoScan();return}catch(e){toast('QR 사진 선택을 열지 못했습니다');return}}const input=$('qrPhoto');if(input)input.click()}
async function scanPhoto(e){const f=e.target.files&&e.target.files[0];if(!f)return;try{const q=new Html5Qrcode('qr-reader'),text=await q.scanFile(f,true);applyQR(text)}catch(err){toast('QR을 인식하지 못했습니다')}finally{e.target.value=''}}
function normalizeQrName(v){return String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase();}
function formatQrSlipDate(s){const t=String(s||'');if(!/^\d{8}$/.test(t))return '';const y=Number(t.slice(0,4)),m=Number(t.slice(4,6)),d=Number(t.slice(6,8));const check=new Date(y,m-1,d);return check.getFullYear()===y&&check.getMonth()===m-1&&check.getDate()===d?y+'. '+m+'. '+d+'.':'';}
function repairQrText(value){
 const original=String(value??'');
 if(/[가-힣]/.test(original)||(!original.includes('@')&&!original.includes('|')))return original;
 try{
   const bytes=[];
   for(const ch of original){
     const code=ch.charCodeAt(0);
     if(code<=255)bytes.push(code);
     else if(code>=0xFF61&&code<=0xFF9F)bytes.push(0xA1+(code-0xFF61));
     else return original;
   }
   const restored=new TextDecoder('euc-kr').decode(new Uint8Array(bytes));
   if(/[가-힣]/.test(restored)&&(restored.includes('@')||restored.includes('|')))return restored;
 }catch(e){}
 return original;
}
function canonicalAtPlant(v){const n=String(v||'').trim();if(n==='한일영월')return '한일시멘트(영월)';if(n==='쌍용북평')return '쌍용C&E 북평공장';return n;}
function canonicalAtCarrier(v){const n=String(v||'').trim();if(n==='(주)이진특')return '(주)이진특수';return n;}
function canonicalAtCustomer(v){
 const n=String(v||'').trim();
 if(n==='삼양레미콘(')return '삼양레미콘(주)';
 if(n==='유진기업-동서울')return '유진기업-동서울(특수)';
 return n;
}
function canonicalAtDestination(customer,v){
 const n=String(v||'').trim();
 if(customer==='삼양레미콘(주)'&&n.startsWith('경기도 남'))return '경기도 남양주시';
 return n;
}
function parseAtWaybill(raw){
 const q=raw.split('@').map(x=>String(x||'').trim());
 if(q.length<8)return null;
 const dateIndex=q.findIndex(x=>/^\d{8}$/.test(x));
 if(dateIndex<0)return null;
 const weightCandidates=q.map((v,i)=>({i,n:Number(v.replace(/,/g,''))}))
   .filter(x=>Number.isFinite(x.n)&&x.n>=10&&x.n<=80&&x.i<dateIndex);
 if(!weightCandidates.length)return null;
 const weightEntry=weightCandidates[weightCandidates.length-1];
 const w=weightEntry.n,date=formatQrSlipDate(q[dateIndex]);
 if(!date)return null;
 const time=q[dateIndex+1]&&/^\d{4,6}$/.test(q[dateIndex+1])?q[dateIndex+1]:'';
 const vehicle=q.find(v=>/[가-힣]{1,2}\d{2,3}[가-힣]\d{4}/.test(v))||q[3]||'';
 const plantRaw=q[dateIndex-1]||q[6]||'';
 const customerRaw=q[dateIndex+2]||q[9]||'';
 const destinationRaw=q[dateIndex+3]||q[10]||'';
 const productRaw=q[0]||'';
 const isHanil=productRaw==='CB0010';
 const isSsangyong=!isHanil&&(productRaw.includes('종')||plantRaw.includes('쌍용')||destinationRaw.includes('북평'));
 if(!isHanil&&!isSsangyong)return null;
 const customer=canonicalAtCustomer(customerRaw);
 return {valid:true,type:isHanil?'hanil-at':'ssangyong-at',company:isHanil?'한일시멘트':'쌍용C&E',
   slip:String(q[1]||'').trim(),carrier:canonicalAtCarrier(q[2]),vehicle,
   weight:w,loading:canonicalAtPlant(plantRaw),date,time,
   customer,item:isHanil?'':productRaw,
   unloading:canonicalAtDestination(customer,destinationRaw),driver:String(q[dateIndex+4]||q[11]||'').trim(),
   customerComplete:customer==='삼양레미콘(주)'||customer==='유진기업-동서울(특수)'||(!customer.endsWith('(')&&customer.length>=4),
   destinationComplete:isHanil?customer==='삼양레미콘(주)'&&destinationRaw.startsWith('경기도 남'):Boolean(destinationRaw),
   raw};
}
const SAMPYO_QR={
 plant:{SA1:'삼표시멘트 삼척공장'},
 customer:{'1150850000':'미래해운(주)'},
 site:{'1708120081':'미래해운(주)/(주)짜콘'},
 item:{'10000001':'1종시멘트벌크'},
 vehicle:{'6610':'충북99바6610'}
};
function resolveQrVehicle(suffix){
 const raw=String(suffix||'').trim();if(!raw)return '';
 const full=[...new Set(logs.map(x=>String(x.vehicle||'').trim()).filter(v=>v&&v.endsWith(raw)))];
 if(full.length===1)return full[0];
 const current=$('regVehicle')&&$('regVehicle').value.trim();
 if(current&&current.endsWith(raw))return current;
 return SAMPYO_QR.vehicle[raw]||raw;
}
function parseSampyoWaybill(raw){
 const p=raw.split('|').map(x=>String(x||'').trim());
 if(p[0]!=='SA1'||p.length<9)return null;
 const date=formatQrSlipDate(p[1]);
 const kg=Number(p[8]);
 if(!date||!Number.isFinite(kg)||kg<=0)return {valid:false,reason:'삼표 운송장의 실중량을 확인할 수 없습니다.',raw};
 return {valid:true,type:'sampyo-pipe',company:'삼표시멘트',date,time:String(p[2]||'').slice(0,4),
   vehicle:resolveQrVehicle(p[3]),customer:SAMPYO_QR.customer[p[4]]||'',customerCode:p[4]||'',
   unloading:SAMPYO_QR.site[p[5]]||'',siteCode:p[5]||'',item:SAMPYO_QR.item[p[6]]||'',itemCode:p[6]||'',
   slip:p[7]||'',weight:kg/1000,round:p[9]||'',loading:SAMPYO_QR.plant[p[0]]||'삼표시멘트',
   carrier:'',customerComplete:Boolean(SAMPYO_QR.customer[p[4]]),destinationComplete:Boolean(SAMPYO_QR.site[p[5]]),raw};
}
function parseTransportQR(text){
 const raw=repairQrText(text).replace(/^[\u0000-\u001f]+|[\u0000-\u001f]+$/g,'').trim();
 const sampyo=parseSampyoWaybill(raw);if(sampyo)return sampyo;
 const at=parseAtWaybill(raw);if(at)return at;
 let d={};
 try{const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))d=parsed.data&&typeof parsed.data==='object'?{...parsed,...parsed.data}:parsed;}
 catch(e){raw.split(/[;,\n|]+/).forEach(line=>{const m=line.match(/^([^:=]+)[:=](.+)$/);if(m)d[m[1].trim()]=m[2].trim();});}
 const get=(...keys)=>{for(const k of keys)if(d[k]!=null&&d[k]!=='')return String(d[k]).trim();return '';};
 const mapped={valid:true,type:'fields',company:'기타',customer:get('거래처','거래처명','client','customer'),item:get('품목','물품','item'),loading:get('상차지','loading'),unloading:get('하차지','unloading'),aggregate:get('양회사','aggregate'),carrier:get('운송사','transport'),vehicle:get('차량번호','vehicle'),weight:Number(get('실질량','실중량','중량','weight').replace(/[^\d.]/g,''))||0,price:Number(get('단가','price').replace(/,/g,''))||0,date:formatQrSlipDate(get('출하일자','출하일','date').replace(/[^\d]/g,'')),customerComplete:true,destinationComplete:true,raw};
 if(!Object.entries(mapped).some(([k,v])=>!['valid','type','raw','company','customerComplete','destinationComplete'].includes(k)&&Boolean(v)))return {valid:false,reason:'운송정보 항목이 없는 QR입니다.',raw};
 return mapped;
}
function matchQrClient(fragment){
 const key=normalizeQrName(fragment);if(!key)return null;
 const exact=clients.filter(c=>normalizeQrName(c.name)===key);if(exact.length===1)return exact[0];
 if(key.length>=4){const prefix=clients.filter(c=>normalizeQrName(c.name).startsWith(key)||key.startsWith(normalizeQrName(c.name)));if(prefix.length===1)return prefix[0];}
 return null;
}
function ensureQrClient(q){
 let c=matchQrClient(q.customer);
 if(!c&&q.customer&&q.customerComplete){
   c={id:Date.now(),name:q.customer,loading:q.loading||q.customer,transport:q.carrier||'',rates:[]};
   clients.push(c);save('clients',clients);
 }
 return c;
}
function cementGrade(item){const m=String(item||'').match(/([1-5])\s*종/);return m?m[1]:'';}
function chooseQrItem(q,c){
 if(!q.item)return;
 const rates=c&&c.rates||[],key=normalizeQrName(q.item);
 let match=rates.find(r=>normalizeQrName(r.item)===key)
   ||rates.find(r=>normalizeQrName(r.item).includes(key)||key.includes(normalizeQrName(r.item)));
 if(!match){
   const grade=cementGrade(q.item);
   if(grade){
     const sameGrade=rates.filter(r=>cementGrade(r.item)===grade);
     if(sameGrade.length===1)match=sameGrade[0];
   }
 }
 if(match){chooseRate(match.item,match.price);return;}
 window.regItem=q.item;
 // Do not erase a saved client price merely because the QR itself has no price field.
 if(q.price)$('regPrice').value=q.price;
}
function qrFieldNotice(q,client){
 const missing=[];
 if(!client)missing.push('거래처 확인');
 if(!q.destinationComplete)missing.push('하차지 확인');
 if(!window.regItem)missing.push('품목 선택');
 if(!Number($('regPrice').value))missing.push('단가 확인');
 return missing;
}
function applyQR(text){
 const q=parseTransportQR(text),resultBox=$('qrResult'),notice=$('regQrNotice');
 if(!q.valid){
   if(resultBox){resultBox.style.display='block';resultBox.textContent='QR은 읽었지만 자동 입력할 수 없습니다. '+q.reason+'\n읽힌 내용: '+q.raw.slice(0,600);}
   toast(q.reason);return false;
 }
 if(resultBox){resultBox.style.display='none';resultBox.textContent='';}
 const c=ensureQrClient(q);
 if(c){fillClients();$('regClient').value=c.id;applyClient();}
 else {$('regClient').value='';$('rateChoices').innerHTML='';$('regLoading').value='';$('regUnloading').value='';$('regAggregate').value='';$('regTransport').value='';$('regPrice').value='';window.regItem='';}
 go('register');
 if(c){fillClients();$('regClient').value=c.id;applyClient();}
 if(q.loading)$('regLoading').value=q.loading;
 if(q.unloading&&q.destinationComplete)$('regUnloading').value=q.unloading;
 else if(q.unloading){$('regUnloading').value='';$('regUnloading').placeholder='QR 값: '+q.unloading+' · 전체 하차지 확인';}
 if(q.aggregate)$('regAggregate').value=q.aggregate;
 if(q.carrier)$('regTransport').value=q.carrier;
 if(q.vehicle)$('regVehicle').value=q.vehicle;
 chooseQrItem(q,c);
 if(q.price)$('regPrice').value=q.price;
 if(q.weight)$('regWeight').value=Number(q.weight.toFixed(3));
 window.pendingQrMeta={date:q.date||'',slip:q.slip||'',time:q.time||'',driver:q.driver||'',company:q.company||'',qrCustomer:q.customer||'',qrDestination:q.unloading||''};
 calcFreight();
 const missing=qrFieldNotice(q,c);
 if(notice){
   notice.style.display='block';
   notice.textContent='✓ '+(q.company||'운송장')+' QR 인식\n'+(q.slip?'송장 '+q.slip+' · ':'')+(q.date||'')+(q.time?' '+q.time:'')+
     '\n실중량 '+(q.weight||'-')+'톤 · 차량 '+(q.vehicle||'-')+
     (q.customer?'\n거래처: '+q.customer:'')+(q.item?'\n품목: '+q.item:'')+(q.loading?'\n상차지: '+q.loading:'')+(q.unloading?'\n하차지: '+q.unloading:'')+
     (missing.length?'\n⚠ 저장 전 확인: '+missing.join(' · '):'\n자동 입력 완료 · 저장 전 내용만 확인해 주세요.');
 }
 showQrStatus((q.company||'운송장')+' QR 판독 성공 · '+q.weight+'톤');
 toast((q.company||'운송장')+' QR · '+q.weight+'톤 입력 완료');
 return true;
}
function toSheetRows(a){return a.map(x=>({'날짜':x.date,'거래처':x.client,'물품':x.item,'중량(톤)':Number(x.weight||0),'단가(원/톤)':Number(x.price||0),'운임(원)':Number(x.freight||0),'상차지':x.loading,'하차지':x.unloading,'양회사':x.aggregate,'운송사':x.transport,'차량번호':x.vehicle}))}
function saveWorkbook(wb,name){if(!window.XLSX){toast('Excel 모듈을 불러오지 못했습니다');return}const b64=XLSX.write(wb,{bookType:'xlsx',type:'base64'}),data='data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+b64;if(window.AndroidBridge&&AndroidBridge.saveBase64File){AndroidBridge.saveBase64File(name,data);return}const a=document.createElement('a');a.href=data;a.download=name;a.click()}
function exportTransportExcel(){const m=$('excelMonth').value||currentMonth(),a=logs.filter(x=>monthKey(x.date)===m);if(!a.length){toast(m+' 운송내역이 없습니다');return}const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(toSheetRows(a)),'운송내역');saveWorkbook(wb,'운송일보_'+m+'.xlsx')}
function exportAllExcel(){if(!logs.length){toast('운송내역이 없습니다');return}const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(toSheetRows(logs)),'전체운송내역');saveWorkbook(wb,'운송일보_전체_'+Date.now()+'.xlsx')}
function esc(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]))}
$('historyMonth').value=currentMonth();$('settlementMonth').value=currentMonth();$('excelMonth').value=currentMonth();renderAll();
