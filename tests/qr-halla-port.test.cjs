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
scope.save=()=>{};
scope.renderRates=()=>{};
scope.chooseRate=()=>{};
scope.showQrStatus=()=>{};
scope.clients=[];
vm.runInContext(fix,scope);

const raw=[
  'HALLA CEMENT',
  '반출증 No:2627411067',
  '제품명:P/C BULK',
  '표준명:포틀랜드 시멘트 1종',
  '출하일자:2026-10-01 14:09',
  '거래처명:미래해운(주)(주식회사',
  '운송업체:미래해운(주)(주식회사',
  '차량번호:충북99바6610',
  '기사성명:김현삼',
  '총중량:39.90',
  '공차중량:14.22',
  '실중량:25.68',
  '한라시멘트(주) 항만공장'
].join('@');

const q=scope.parseTransportQR(raw);
assert.equal(q.valid,true);
assert.equal(q.type,'halla-port');
assert.equal(q.company,'한라시멘트');
assert.equal(q.slip,'2627411067');
assert.equal(q.item,'포틀랜드시멘트(1종)');
assert.equal(q.weight,25.68);
assert.equal(q.loading,'한라시멘트 항만공장');
assert.equal(q.aggregate,'한라시멘트 항만공장');
assert.equal(q.vehicle,'충북99바6610');
assert.equal(q.date,'2026. 10. 1.');
assert.equal(q.time,'1409');
assert.match(q.carrier,/미래해운/);
console.log('PASS: Halla Cement port QR parses shipment, net weight, vehicle, date and product');
