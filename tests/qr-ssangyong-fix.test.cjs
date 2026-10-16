'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const fix=fs.readFileSync('app/src/main/assets/qr-ssangyong-fix.js','utf8');
const start=app.indexOf('function normalizeQrName(');
const end=app.indexOf('function matchQrClient(',start);
assert.ok(start>=0&&end>start,'base QR parser exists');

const scope={Date,Number,String,TextDecoder,Uint8Array,logs:[],$:()=>({value:''})};
scope.window=scope;
scope.document={getElementById:()=>null};
vm.createContext(scope);
vm.runInContext(app.slice(start,end),scope);
// Minimal stubs needed by the compatibility layer; only structural decoding is exercised here.
scope.chooseQrItem=()=>{};
scope.save=()=>{};
scope.renderRates=()=>{};
scope.chooseRate=()=>{};
scope.showQrStatus=()=>{};
scope.clients=[];
vm.runInContext(fix,scope);

const raw=String.fromCharCode(2)
 +'3ﾁｾ BK@0004202610010BK018@@ÃæºÏ99¹Ù6610@@25.48@½Ö¿ëºÏÆò@20261001@2157@À¯Áø±â¾÷-µ¿¼­¿ï@ºÏÆò°øÀå'
 +String.fromCharCode(3);
const q=scope.parseTransportQR(raw);
assert.equal(q.valid,true);
assert.equal(q.type,'ssangyong-at');
assert.equal(q.item,'3종 BK');
assert.equal(q.weight,25.48);
assert.equal(q.loading,'쌍용C&E 북평공장');
assert.equal(q.customer,'유진기업-동서울(특수)');
assert.equal(q.unloading,'북평공장');
assert.equal(q.date,'2026. 10. 1.');
assert.equal(q.time,'2157');
console.log('PASS: Ssangyong mojibake structural fallback decodes current Northpyeong QR');
