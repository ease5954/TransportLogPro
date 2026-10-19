'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const patch=fs.readFileSync('app/src/main/assets/manual-quick-register-fix.js','utf8');
function node(value=''){return{value,readOnly:true,dataset:{},style:{},innerHTML:'',handlers:{},classList:{toggle(){}},addEventListener(type,fn){(this.handlers[type]||(this.handlers[type]=[])).push(fn);},removeAttribute(name){if(name==='readonly')this.readOnly=false;}};}
const fields={regClient:node('1'),regClientManual:node(''),rateChoices:node(),regItemDisplay:node(),regPrice:node('3700'),regLoading:node('삼척삼표'),regUnloading:node('배작업'),regAggregate:node('삼척삼표'),regTransport:node('이진상운')};
const client={id:1,name:'삼척삼표',loading:'삼척삼표',transport:'이진상운',rates:[]};
let savedSnapshot=null,baseSavedItem='';
const scope={console,Date,clients:[client],regItem:'',document:{getElementById:id=>fields[id]||null,querySelectorAll:()=>[]},normalizeQrName:v=>String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase(),save:(k,v)=>{if(k==='clients')savedSnapshot=JSON.parse(JSON.stringify(v));},renderRates:()=>{},calcFreight:()=>{},setTimeout:fn=>{fn();return 1;},saveTransport:()=>{baseSavedItem=scope.regItem;return true;}};
scope.window=scope;vm.createContext(scope);vm.runInContext(patch,scope);
assert.equal(fields.regItemDisplay.readOnly,false);
fields.regItemDisplay.value='저발열시멘트';for(const fn of(fields.regItemDisplay.handlers.input||[]))fn();
assert.equal(scope.regItem,'저발열시멘트');assert.equal(scope.saveTransport(),true);assert.equal(baseSavedItem,'저발열시멘트');
assert.equal(client.rates.length,1);assert.equal(client.rates[0].item,'저발열시멘트');assert.equal(client.rates[0].price,3700);assert.equal(client.rates[0].loading,'삼척삼표');assert.equal(client.rates[0].unloading,'배작업');assert.equal(client.rates[0].transport,'이진상운');assert.ok(savedSnapshot);
console.log('PASS: manual product entry is editable and saved with the selected client');
