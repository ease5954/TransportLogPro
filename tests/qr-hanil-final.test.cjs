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
vm.createContext(scope);
vm.runInContext(app.slice(start,end),scope);
scope.chooseQrItem=()=>{};
scope.save=()=>{};
scope.renderRates=()=>{};
scope.chooseRate=()=>{};
scope.showQrStatus=()=>{};
scope.clients=[];
vm.runInContext(fix,scope);

// Hanil can return a mixed result: ASCII/control structure is correct while each
// Korean field is independently exposed as CP949/Latin-1 mojibake.
const raw=String.fromCharCode(2)
 +'CB0010@0321@(ÁÖ)ÀÌÁøÆ¯@ÃæºÏ99¹Ù6610@@25.51@ÇÑÀÏ¿µ¿ù@20261008@1612@»ï¾ç·¹¹ÌÄÜ( @°æ±âµµ ³² @±èÇö»ï'
 +String.fromCharCode(3);
const q=scope.parseTransportQR(raw);
assert.equal(q.valid,true);
assert.equal(q.type,'hanil-at');
assert.equal(q.company,'한일시멘트');
assert.equal(q.item,'포틀랜드시멘트(1종)');
assert.equal(q.weight,25.51);
assert.equal(q.loading,'한일시멘트(영월)');
assert.equal(q.customer,'삼양레미콘(주)');
assert.equal(q.unloading,'경기도 남양주시');
assert.equal(q.carrier,'(주)이진특수');
assert.equal(q.vehicle,'충북99바6610');
assert.equal(q.date,'2026. 10. 8.');
assert.equal(q.time,'1612');

// Also prove each field decoder works independently instead of requiring the
// whole QR string to be mojibake.
assert.equal(scope.__decodeHanilMojibakeField('ÇÑÀÏ¿µ¿ù'),'한일영월');
assert.equal(scope.__decodeHanilMojibakeField('삼양레미콘(주)'),'삼양레미콘(주)');
console.log('PASS: Hanil mixed CP949 fields recover before autofill');
