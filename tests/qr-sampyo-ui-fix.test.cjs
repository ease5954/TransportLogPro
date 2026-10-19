'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/qr-sampyo-ui-fix.js','utf8');
const fields={};
for(const id of ['regClient','regLoading','regUnloading','regAggregate','regTransport','regVehicle','regWeight','regItemDisplay','regQrNotice'])fields[id]={value:'',style:{},textContent:''};

const scope={
  console,
  document:{getElementById:id=>fields[id]||null},
  parseTransportQR:text=>({
    valid:true,type:'sampyo-pipe',company:'삼표시멘트',raw:text,
    date:'2026. 10. 19.',time:'0745',slip:'00002',weight:25.21,
    vehicle:'충북99바6610',loading:'삼표시멘트 삼척공장',
    customer:'',item:'',unloading:'',aggregate:'',carrier:'',
    customerComplete:false,destinationComplete:false
  }),
  applyQR:()=>true,
  clients:[],
  ensureQrClient:q=>({id:123,name:q.customer}),
  fillClients:()=>{},
  applyClient:()=>{},
  chooseQrItem:(q)=>{scope.regItem=q.item;},
  calcFreight:()=>{},
  regItem:''
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

const raw='\x02SA1|20261019|074500|6610|UNKNOWN_CUSTOMER|UNKNOWN_SITE|UNKNOWN_ITEM|00002|25210|1\x03';
assert.equal(scope.applyQR(raw),true);
assert.equal(fields.regClient.value,'123');
assert.equal(fields.regLoading.value,'삼표시멘트 삼척공장');
assert.equal(fields.regUnloading.value,'미래해운 묵호공항(상차도, 벌크)');
assert.equal(fields.regAggregate.value,'삼표시멘트 삼척공장');
assert.equal(fields.regTransport.value,'이진상운');
assert.equal(fields.regVehicle.value,'충북99바6610');
assert.equal(fields.regWeight.value,'25.21');
assert.equal(fields.regItemDisplay.value,'저발열시멘트');
assert.equal(scope.regItem,'저발열시멘트');
assert.match(fields.regQrNotice.textContent,/미래해운\(주\)/);
assert.match(fields.regQrNotice.textContent,/저발열시멘트/);
assert.match(fields.regQrNotice.textContent,/이진상운/);

console.log('PASS: Sampyo Samcheok QR forces customer/item/destination/plant/carrier into registration form');
