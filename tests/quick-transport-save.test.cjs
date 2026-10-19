'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/qr-sampyo-ui-fix.js','utf8');
const fields={regItemDisplay:{value:''}};
let insertedButton=null;
const activeChoice={dataset:{item:encodeURIComponent('저발열시멘트')},textContent:'저발열시멘트 0원/톤'};
const calc={parentNode:{},insertAdjacentElement:(where,btn)=>{assert.equal(where,'afterend');insertedButton=btn;}};
function makeButton(){return {id:'',type:'',className:'',style:{},textContent:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};}
let savedItem='';
const scope={
  console,Date,
  document:{
    getElementById:id=>id==='quickTransportSave'&&insertedButton?insertedButton:(fields[id]||null),
    querySelector:sel=>sel==='#register .calc'?calc:(sel==='.choice.active'?activeChoice:null),
    createElement:tag=>{assert.equal(tag,'button');return makeButton();}
  },
  parseTransportQR:()=>({valid:false}),applyQR:()=>true,chooseQrItem:()=>{},
  normalizeQrName:v=>String(v||''),toast:()=>{},save:()=>{},renderAll:()=>{},renderRates:()=>{},
  closeRateModal:()=>{},clients:[],regItem:'',
  saveTransport:()=>{savedItem=scope.regItem;return true;}
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

assert.ok(insertedButton,'quick save button should be inserted below automatic freight');
assert.match(insertedButton.textContent,/바로 운송일보 저장/);
assert.equal(typeof insertedButton.handlers.click,'function');

// Even when regItem was lost, the selected product card must be recovered before save.
scope.regItem='';
assert.equal(scope.saveTransport(),true);
assert.equal(savedItem,'저발열시멘트');

// The visible quick-save button must invoke the same hardened save path.
scope.regItem='';savedItem='';
insertedButton.handlers.click();
assert.equal(savedItem,'저발열시멘트');

console.log('PASS: quick transport save button is visible and preserves selected QR item');
