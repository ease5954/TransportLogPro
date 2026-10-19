'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/qr-sampyo-ui-fix.js','utf8');
const fields={};
for(const id of ['newClientName','newClientLoading','newClientTransport','newClientItem','newClientPrice','rateClientId','rateItem','ratePrice','regItemDisplay']){
  fields[id]={value:'',dataset:{},style:{}};
}

const saved=[];const toasts=[];
const scope={
  console,Date,
  document:{getElementById:id=>fields[id]||null},
  clients:[],
  normalizeQrName:v=>String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase(),
  parseTransportQR:()=>({valid:false}),
  applyQR:()=>true,
  chooseQrItem:()=>{},
  save:(key,value)=>saved.push([key,JSON.parse(JSON.stringify(value))]),
  renderAll:()=>{},renderRates:()=>{},chooseRate:(item,price)=>{scope.regItem=item;scope.lastRate=[item,price];},
  closeRateModal:()=>{},toast:m=>toasts.push(m),regItem:''
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

// New client: create client and optional item/rate in one save.
fields.newClientName.value='미래해운(주)';
fields.newClientLoading.value='삼표시멘트 삼척공장';
fields.newClientLoading.dataset.manual='1';
fields.newClientTransport.value='이진상운';
fields.newClientItem.value='저발열시멘트';
fields.newClientPrice.value='0';
assert.equal(scope.addClient(),true);
assert.equal(scope.clients.length,1);
assert.equal(scope.clients[0].name,'미래해운(주)');
assert.equal(scope.clients[0].loading,'삼표시멘트 삼척공장');
assert.equal(scope.clients[0].transport,'이진상운');
assert.deepEqual(scope.clients[0].rates,[{item:'저발열시멘트',price:0}]);
assert.match(toasts.at(-1),/신규 거래처 등록 완료/);

// Duplicate client name with formatting differences updates instead of duplicating.
fields.newClientName.value='미래해운 주';
fields.newClientLoading.value='미래해운 주'; // auto-filled, not manual
fields.newClientTransport.value='';
fields.newClientItem.value='고로슬래그 미분말';
fields.newClientPrice.value='3100';
assert.equal(scope.addClient(),true);
assert.equal(scope.clients.length,1);
assert.equal(scope.clients[0].loading,'삼표시멘트 삼척공장');
assert.equal(scope.clients[0].transport,'이진상운');
assert.equal(scope.clients[0].rates.length,2);
assert.equal(scope.clients[0].rates[1].item,'고로슬래그 미분말');
assert.equal(scope.clients[0].rates[1].price,3100);
assert.match(toasts.at(-1),/기존 거래처 정보 수정 완료/);

// QR-discovered item must auto-register even when price is 0.
const c={id:99,name:'새 거래처',loading:'공장',transport:'',rates:[]};
scope.clients.push(c);
const q={valid:true,type:'sampyo-pipe',item:'저발열시멘트',price:0};
scope.chooseQrItem(q,c);
assert.deepEqual(c.rates,[{item:'저발열시멘트',price:0}]);
assert.equal(scope.regItem,'저발열시멘트');
assert.deepEqual(scope.lastRate,['저발열시멘트',0]);

console.log('PASS: client registration/update and zero-price QR item auto-registration are stable');
