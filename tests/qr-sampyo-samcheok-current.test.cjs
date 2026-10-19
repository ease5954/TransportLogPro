'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const fix=fs.readFileSync('app/src/main/assets/qr-ssangyong-fix.js','utf8');
const start=app.indexOf('function normalizeQrName(');
const end=app.indexOf('function matchQrClient(',start);
assert.ok(start>=0&&end>start,'base QR parser exists');

const storage={};
const scope={Date,Number,String,TextDecoder,Uint8Array,logs:[],$:()=>({value:''}),localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=String(v);}}};
scope.window=scope;
scope.document={getElementById:()=>null};
vm.createContext(scope);
vm.runInContext(app.slice(start,end),scope);
scope.chooseQrItem=()=>{};
scope.chooseRate=()=>{};
scope.applyClient=()=>{};
scope.applyQR=()=>true;
scope.saveTransport=()=>{};
scope.save=()=>{};
scope.renderRates=()=>{};
scope.showQrStatus=()=>{};
scope.clients=[];
vm.runInContext(fix,scope);

// Exact physical slip supplied by the user. Customer/site/item codes are deliberately
// all unknown, matching the real-world failure that older tests did not cover.
const raw='\x02SA1|20261019|074500|6610|NEW_CUSTOMER_CODE|NEW_MUKHO_SITE|NEW_LOWHEAT_ITEM|00002|25210|1\x03';
const q=scope.parseTransportQR(raw);
assert.equal(q.valid,true);
assert.equal(q.type,'sampyo-pipe');
assert.equal(q.customer,'미래해운(주)');
assert.equal(q.loading,'삼표시멘트 삼척공장');
assert.equal(q.aggregate,'삼표시멘트 삼척공장');
assert.equal(q.unloading,'미래해운 묵호공항(상차도, 벌크)');
assert.equal(q.item,'저발열시멘트');
assert.equal(q.carrier,'이진상운');
assert.equal(q.vehicle,'충북99바6610');
assert.equal(q.weight,25.21);
assert.equal(q.destinationComplete,true);

// The exact code triplet learned from the first scan must work on a later slip
// even when date/time/weight/vehicle change.
const later='\x02SA1|20261020|101500|7777|NEW_CUSTOMER_CODE|NEW_MUKHO_SITE|NEW_LOWHEAT_ITEM|00003|26010|1\x03';
const laterQ=scope.parseTransportQR(later);
assert.equal(laterQ.customer,'미래해운(주)');
assert.equal(laterQ.unloading,'미래해운 묵호공항(상차도, 벌크)');
assert.equal(laterQ.item,'저발열시멘트');
assert.equal(laterQ.carrier,'이진상운');

// Existing mapped Sampyo route must remain unchanged.
const old='\x02SA1|20260929|055942|6610|1150850000|1708120081|10000001|BA202609290012|25750|2\x03';
const oldQ=scope.parseTransportQR(old);
assert.equal(oldQ.unloading,'미래해운(주)/(주)짜콘');
assert.equal(oldQ.item,'1종시멘트벌크');

console.log('PASS: exact Samcheok low-heat slip works with unknown codes, learns the route, and preserves known Sampyo mappings');
