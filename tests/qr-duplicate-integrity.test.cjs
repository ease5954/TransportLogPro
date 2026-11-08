'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('app/src/main/assets/qr-waybill-integrity-guard.js','utf8');
const elems={regClient:{value:'1'},regPrice:{value:'23300'},regWeight:{value:'25.64'},regVehicle:{value:''},regLoading:{value:''},regUnloading:{value:''},regItemDisplay:{value:''},regClientManual:{value:''}};
const rows=[], clients=[{id:1,name:'동양-파주(특수)',rates:[{item:'3종 BK',price:23300}]}], messages=[];
let saves=0, current=null;
const env={
 document:{getElementById:id=>elems[id]||null},
 clients,logs:rows,
 toast:message=>messages.push(message),
 save:()=>{},
 calcFreight:()=>{},
 applyClient:()=>{},
 chooseQrItem:()=>{},
 parseTransportQR:()=>current,
 applyQR:()=>true,
 saveTransport:()=>{saves++;rows.push({id:saves,date:'2026. 11. 6.',weight:25.64,vehicle:'충북99바6610',client:'동양-파주(특수)',item:'3종 BK',price:23300,freight:597412});return true;}
};
env.window=env;
vm.createContext(env);
vm.runInContext(code,env);
const raw='3종 BK@0004202611060BK023@운송@충북99바6610@40.080@14.440@25.640@쌍용북평@20261106@210545@동양-파주(특수)@북평공장';
current={valid:true,type:'ssangyong-at',company:'쌍용C&E',raw,slip:'0004202611060BK023',date:'2026. 11. 6.',customer:'유진기업-동서울(특수)',item:'3종 BK',vehicle:'충북99바6610',weight:25.64,loading:'쌍용C&E 북평공장'};
const fixed=env.parseTransportQR(raw);
assert.equal(fixed.customer,'동양-파주(특수)');
assert.equal(fixed.vehicle,'충북99바6610');
env.applyQR(raw);
assert.equal(env.saveTransport(),true);
assert.equal(rows.length,1);
assert.equal(rows[0].qrSlip,'0004202611060BK023');
assert.ok(rows[0].qrKey);
assert.equal(env.saveTransport(),false);
assert.equal(rows.length,1);
assert.match(messages.at(-1),/이미 등록된/);
// Zero-price QR should require review rather than silently creating a zero-won trip.
elems.regPrice.value='0';
assert.equal(env.saveTransport(),false);
// Existing legacy rows that lack QR key are also protected when truck/date/weight match.
rows.length=0;
rows.push({id:77,date:'2026. 11. 6.',weight:25.64,vehicle:'충북99바6610'});
elems.regPrice.value='23300';
assert.equal(env.saveTransport(),false);
assert.equal(rows.length,1);
console.log('PASS: Northpyeong customer correction, QR identity, duplicate prevention, zero-price save block');
