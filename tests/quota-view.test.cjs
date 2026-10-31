'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {quotaView}=require('../src/inori/renderer/quota-view.js');
test('unknown quota preserves placeholder rows and never claims zero',()=>{
 for(const health of ['connecting','unverified','account-mismatch','unavailable']){const v=quotaView({health});assert.equal(v.rows.length,2);assert.ok(v.rows.every(r=>r.remaining===null));assert.ok(!v.summary.includes('0%'));assert.ok(v.message);}
});
test('stale valid values stay visible while invalid values and reset dates remain unknown',()=>{
 const v=quotaView({health:'stale',windows:[{label:'短期',remaining:0,resetsAt:Infinity},{label:'每周',remaining:NaN,resetsAt:1e99}]});assert.equal(v.rows[0].remaining,0);assert.equal(v.rows[1].remaining,null);assert.equal(v.rows[1].resetsAt,null);assert.match(v.message,/上次/);
 assert.equal(quotaView({health:'account-mismatch',windows:[{remaining:80}]}).rows[0].remaining,null);
 assert.match(quotaView({health:'stale'}).message,/暂时无法/);
});
