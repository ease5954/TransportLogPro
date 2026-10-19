'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/quick-register-calc-loading-fix.js','utf8');
function node(value=''){
  return {value,textContent:'',dataset:{},handlers:{},addEventListener(type,fn){(this.handlers[type]||(this.handlers[type]=[])).push(fn);}};
}
const fields={
  regWeight:node('25.55'),regPrice:node('17,300'),regFreight:node(),
  regClient:node(''),regClientManual:node('새거래처'),regLoading:node(''),regAggregate:node(''),
  newClientName:node(''),newClientLoading:node('')
};
const client={id:11,name:'영월현대',loading:'영월현대',aggregate:'영월현대'};
const scope={
  console,clients:[client],normalizeQrName:v=>String(v||'').replace(/[^0-9a-zA-Z가-힣]/g,'').toLowerCase(),
  document:{getElementById:id=>fields[id]||null},setTimeout:fn=>{fn();return 1;},
  editTransport:()=>{
    // Simulate transport-edit-fix: registered client was selected, but the old
    // transport row had blank loading/aggregate and overwrote the populated values.
    fields.regClient.value='11';
    fields.regClientManual.value='영월현대';
    fields.regLoading.value='';
    fields.regAggregate.value='';
    return true;
  }
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

assert.equal(scope.__reliableCalcFreight(),442015);
assert.equal(fields.regFreight.textContent,'442,015원');
fields.regWeight.value='25.89';fields.regPrice.value='23100';
for(const fn of (fields.regPrice.handlers.input||[]))fn();
assert.equal(fields.regFreight.textContent,'598,059원');

fields.regClient.value='';
fields.regClientManual.value='새거래처';
assert.equal(scope.__syncDirectClientLoading(),true);
assert.equal(fields.regLoading.value,'새거래처');
assert.equal(fields.regAggregate.value,'새거래처');

fields.newClientName.value='영월현대';
for(const fn of (fields.newClientName.handlers.input||[]))fn();
assert.equal(fields.newClientLoading.value,'영월현대');

// Exact regression from the phone screenshot: editing an older row whose
// loading place was empty must still show the registered client's loading place.
fields.regLoading.value='';fields.regAggregate.value='';
assert.equal(scope.editTransport(2001),true);
assert.equal(fields.regLoading.value,'영월현대');
assert.equal(fields.regAggregate.value,'영월현대');

console.log('PASS: freight recalculates live and loading auto-fill survives transport editing');
