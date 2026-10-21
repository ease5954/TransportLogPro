'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const patch=fs.readFileSync('app/src/main/assets/back-home-fix.js','utf8');

function makeClassList(initial=[]){
  const set=new Set(initial);
  return {
    contains:v=>set.has(v),
    add:v=>set.add(v),
    remove:v=>set.delete(v),
    toggle(v,on){if(on===undefined){set.has(v)?set.delete(v):set.add(v);}else{on?set.add(v):set.delete(v);}}
  };
}

const screens={
  home:{id:'home',classList:makeClassList(['screen','active'])},
  history:{id:'history',classList:makeClassList(['screen'])},
  register:{id:'register',classList:makeClassList(['screen'])}
};
const nodes={
  drawer:{classList:makeClassList(['drawer'])},rateModal:{classList:makeClassList(['modal'])},
  insurance:{classList:makeClassList(['overlay'])},appInfo:{classList:makeClassList(['overlay'])}
};
const listeners={};
const stack=[{transportScreen:'home'}];
let index=0;
let current='home';

const scope={
  console,
  location:{href:'https://appassets.androidplatform.net/assets/index.html'},
  document:{
    querySelector(sel){if(sel==='.screen.active')return screens[current];return null;},
    getElementById(id){return nodes[id]||screens[id]||null;}
  },
  addEventListener(type,fn){listeners[type]=fn;},
  history:{
    state:stack[0],
    replaceState(state){stack[index]=state;this.state=state;},
    pushState(state){stack.splice(index+1);stack.push(state);index++;this.state=state;},
    back(){if(index>0){index--;this.state=stack[index];if(listeners.popstate)listeners.popstate({state:this.state});}}
  },
  go(id){current=String(id);return true;}
};
scope.window=scope;
vm.createContext(scope);
vm.runInContext(patch,scope);

assert.equal(scope.__backHomeActiveScreen(),'home');

scope.go('history');
assert.equal(current,'history');
assert.equal(index,1);
assert.equal(scope.history.state.transportScreen,'history');

scope.history.back();
assert.equal(current,'home');
assert.equal(index,0);
assert.equal(scope.history.state.transportScreen,'home');

scope.go('register');
assert.equal(current,'register');
assert.equal(index,1);
scope.go('history');
assert.equal(current,'history');
assert.equal(index,1,'moving between menus must keep only one back step');
assert.equal(scope.history.state.transportScreen,'history');

scope.history.back();
assert.equal(current,'home');
assert.equal(index,0);

console.log('PASS: Android Back history returns app menus to Home in one step');
