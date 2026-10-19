'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/manual-quick-register-fix.js','utf8');
function node(value=''){return{value,dataset:{},style:{},innerHTML:'',handlers:{},classList:{toggle(){}},addEventListener(type,fn){(this.handlers[type]||(this.handlers[type]=[])).push(fn);}};}
const fields={
  regClient:node('1'),rateChoices:node(),regItemDisplay:node(),regPrice:node(),
  regLoading:node(),regUnloading:node(),regAggregate:node(),regTransport:node()
};
const saved=[];
const client={id:1,name:'미래해운(주)',loading:'삼표시멘트 삼척공장',transport:'이진상운',rates:[{item:'저발열시멘트',price:0}]};
const scope={
  console,clients:[client],regItem:'',
  document:{getElementById:id=>fields[id]||null,querySelectorAll:()=>[]},
  normalizeQrName:v=>String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase(),
  save:(k,v)=>saved.push([k,JSON.parse(JSON.stringify(v))]),
  renderRates:c=>{fields.rateChoices.innerHTML=(c.rates||[]).map(r=>r.item).join(',');},
  calcFreight:()=>{},setTimeout:fn=>{fn();return 1;},chooseQrItem:()=>{}
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

assert.equal(typeof scope.applyClient,'function');
assert.equal(scope.applyClient(),true);
assert.equal(scope.regItem,'저발열시멘트');
assert.equal(fields.regItemDisplay.value,'저발열시멘트');
assert.equal(fields.regPrice.value,'0');
assert.equal(fields.regLoading.value,'삼표시멘트 삼척공장');
assert.equal(fields.regUnloading.value,'미래해운 묵호공항(상차도, 벌크)');
assert.equal(fields.regAggregate.value,'삼표시멘트 삼척공장');
assert.equal(fields.regTransport.value,'이진상운');
assert.equal(client.rates[0].unloading,'미래해운 묵호공항(상차도, 벌크)');
assert.ok((fields.regClient.handlers.change||[]).length>0);
assert.ok((fields.regClient.handlers.input||[]).length>0);
assert.ok((fields.regClient.handlers.blur||[]).length>0);

console.log('PASS: manual quick registration reloads saved item and route on Android client selection');
