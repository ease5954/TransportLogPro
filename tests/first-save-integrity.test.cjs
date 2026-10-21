'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/quick-register-calc-loading-fix.js','utf8');
function node(value=''){
  return {value,textContent:'',dataset:{},handlers:{},addEventListener(type,fn){(this.handlers[type]||(this.handlers[type]=[])).push(fn);}};
}
const fields={
  regWeight:node('25.81'),regPrice:node('3700'),regFreight:node(),
  regClient:node('1'),regClientManual:node('삼척 삼표'),regLoading:node('삼척 삼표'),regAggregate:node('삼척 삼표'),
  newClientName:node(''),newClientLoading:node('')
};
const logs=[];
let savedSnapshot=null;
const scope={
  console,clients:[{id:1,name:'삼척 삼표',loading:'삼척 삼표'}],logs,
  normalizeQrName:v=>String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase(),
  document:{getElementById:id=>fields[id]||null},setTimeout:fn=>{fn();return 1;},
  save:(k,v)=>{if(k==='logs')savedSnapshot=JSON.parse(JSON.stringify(v));},
  renderHistory:()=>{},
  // Reproduce the phone bug: an upstream save layer accidentally commits a zero
  // weight/freight row even though the visible fields contained valid values.
  saveTransport:()=>{logs.push({id:1,weight:0,price:3700,freight:0});fields.regWeight.value='';fields.regPrice.value='';return true;}
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

assert.equal(scope.__reliableCalcFreight(),95497);
assert.equal(fields.regFreight.textContent,'95,497원');
assert.equal(scope.saveTransport(),true);
assert.equal(logs.length,1);
assert.equal(logs[0].weight,25.81);
assert.equal(logs[0].price,3700);
assert.equal(logs[0].freight,95497);
assert.equal(savedSnapshot[0].weight,25.81);
assert.equal(savedSnapshot[0].freight,95497);

console.log('PASS: first quick save preserves weight, price and freight');
