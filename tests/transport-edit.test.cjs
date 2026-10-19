'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/transport-edit-fix.js','utf8');

function node(value=''){
  return {value,style:{},textContent:'',innerHTML:'',dataset:{},classList:{toggle(){}}};
}

const fields={
  regClient:node(''),regClientManual:node(''),regItemDisplay:node(''),regWeight:node(''),regPrice:node(''),
  regLoading:node(''),regUnloading:node(''),regAggregate:node(''),regTransport:node(''),regVehicle:node(''),
  regQrNotice:node(''),transportEditCancel:node(''),histTrips:node(''),histWeight:node(''),histFreight:node(''),historyList:node('')
};

const client={id:11,name:'삼척삼표',loading:'삼척삼표',unloading:'배작업',aggregate:'삼척삼표',transport:'이진상운',rates:[{item:'저발열',price:3700}]};
const original={id:1001,date:'2026. 10. 19.',client:'삼척삼표',item:'저발열',weight:25,price:3700,freight:92500,loading:'삼척삼표',unloading:'배작업',aggregate:'삼척삼표',transport:'이진상운',vehicle:'충북99바6610'};
const logs=[original];
let savedLogs=null;
let lastPage='';
let toastMessage='';

const scope={
  console,Date,clients:[client],logs,regItem:'',pendingQrMeta:null,editingTransportId:null,
  document:{
    getElementById:id=>fields[id]||null,
    querySelectorAll:()=>[]
  },
  filteredLogs:()=>scope.logs.slice(),
  normalizeQrName:v=>String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase(),
  save:(k,v)=>{if(k==='logs')savedLogs=JSON.parse(JSON.stringify(v));},
  renderHistory:()=>{},saveTransport:()=>{throw new Error('base save must not run during edit');},deleteLog:()=>true,
  fillClients:()=>{},
  applyClient:()=>{},
  calcFreight:()=>{},
  go:id=>{lastPage=id;},
  toast:m=>{toastMessage=m;},
  scrollTo:()=>{},
  __persistManualProductEntry:()=>true
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

assert.equal(scope.__transportEditLoaded,true);
assert.equal(scope.editTransport(1001),true);
assert.equal(scope.editingTransportId,1001);
assert.equal(lastPage,'register');
assert.equal(fields.regClient.value,'11');
assert.equal(fields.regItemDisplay.value,'저발열');
assert.equal(fields.regWeight.value,'25');
assert.equal(fields.regPrice.value,'3700');
assert.equal(fields.regLoading.value,'삼척삼표');
assert.equal(fields.regUnloading.value,'배작업');
assert.equal(fields.regTransport.value,'이진상운');
assert.equal(fields.regVehicle.value,'충북99바6610');
assert.equal(fields.transportEditCancel.style.display,'block');

fields.regItemDisplay.value='저발열시멘트';
fields.regWeight.value='25.21';
fields.regPrice.value='3800';
fields.regLoading.value='삼표시멘트 삼척공장';
fields.regUnloading.value='미래해운 묵호공항';
fields.regAggregate.value='삼표시멘트 삼척공장';
fields.regTransport.value='이진상운';
fields.regVehicle.value='충북99바6610';
scope.regItem='저발열시멘트';

assert.equal(scope.saveTransport(),true);
assert.equal(scope.logs.length,1,'editing must not add a new transport row');
assert.equal(scope.logs[0].id,1001,'editing must preserve the original id');
assert.equal(scope.logs[0].date,'2026. 10. 19.','editing must preserve the original date');
assert.equal(scope.logs[0].item,'저발열시멘트');
assert.equal(scope.logs[0].weight,25.21);
assert.equal(scope.logs[0].price,3800);
assert.equal(scope.logs[0].freight,95798);
assert.equal(scope.logs[0].loading,'삼표시멘트 삼척공장');
assert.equal(scope.logs[0].unloading,'미래해운 묵호공항');
assert.equal(scope.logs[0].transport,'이진상운');
assert.equal(scope.editingTransportId,null);
assert.equal(lastPage,'history');
assert.ok(savedLogs&&savedLogs.length===1);
assert.match(toastMessage,/수정 완료/);

scope.renderHistory();
assert.match(fields.historyList.innerHTML,/수정/);
assert.match(fields.historyList.innerHTML,/삭제/);

console.log('PASS: transport history row can be edited in place without creating a duplicate');
