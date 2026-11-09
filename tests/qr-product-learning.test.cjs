'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/qr-product-learning-fix.js','utf8');
const mapStore=new Map();
const elements={
 regClient:{value:'c1'},
 regItemDisplay:{value:'',},
 regPrice:{value:''},
 regQrNotice:{textContent:'✓ QR 인식',style:{}}
};
const cards=[{dataset:{item:encodeURIComponent('저발열')},classList:{active:false,add(){this.active=true;},remove(){this.active=false;},toggle(k,b){this[k]=b;}}},{dataset:{item:encodeURIComponent('고로슬래그 미분말')},classList:{active:false,add(){this.active=true;},remove(){this.active=false;},toggle(k,b){this[k]=b;}}}];
const handlers={};
elements.rateChoices={addEventListener:(name,fn)=>{handlers[name]=fn;}};
const clients=[{id:'c1',name:'미래해운(주)',rates:[{item:'저발열',price:3700},{item:'저발열시멘트',price:3700},{item:'고로슬래그 미분말',price:17600}]}];
let qr={valid:true,type:'sampyo-pipe',item:'',itemCode:'UNMAPPED_LOWHEAT',itemNeedsReview:true};
let calcs=0;
const app={window:null,document:{getElementById:k=>elements[k]||null,querySelectorAll:()=>cards},
 localStorage:{getItem:k=>mapStore.get(k)||null,setItem:(k,v)=>mapStore.set(k,v)},
 clients,parseTransportQR:()=>qr,applyQR:()=>true,
 chooseRate:(item,p)=>{app.regItem=item;elements.regPrice.value=String(p);},
 calcFreight:()=>{calcs++},regItem:'',};
app.window=app;
vm.createContext(app);vm.runInContext(source,app);
app.applyQR('sample');
assert.equal(elements.regPrice.value,'');
assert.equal(app.regItem,'');
assert.equal(cards[0].classList.active,false);
handlers.click({target:cards[0]});
assert.equal(app.regItem,'저발열');
assert.equal(elements.regPrice.value,'3700');
assert.ok(mapStore.get('transportlog_qr_item_map_v1').includes('UNMAPPED_LOWHEAT'));
elements.regPrice.value='';app.regItem='';
app.applyQR('sample');
assert.equal(app.regItem,'저발열');
assert.equal(elements.regPrice.value,'3700');
// Different QR item code must not borrow the first learned item.
qr={...qr,itemCode:'OTHER_UNKNOWN'};
app.applyQR('sample2');
assert.equal(elements.regPrice.value,'');
assert.equal(app.regItem,'');
// Verified low-heat must match the registered alias, not the slag item.
qr={...qr,itemCode:'VERIFIED',itemVerifiedBySlip:true,item:'저발열시멘트'};
app.applyQR('verified');
assert.equal(app.regItem,'저발열');
assert.equal(elements.regPrice.value,'3700');
assert.notEqual(elements.regPrice.value,'17600');
assert.ok(calcs>0);
console.log('PASS: unknown QR requires choice, confirmed code reuses rate, low-heat distinct from slag');
