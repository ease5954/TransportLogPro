'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=source.indexOf('function normalizeQrName(');
const end=source.indexOf('function matchQrClient(',start);
assert.ok(start>=0&&end>start,'QR parser exists');
const scope={Date,Number,String,TextDecoder,Uint8Array,logs:[],$:()=>({value:''})};
vm.createContext(scope);
vm.runInContext(source.slice(start,end),scope);

// 1. Hanil-style @ format: net tonnes in field 5 and date in field 7.
let q=scope.parseTransportQR(String.fromCharCode(2)+'CB0010@0001@(주)이진특@테스트00가1234@@25.71@한일영월@20260814@0925@삼양레미콘( @경기도 남 @테스트'+String.fromCharCode(3));
assert.equal(q.type,'hanil-at');assert.equal(q.weight,25.71);assert.equal(q.customer,'삼양레미콘(주)');assert.equal(q.loading,'한일시멘트(영월)');assert.equal(q.unloading,'경기도 남양주시');

// 2. Ssangyong-style @ format: product is field 0.
q=scope.parseTransportQR(String.fromCharCode(2)+'3종 BK@0004202609270BK002@@테스트00가1234@@25.76@쌍용북평@20260927@2236@유진기업-동서울@북평공장'+String.fromCharCode(3));
assert.equal(q.type,'ssangyong-at');assert.equal(q.weight,25.76);assert.equal(q.item,'3종 BK');assert.equal(q.customer,'유진기업-동서울(특수)');assert.equal(q.loading,'쌍용C&E 북평공장');assert.equal(q.unloading,'북평공장');

// 3. Sampyo pipe format: weight is kilograms and must convert to tonnes.
q=scope.parseTransportQR(String.fromCharCode(2)+'SA1|20260929|055942|1234|1150850000|1708120081|10000001|BA202609290012|25750|2'+String.fromCharCode(3));
assert.equal(q.type,'sampyo-pipe');assert.equal(q.weight,25.75);assert.equal(q.customer,'미래해운(주)');assert.equal(q.item,'1종시멘트벌크');assert.equal(q.loading,'삼표시멘트 삼척공장');assert.equal(q.unloading,'미래해운(주)/(주)짜콘');assert.equal(q.price,3300,'Sampyo customer+item rate must autofill');

// Mojibake repair path for a CP949 payload where bytes were exposed as Latin-1 / halfwidth.
const broken=String.fromCharCode(2)+'3ﾁｾ BK@X@@ÃæºÏ99¹Ù1234@@25.76@½Ö¿ëºÏÆò@20260927@2236@À¯Áø±â¾÷-µ¿¼­¿ï@ºÏÆò°øÀå'+String.fromCharCode(3);
q=scope.parseTransportQR(broken);assert.equal(q.type,'ssangyong-at');assert.equal(q.item,'3종 BK');assert.equal(q.loading,'쌍용C&E 북평공장');



// Northpyeong scanners can return CP949 source bytes as Latin-1 + halfwidth characters.
// This reproduces the observed QR text shape but uses a synthetic plate.
const brokenBukpyeong=String.fromCharCode(2)
  +'3ﾁｾ BK@0004202609270BK002@@ÃæºÏ00°¡0000@@25.76@½Ö¿ëºÏÆò@20260927@2236@À¯Áø±â¾÷-µ¿¼­¿ï@ºÏÆò°øÀå'
  +String.fromCharCode(3);
q=scope.parseTransportQR(brokenBukpyeong);
assert.equal(q.type,'ssangyong-at');
assert.equal(q.weight,25.76);
assert.equal(q.item,'3종 BK');
assert.equal(q.loading,'쌍용C&E 북평공장');
assert.equal(q.customer,'유진기업-동서울(특수)');
assert.equal(q.unloading,'북평공장');

assert.equal(scope.parseTransportQR('https://example.invalid').valid,false);
console.log('PASS: Hanil @, Ssangyong @, Sampyo pipe, net-ton conversion, CP949 repair');
