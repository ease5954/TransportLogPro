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

// Raw bytes decoded directly from the user's SP Nature QR photo.
const raw='\x02U02|20261012|202034|6610|2140620000||1A3010102|CB202610120158|28830.00|1                                                      \x03';
const q=scope.parseTransportQR(raw);

assert.equal(q.valid,true);
assert.equal(q.type,'spnature-pipe');
assert.equal(q.company,'에스피네이처');
assert.equal(q.date,'2026. 10. 12.');
assert.equal(q.time,'2020');
assert.equal(q.vehicle,'충북99바6610');
assert.equal(q.customer,'미래해운(주)');
assert.equal(q.unloading,'미래해운(주)_동해부(강릉)_천안SP');
assert.equal(q.item,'고로슬래그 미분말');
assert.equal(q.itemCode,'1A3010102');
assert.equal(q.slip,'CB202610120158');
assert.equal(q.weight,28.83);
assert.equal(q.loading,'(주)에스피네이처 천안슬래그공장');
assert.equal(q.aggregate,'(주)에스피네이처 천안슬래그공장');
console.log('PASS: SP Nature U02 QR parses date, time, vehicle, destination, item and 28.830t weight');
