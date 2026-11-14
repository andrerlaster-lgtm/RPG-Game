const test = require('node:test');
const assert = require('node:assert/strict');
const { velocity, damp, cameraFraction } = require('../traversal.js');

test('walk accelerates and brakes in bounded time without overshooting', () => {
  let v = {x: 0, y: 0};
  for (let i=0;i<12;i++) v = velocity(v.x,v.y,118,0,1000,1/60);
  assert.equal(v.x,118);
  for (let i=0;i<5;i++) v = velocity(v.x,v.y,0,0,1800,1/60);
  assert.deepEqual(v,{x:0,y:0});
});
test('diagonal acceleration has the same magnitude as axial acceleration', () => {
  const v = velocity(0,0,118/Math.SQRT2,118/Math.SQRT2,1000,1/60);
  assert.ok(Math.abs(Math.hypot(v.x,v.y)-1000/60)<1e-8);
});
test('damping is invariant to timestep subdivision', () => {
  assert.ok(Math.abs((1-damp(14,1/60))**2-(1-damp(14,1/30)))<1e-10);
});
const head = {x:0,y:0.85,z:0};
test('unobstructed camera retains full distance',()=>{
  assert.equal(cameraFraction(head,{x:4,y:3,z:0},()=>0),1);
});
test('camera stops before a wall, including its volume',()=>{
  const to={x:4,y:3,z:0};
  const k=cameraFraction(head,to,(x)=>x>=2?4:0);
  assert.ok(k>0.35 && k<0.45);
  assert.ok(to.x*k+0.22<2);
});
test('camera corners catch a thin side obstruction missed by the centre ray',()=>{
  const k=cameraFraction(head,{x:4,y:2,z:0},(x,z)=>x>=2&&z>0.1?4:0);
  assert.ok(k<0.5);
});
test('camera may look over low furniture and catches taller stalls',()=>{
  const to={x:4,y:3,z:0};
  assert.equal(cameraFraction(head,to,(x)=>x>2?0.5:0),1);
  assert.ok(cameraFraction(head,to,(x)=>x>1?1.9:0)<1);
});
test('camera detects a gallery only at its elevated height',()=>{
  const gallery=(x,z,y)=>x>1&&y+0.22>=1.38?1.94:0;
  assert.equal(cameraFraction(head,{x:4,y:0.85,z:0},gallery),1);
  assert.ok(cameraFraction(head,{x:4,y:3,z:0},gallery)<1);
});
test('zero length camera sweep is finite',()=>{
  assert.equal(cameraFraction(head,head,()=>0),1);
});
