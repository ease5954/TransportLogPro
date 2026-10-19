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

// User-confirmed Samcheok slip. The three business codes are intentionally unknown:
// the exact printed slip identity must still enrich the registration fields.
const raw='\x02SA1|20261019|074500|6610|UNKNOWN_CUSTOMER|UNKNOWN_MUKHO|UNKNOWN_LOWHEAT|00002|25210|1\x03';
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
assert.equal(q.slip,'00002');
assert.equal(q.destinationComplete,true);
console.log('PASS: exact Samcheok 00002 slip is enriched even with previously unknown Sampyo codes');
