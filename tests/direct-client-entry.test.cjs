'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/manual-quick-register-fix.js','utf8');
function node(value=''){
  return {value,dataset:{},style:{},innerHTML:'',handlers:{},className:'',textContent:'',placeholder:'',type:'',autocomplete:'',
    classList:{toggle(){}},
    addEventListener(type,fn){(this.handlers[type]||(this.handlers[type]=[])).push(fn);},
    insertAdjacentElement(where,child){assert.equal(where,'afterend');if(child.id)fields[child.id]=child;}
  };
}
const fields={
  regClient:node(''),rateChoices:node(),regItemDisplay:node('저발열시멘트'),regPrice:node('0'),
  regLoading:node('삼표시멘트 삼척공장'),regUnloading:node('새 하차지'),regAggregate:node('삼표시멘트 삼척공장'),
  regTransport:node('이진상운'),regWeight:node('25.21'),regVehicle:node('충북99바6610')
};
let baseSaveCalls=0;
const saved=[];
const scope={
  console,Date,clients:[],regItem:'저발열시멘트',
  document:{
    getElementById:id=>fields[id]||null,
    createElement:()=>node(),
    querySelector:()=>null,
    querySelectorAll:()=>[]
  },
  normalizeQrName:v=>String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase(),
  save:(k,v)=>saved.push([k,JSON.parse(JSON.stringify(v))]),
  fillClients:()=>{},renderRates:()=>{},calcFreight:()=>{},chooseQrItem:()=>{},toast:()=>{},
  setTimeout:fn=>{fn();return 1;},
  saveTransport:()=>{baseSaveCalls++;return true;}
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

assert.ok(fields.regClientManual,'direct client input must be added below client selector');
assert.equal(fields.regClientManualLabel.textContent,'거래처 직접 입력');
assert.match(fields.regClientManual.placeholder,/직접 입력/);

fields.regClientManual.value='새 거래처';
assert.equal(scope.saveTransport(),true);
assert.equal(baseSaveCalls,1);
assert.equal(scope.clients.length,1);
assert.equal(scope.clients[0].name,'새 거래처');
assert.equal(scope.clients[0].loading,'삼표시멘트 삼척공장');
assert.equal(scope.clients[0].unloading,'새 하차지');
assert.equal(scope.clients[0].transport,'이진상운');
assert.equal(scope.clients[0].rates.length,1);
assert.equal(scope.clients[0].rates[0].item,'저발열시멘트');
assert.equal(scope.clients[0].rates[0].price,0);
assert.equal(fields.regClient.value,String(scope.clients[0].id));
assert.ok(saved.some(x=>x[0]==='clients'));

console.log('PASS: direct client entry auto-registers and saves quick transport');
