'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const script=fs.readFileSync('app/src/main/assets/qr-sampyo-item-identity-fix.js','utf8');
const elements={
 regClient:{value:'mirae'},
 regItemDisplay:{value:'1종시멘트벌크'},
 regPrice:{value:'3700'},
 regQrNotice:{value:'',style:{display:'none'},textContent:''}
};
const clients=[{id:'mirae',name:'미래해운(주)',rates:[{item:'1종시멘트벌크',price:3700},{item:'저발열',price:3700}]}];
let q={},saves=0;
const app={
 document:{getElementById:id=>elements[id]||null},clients,
 parseTransportQR:()=>({...q}),
 applyQR:()=>true,
 saveTransport:()=>{saves++;return true},
 chooseRate:(item,price)=>{app.regItem=item;elements.regPrice.value=String(price)},
 calcFreight:()=>{},
 regItem:'1종시멘트벌크',
 pendingQrMeta:null,
 toast:()=>{}
};
app.window=app;
vm.createContext(app);
vm.runInContext(script,app);
q={valid:true,type:'sampyo-pipe',company:'삼표시멘트',item:'1종시멘트벌크',itemCode:'10000001',date:'2026. 11. 9.',slip:'00008',weight:25.39,vehicle:'충북99바6610'};
assert.equal(app.parseTransportQR('QR').item,'저발열시멘트','photographed Nov 9 slip must be low-heat');
app.applyQR('QR');
assert.equal(app.regItem,'저발열');
assert.equal(elements.regItemDisplay.value,'저발열');
assert.equal(elements.regPrice.value,'3700','saved 저발열 alias must autofill rate');
assert.equal(app.saveTransport(),true);
assert.equal(saves,1);
q={...q,slip:'00009',itemCode:'UNMAPPED_ITEM',item:'1종시멘트벌크',weight:25.04};
assert.equal(app.parseTransportQR('QR').item,'','unknown Sampyo item codes must not be called type 1');
app.applyQR('QR');
assert.equal(app.regItem,'');
assert.equal(elements.regPrice.value,'');
assert.equal(app.saveTransport(),false,'unknown item not allowed to save with blank selection');
assert.equal(saves,1);
q={...q,itemCode:'10000001',item:'1종시멘트벌크'};
assert.equal(app.parseTransportQR('QR').item,'1종시멘트벌크','known type-1 item must be preserved absent evidence');
console.log('PASS: low-heat waybill identity, unknown-item review, valid type-1 unaffected');
