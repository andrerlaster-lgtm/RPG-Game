// ZAY's replaceable visual rig. Gameplay position, collisions and story live outside this module.
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/addons/GLTFLoader.js';
import { HERO } from './hero-config.js';
export { HERO };
export async function loadHero(config = HERO) {
  const gltf = await new GLTFLoader().loadAsync(config.url);
  const model = gltf.scene;
  config.hide.forEach(name => { const o = model.getObjectByName(name); if (o) o.visible = false; });
  // Evaluate the configured idle before measuring: exported files may open mid-action.
  const measureMixer = new THREE.AnimationMixer(model);
  const idleClip = THREE.AnimationClip.findByName(gltf.animations, config.clips.idle);
  if (idleClip) { measureMixer.clipAction(idleClip).play(); measureMixer.update(0); }
  model.updateMatrixWorld(true);
  // Measure only the visible skinned body; hidden weapons must not affect normalization.
  const box = new THREE.Box3();
  model.traverseVisible(o => { if (o.isSkinnedMesh) box.union(new THREE.Box3().setFromObject(o)); });
  if (box.isEmpty() || box.getSize(new THREE.Vector3()).y <= 0) throw new Error('Character has no skinned body');
  measureMixer.stopAllAction(); measureMixer.uncacheRoot(model);
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const scale = config.height / size.y;
  const pivot = new THREE.Group(); pivot.rotation.y = config.rotationY; pivot.scale.setScalar(scale);
  model.position.set(config.centerXZ === false ? 0 : -centre.x, -box.min.y, config.centerXZ === false ? 0 : -centre.z); pivot.add(model);
  const group = new THREE.Group(); group.add(pivot);
  const mixer = new THREE.AnimationMixer(model), actions = {};
  for (const [role, name] of Object.entries(config.clips)) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) { if (['idle', 'walk', 'run'].includes(role)) throw new Error(`Missing ${role} animation: ${name}`); continue; }
    const local = clip.clone();
    for (const track of local.tracks) if (config.rootMotionNodes.some(n => track.name === n + '.position')) {
      // Retain vertical footwork, but gameplay owns horizontal movement and collision.
      for (let i = 3; i < track.values.length; i += 3) { track.values[i] = track.values[0]; track.values[i + 2] = track.values[2]; }
    }
    actions[role] = mixer.clipAction(local);
  }
  // How fast each walking clip really carries him (map px a second at normal playback), measured from the clip
  // itself: while a foot is on the ground it moves backwards under the body at exactly the body's speed.
  // update() plays the clip at speed / this, so the feet stay planted instead of sliding.
  const natural = {};
  const feet = (config.footBones || []).map(n => model.getObjectByName(n)).filter(Boolean);
  if (feet.length) {
    const probe = new THREE.AnimationMixer(model), at = new THREE.Vector3();
    for (const role of ['walk', 'run']) {
      const clip = actions[role]?.getClip(); if (!clip) continue;
      const act = probe.clipAction(clip); act.play();
      const N = 48, track = feet.map(() => []);
      for (let i = 0; i <= N; i++) {
        probe.setTime(clip.duration * i / N); group.updateMatrixWorld(true);
        feet.forEach((f, k) => { f.getWorldPosition(at); track[k].push([at.x, at.y]); });
      }
      act.stop();
      // every moment a foot is travelling backwards, it is (nearly always) on the ground: take the middle speed
      const back = [];
      for (const t of track) for (let i = 0; i < N; i++) { const v = (t[i][0] - t[i + 1][0]) / (clip.duration / N); if (v > 0) back.push(v); }
      back.sort((p, q) => p - q);
      const mid = back[Math.floor(back.length * 0.7)] || 0;
      if (mid > 0.2) natural[role] = mid * (config.pxPerUnit || 32);
    }
    probe.stopAllAction(); probe.uncacheRoot(model);
  }
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), config.rotationY), poseQ = new THREE.Quaternion(), poseE = new THREE.Euler(0, 0, 0, 'XZY');
  const ROLL_C = config.height * 0.3;   // the roll turns about his tucked middle, not his feet
  let current = null, currentRole = null, shot = null, remaining = 0, lastDash = false;
  function transition(role, once = false, duration = 0) {
    const next = actions[role]; if (!next || (next === current && !once)) return;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once; next.play();
    if (once && duration) next.setEffectiveTimeScale(next.getClip().duration / duration);
    if (current && current !== next) next.crossFadeFrom(current, once ? Math.min(config.fade, duration * 0.35) : config.fade, false);
    current = next; currentRole = role;
  }
  const controller = {
    group,
    setShadowCaster(enabled) { model.traverse(o => { if (o.isMesh) o.castShadow = enabled; }); },
    play(role) { if (!actions[role]) return; shot = role; remaining = config.durations?.[role] || actions[role].getClip().duration; transition(role, true, remaining); },
    reset() { mixer.stopAllAction(); current = shot = null; remaining = 0; lastDash = false; transition('idle'); },
    /** Where the body sits this frame: lift (height off the ground), roll (radians tumbled forward), bank and lean (radians, into a turn / into a run). */
    pose({ lift = 0, roll = 0, bank = 0, lean = 0 } = {}) {
      pivot.position.set(-ROLL_C * Math.sin(roll), lift + ROLL_C * (1 - Math.cos(roll)), 0);
      pivot.quaternion.setFromEuler(poseE.set(bank, 0, -roll - lean)).multiply(yawQ);
    },
    update(dt, speed, p) {
      const dash = p.dashT > 0;
      if (dash && !lastDash) this.play('dodge'); lastDash = dash;
      if (shot) { remaining -= dt; if (remaining <= 0) shot = null; }
      if (!shot) {
        const role = speed < 8 ? 'idle' : speed > (config.runAbove ?? 145) ? 'run' : 'walk';
        transition(role);
        current.setEffectiveTimeScale(role === 'idle' ? 1 : THREE.MathUtils.clamp(speed / (natural[role] || (role === 'run' ? 185 : 118)), 0.35, 1.7));
      }
      mixer.update(dt);
    },
    debug() { return { loaded: true, url: config.url, role: currentRole, natural, lift: pivot.position.y, materials: materialInfo, clip: current?.getClip().name, clips: Object.keys(actions), weights: Object.fromEntries(Object.entries(actions).map(([k,a])=>[k,a.getEffectiveWeight()])), leg: model.getObjectByName(config.probeBones?.leg || 'upperlegl')?.quaternion.toArray(), root: model.getObjectByName(config.probeBones?.root || 'root')?.position.toArray(), time: current?.time }; }
  };
  const materialInfo = [];
  model.traverse(o => { if (o.isMesh) {
    for (const m of [o.material].flat()) materialInfo.push({ name: m.name, base: !!m.map, normal: !!m.normalMap, roughness: !!m.roughnessMap, metalness: !!m.metalnessMap, emissive: m.emissiveIntensity && m.emissive?.getHex() });
    o.castShadow = true; o.frustumCulled = false; o.receiveShadow = true; if (!config.preserveMaterials) o.material.roughness = 0.95; } });
  group.userData.rig = controller;
  controller.reset();
  return controller;
}
