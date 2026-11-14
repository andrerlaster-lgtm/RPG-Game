// Optional real-browser regression test. No runtime dependencies are added to the game.
// PLAYWRIGHT_MODULE=/path/to/playwright-core CHROME_PATH=/path/to/chrome node tests/playtest.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const artifacts=path.resolve(process.env.TEST_ARTIFACTS || path.join(root,'work/playtest'));
fs.mkdirSync(artifacts,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.tmj':'application/json','.glb':'model/gltf-binary','.png':'image/png','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);});
});
const results=[];
async function record(name,fn){const data=await fn();results.push({name,passed:true,data});console.log('PASS',name,data||'');}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    const page=await context.newPage();
    const errors=[],failures=[];
    page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message);});
    page.on('console',m=>{if(m.type()==='error' && !m.text().includes('404')) errors.push(m.text());});
    page.on('requestfailed',r=>{if(r.url().startsWith(url))failures.push(r.url());});
    await page.goto(url);
    await page.waitForFunction(()=>window.R3D && LEVEL && !document.querySelector('#start').disabled);
    await page.click('#start');
    await page.waitForTimeout(500);
    // Finish the existing opening lines using the real dialog controls.
    for(let i=0;i<12;i++) {if(await page.evaluate(()=>!DLG.open))break;await page.keyboard.press('Enter');await page.waitForTimeout(60);}
    await page.waitForFunction(()=>state.mode==='field');
    await page.waitForFunction(()=>R3D.hero().loaded);
    await record('startup and visible 3D canvas',async()=>{
      assert.ok(await page.locator('#game3d').isVisible());
      assert.equal(await page.evaluate(()=>state.district),'lantern');return await page.evaluate(()=>R3D.debug());
    });
    await record('replacement has working PBR texture maps and no false glow',async()=>{
      const hero=await page.evaluate(()=>R3D.hero());
      assert.equal(hero.url,'models/zay/shadow-rogue.glb');
      assert.ok(hero.materials.length>0);
      assert.ok(hero.materials.every(m=>m.base&&m.normal&&m.roughness&&m.metalness&&!m.emissive));
      return hero.materials;
    });
    await record('moving character is excluded from cached moon shadows',async()=>{
      const result=await page.evaluate(()=>{
        const moon=R3D.scene.children.find(o=>o.isDirectionalLight&&o.castShadow);
        const group=R3D.scene.children.find(o=>o.userData.rig),meshes=[];
        const count={moon:0,moving:0};
        group.traverse(o=>{if(o.isSkinnedMesh){meshes.push([o,o.onBeforeShadow]);o.onBeforeShadow=(renderer,obj,camera,shadowCamera)=>{count[shadowCamera===moon.shadow.camera?'moon':'moving']++;};}});
        try {moon.shadow.needsUpdate=true;R3D.render(0);R3D.render(0);return {...count,restored:meshes.every(([o])=>o.castShadow)};}
        finally {for(const [o,fn] of meshes)o.onBeforeShadow=fn;}
      });
      assert.equal(result.moon,0);assert.ok(result.moving>0);assert.equal(result.restored,true);return result;
    });
    await page.screenshot({path:path.join(artifacts,'lantern.png')});
    await record('WASD movement, braking and animated limbs',async()=>{
      const before=await page.evaluate(()=>({x:state.player.x,y:state.player.y}));
      await page.keyboard.down('w');await page.waitForTimeout(450);
      const moving=await page.evaluate(()=>({x:state.player.x,y:state.player.y,v:Math.hypot(state.player.vx,state.player.vy),stride:R3D.scene.children.find(g=>g.userData.town!==undefined)?.userData.stride,role:R3D.hero().role}));
      await page.keyboard.up('w');await page.waitForTimeout(200);
      assert.ok(Math.hypot(moving.x-before.x,moving.y-before.y)>8);
      assert.ok(moving.v>50);assert.ok(moving.stride>0.2);
      assert.equal(moving.role,'walk');
      assert.equal(await page.evaluate(()=>Math.hypot(state.player.vx,state.player.vy)),0);return moving;
    });
    await record('rigged locomotion blends, bones animate, and actions remain in place',async()=>{
      const rig=await page.evaluate(()=>{
        state.paused=true;
        const rig=R3D.scene.children.find(g=>g.userData.rig).userData.rig;
        const p={dashT:0};rig.reset();rig.update(0.1,0,p);const idle=rig.debug();
        rig.update(0.08,118,p);const blend=rig.debug();rig.update(0.12,118,p);const walk=rig.debug();
        rig.update(0.2,185,p);const run=rig.debug();
        rig.update(0.06,300,{dashT:0.17});const dodge=rig.debug();
        rig.update(0.2,0,p);const landed=rig.debug();
        rig.play('attack');rig.update(0.15,0,p);const attack=rig.debug();
        rig.play('attack');const repeat=rig.debug();rig.update(0.6,0,p);const recovered=rig.debug();
        rig.reset();state.paused=false;
        return {idle,blend,walk,run,dodge,landed,attack,repeat,recovered};
      });
      assert.equal(rig.idle.role,'idle');assert.equal(rig.walk.role,'walk');assert.equal(rig.run.role,'run');
      assert.ok(rig.blend.weights.idle>0&&rig.blend.weights.idle<1);assert.ok(rig.blend.weights.walk>0&&rig.blend.weights.walk<1);
      assert.notDeepEqual(rig.walk.leg,rig.blend.leg);assert.equal(rig.dodge.role,'dodge');
      assert.ok(Math.abs(rig.dodge.root[0]-rig.idle.root[0])<1e-5&&Math.abs(rig.dodge.root[2]-rig.idle.root[2])<1e-5);
      assert.ok(Math.abs(rig.run.root[0]-rig.idle.root[0])<1e-5&&Math.abs(rig.run.root[2]-rig.idle.root[2])<1e-5);
      assert.equal(rig.landed.role,'idle');assert.equal(rig.attack.role,'attack');
      assert.equal(rig.repeat.time,0);assert.equal(rig.recovered.role,'idle');return {blend:rig.blend.weights,roles:rig.idle.clips};
    });
    await record('orbit, zoom, recenter, and right-click card',async()=>{
      const before=await page.evaluate(()=>R3D.debug());
      await page.mouse.move(700,450);await page.mouse.down();await page.mouse.move(850,480,{steps:8});await page.mouse.up();
      const orbit=await page.evaluate(()=>R3D.debug());assert.ok(Math.abs(orbit.yaw-before.yaw)>0.4);
      await page.mouse.wheel(0,-250);await page.waitForTimeout(100);
      assert.ok((await page.evaluate(()=>R3D.debug().zoom))<before.zoom);
      await page.keyboard.press('c');assert.ok(await page.evaluate(()=>Math.abs(angDiff(R3D.heading(),state.player.dir))<0.01));
      const cards=await page.evaluate(()=>state.player.cards);
      await page.mouse.click(700,450,{button:'right'});await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>state.player.cards),cards-1);
      assert.equal(await page.evaluate(()=>R3D.hero().role),'throw');
    });
    await record('legacy arrows, sprint, roll, collision, and blocked footsteps',async()=>{
      // Deterministic fixtures exercise the actual updatePlayer and move functions on a real map.
      return await page.evaluate(()=>{
        state.paused=true; resetTraversal();
        const p=state.player; p.x=912;p.y=522;p.dir=Math.PI;
        keys.add('arrowup');for(let i=0;i<30;i++)updatePlayer(1/60);
        const walked=912-p.x;
        p.x=912;p.y=522;p.vx=p.vy=0;keys.add('shift');for(let i=0;i<30;i++)updatePlayer(1/60);
        const ran=912-p.x;
        if(!(ran>walked+15))throw Error('sprint did not exceed walk');
        resetTraversal();p.x=912;p.y=522;p.dir=Math.PI;p.dashCd=0;pressed.add(' ');updatePlayer(1/60);pressed.clear();
        if(!(p.dashT>0&&p.invuln>0))throw Error('roll did not start');
        R3D.render(1/60);if(R3D.hero().role!=='dodge')throw Error('roll animation did not start');
        // Find a clear street immediately east of a wall, away from NPCs.
        let spot;
        for(let y=1;y<H-1&&!spot;y++)for(let x=1;x<W-1;x++)if(grid[y][x]==='.'&&grid[y][x-1]==='#'&&!FURN.has(y*W+x)){
          p.x=x*TILE+16;p.y=y*TILE+16;if(!collides(p)){spot={x,y};break;}
        }
        if(!spot)throw Error('no collision fixture');
        p.dir=Math.PI;p.dashT=0;keys.add('arrowup');keys.add('shift');
        for(let i=0;i<120;i++)updatePlayer(1/60);
        if(collides(p)||p.x<spot.x*TILE+p.r)throw Error('walk crossed wall');
        const step=p.step;for(let i=0;i<20;i++)updatePlayer(1/60);
        if(Math.abs(p.step-step)>0.01)throw Error('blocked walking still advances footsteps');
        resetTraversal();p.dashCd=0;pressed.add(' ');updatePlayer(0.05);pressed.clear();
        if(collides(p)||p.x<spot.x*TILE+p.r)throw Error('roll crossed wall');
        return {walked,ran};
      });
    });
    await record('camera obstruction, district travel, river shader, and resource lifetime',async()=>{
      const visits=[];
      for(const id of ['crooked-halo','river-quarter','crown-estate','lantern','crooked-halo','river-quarter','crown-estate','lantern']){
        await page.evaluate(async id=>{await enterDistrict(id,'start',{save:false});state.paused=true;state.player.invuln=0;state.player.hidden=false;R3D.render(1/60);},id);
        await page.waitForTimeout(100);
        const debug=await page.evaluate(()=>R3D.debug());assert.ok(debug.cam.every(Number.isFinite));assert.ok(debug.boom>=0&&debug.boom<=1);assert.equal(debug.clearance,1);
        visits.push({id,...debug});
        if(visits.length===2){await page.evaluate(()=>{state.player.x=592;state.player.y=790;state.player.dir=Math.PI/2;R3D.resetCamera();R3D.render(1/60);});}
        if(visits.length<=4)await page.screenshot({path:path.join(artifacts,id+'.png')});
      }
      for(let i=0;i<4;i++){assert.ok(visits[i+4].geometries<=visits[i].geometries+3,`geometry leak in ${visits[i].id}`);assert.ok(visits[i+4].textures<=visits[i].textures+2);}
      // Full orbit around the spawn checks actual smoothed camera and geometry along corners.
      await page.evaluate(()=>{state.paused=false;});
      for(let i=0;i<8;i++){await page.mouse.move(600,450);await page.mouse.down();await page.mouse.move(730,450,{steps:3});await page.mouse.up();await page.waitForTimeout(80);}
      return visits;
    });
    await record('pause clears held movement and inventory returns to field',async()=>{
      await page.keyboard.down('w');await page.waitForTimeout(100);await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(()=>state.paused));assert.equal(await page.evaluate(()=>keys.size),0);
      await page.keyboard.up('w');await page.click('#resume');
      await page.keyboard.press('i');await page.waitForFunction(()=>state.mode==='inventory');
      await page.keyboard.press('Escape');await page.waitForFunction(()=>state.mode==='field');
    });
    await record('held controller Start toggles pause once per press',async()=>{
      await page.evaluate(()=>{
        const getPads=navigator.getGamepads.bind(navigator);
        const buttons=Array.from({length:16},()=>({pressed:false}));
        Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[{connected:true,buttons,axes:[0,0]}]});
        try {
          state.paused=false;padHeld.clear();pressed.clear();buttons[9].pressed=true;
          for(let i=0;i<5;i++){pollGamepad();pressed.clear();if(!state.paused)throw Error('held Start retriggered pause');}
          buttons[9].pressed=false;pollGamepad();pressed.clear();buttons[9].pressed=true;pollGamepad();
          if(state.paused)throw Error('second Start press did not resume');
        } finally {Object.defineProperty(navigator,'getGamepads',{configurable:true,value:getPads});padHeld.clear();resetTraversal();}
      });
    });
    await record('lighting and quality controls persist, preserve gameplay, and reuse textures',async()=>{
      await page.keyboard.press('Escape');await page.click('#pause-options');
      const snapshot=()=>page.evaluate(()=>({x:state.player.x,y:state.player.y,hp:state.player.hp,cards:state.player.cards,district:state.district,grid:JSON.stringify(grid)}));
      const before=await snapshot();
      assert.ok(await page.evaluate(()=>R3D.scene.children.some(o=>o.isSpotLight&&o.castShadow&&o.shadow.map&&o.shadow.mapSize.x===512)));
      for(const lighting of ['night','dusk','day'])await page.click(`[data-lighting="${lighting}"]`);
      await page.click('[data-quality="low"]');await page.waitForFunction(()=>R3D.debug().lighting==='day'&&R3D.debug().quality==='low');
      const warm=await page.evaluate(()=>R3D.debug());
      assert.ok(await page.evaluate(()=>R3D.scene.children.filter(o=>o.isSpotLight).every(o=>!o.castShadow)));
      assert.ok(await page.evaluate(()=>R3D.scene.children.filter(o=>o.isPointLight&&o.visible&&o.intensity>0).length<=4));
      for(const lighting of ['night','dusk','day','night','dusk','day']){await page.click(`[data-lighting="${lighting}"]`);await page.waitForTimeout(60);}
      const reused=await page.evaluate(()=>R3D.debug());assert.equal(reused.textures,warm.textures);assert.deepEqual(await snapshot(),before);
      assert.equal(await page.locator('[data-quality="low"]').getAttribute('aria-checked'),'true');
      await page.evaluate(()=>writeSave());await page.reload();await page.waitForFunction(()=>window.R3D&&LEVEL);
      assert.deepEqual(await page.evaluate(()=>({lighting:SETTINGS.lighting,quality:SETTINGS.quality})),{lighting:'day',quality:'low'});
      await page.click('#continue');await page.waitForFunction(()=>state.mode==='field'&&R3D.hero().loaded);
      await page.keyboard.press('Escape');await page.click('#pause-options');await page.click('[data-lighting="night"]');await page.click('[data-quality="high"]');
      await page.click('#options-done');await page.click('#resume');return {warm: warm.textures,reused: reused.textures};
    });
    await record('Noe interaction and existing ledger quest choices',async()=>{
      await page.evaluate(async()=>{await enterDistrict('crooked-halo','start',{save:false});const n=state.npcs.find(n=>n.who==='noe');state.player.x=n.x;state.player.y=n.y+40;state.player.dir=-Math.PI/2;});
      await page.keyboard.press('e');await page.waitForFunction(()=>DLG.open);
      const text=await page.evaluate(()=>DLG.full);assert.ok(text.length>0);
      await page.evaluate(()=>closeDialog());return text;
    });
    await record('save/continue preserves character and job progression',async()=>{
      await page.evaluate(()=>{state.player.gold=123;state.deeds.silverSeal=true;state.jobsTaken.add('veyrane-ledger');writeSave();});
      await page.reload();await page.waitForFunction(()=>window.R3D&&LEVEL);await page.click('#continue');await page.waitForFunction(()=>state.running&&state.mode==='field');
      const saved=await page.evaluate(()=>({gold:state.player.gold,seal:state.deeds.silverSeal,job:state.jobsTaken.has('veyrane-ledger'),v:Math.hypot(state.player.vx,state.player.vy)}));
      assert.deepEqual(saved,{gold:123,seal:true,job:true,v:0});
    });
    await record('battle attack feedback and return to 3D',async()=>{
      await page.evaluate(async()=>{await enterDistrict('crown-estate','start',{save:false});startBattle(state.guards[0]);B.intro=0;B.party[0].atb=100;B.enemies.forEach(e=>e.atb=0);});
      await page.waitForFunction(()=>B.menu && B.menu.stage==='command');
      await page.keyboard.press('Enter');await page.waitForTimeout(60);await page.keyboard.press('Enter');
      await page.waitForTimeout(1100);
      assert.ok(await page.evaluate(()=>B.enemies[0].hp<B.enemies[0].maxHp));
      assert.ok(await page.locator('#game').isVisible());
      await page.screenshot({path:path.join(artifacts,'battle.png')});
      await page.evaluate(()=>{B.result='run';endBattle();});await page.waitForFunction(()=>!R3D.canvas.hidden);
    });
    await record('tail vault preserves the established endpoint and resets momentum',async()=>{
      const result=await page.evaluate(()=>{state.paused=true;const v=VAULTS[0];state.player.x=v.a.x;state.player.y=v.a.y;state.player.vx=118;vaultWall(v);R3D.render(1/60);return {x:state.player.x,y:state.player.y,v:state.player.vx,expected:v.b,debug:R3D.debug()};});
      assert.equal(result.x,result.expected.x);assert.equal(result.y,result.expected.y);assert.equal(result.v,0);assert.ok(result.debug.cam.every(Number.isFinite));
      await page.evaluate(()=>{state.paused=false;});
    });
    await record('Classic view and WASD fallback',async()=>{
      await page.evaluate(async()=>{await enterDistrict('lantern','start',{save:false});SETTINGS.view='classic';});
      await page.waitForTimeout(50);assert.ok(await page.locator('#game').isVisible());
      const x=await page.evaluate(()=>state.player.x);await page.keyboard.down('a');await page.waitForTimeout(120);await page.keyboard.up('a');
      assert.ok(await page.evaluate(x=>state.player.x<x,x));
    });
    await record('mobile wheel, view drag, card and portrait rendering',async()=>{
      const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
      const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.R3D&&LEVEL);await p.click('#start');await p.waitForTimeout(500);
      await p.evaluate(()=>closeDialog());
      const wheel=await p.locator('#stick').boundingBox();
      const old=await p.evaluate(()=>({x:state.player.x,y:state.player.y}));
      await p.mouse.move(wheel.x+wheel.width/2,wheel.y+wheel.height/2);await p.mouse.down();await p.mouse.move(wheel.x+wheel.width/2,wheel.y+wheel.height*0.18);await p.waitForTimeout(300);await p.mouse.up();
      assert.ok(await p.evaluate(old=>Math.hypot(state.player.x-old.x,state.player.y-old.y)>5,old));
      const yaw=await p.evaluate(()=>R3D.heading());await p.mouse.move(150,350);await p.mouse.down();await p.mouse.move(240,350,{steps:4});await p.mouse.up();assert.ok(Math.abs(await p.evaluate(()=>R3D.heading())-yaw)>0.2);
      const cards=await p.evaluate(()=>state.player.cards);await p.locator('[data-act="card"]').tap();await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>state.player.cards),cards-1);
      await p.screenshot({path:path.join(artifacts,'mobile.png')});await mobile.close();
    });
    await record('WebGL unavailable falls back to playable Classic',async()=>{
      const fallback=await browser.newContext({viewport:{width:800,height:600}});
      await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
      const p=await fallback.newPage();await p.goto(url);await p.waitForFunction(()=>LEVEL);await p.click('#start');await p.waitForTimeout(500);await p.evaluate(()=>closeDialog());assert.ok(await p.locator('#game').isVisible());assert.equal(await p.evaluate(()=>use3D()),false);await fallback.close();
    });
    await record('unavailable ZAY asset retains a playable procedural fallback',async()=>{
      const fallback=await browser.newContext({viewport:{width:800,height:600}});
      await fallback.route('**/models/zay/shadow-rogue.glb',route=>route.fulfill({status:404,body:'Deliberately unavailable test asset'}));
      const p=await fallback.newPage(),runtime=[];p.on('pageerror',e=>runtime.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>window.R3D&&LEVEL&&R3D.hero().error);
      await p.click('#start');await p.waitForTimeout(500);await p.evaluate(()=>closeDialog());
      const before=await p.evaluate(()=>({x:state.player.x,y:state.player.y}));await p.keyboard.down('w');await p.waitForTimeout(300);await p.keyboard.up('w');
      assert.ok(await p.evaluate(old=>Math.hypot(state.player.x-old.x,state.player.y-old.y)>5,before));
      assert.ok(await p.locator('#game3d').isVisible());assert.equal(await p.evaluate(()=>R3D.hero().loaded),false);assert.deepEqual(runtime,[]);
      await fallback.close();
    });
    await record('no runtime/shader errors or failed local assets',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);});
    fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify(results,null,2));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
