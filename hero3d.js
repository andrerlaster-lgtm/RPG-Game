// ZAY's replaceable visual rig. Gameplay position, collisions and story live outside this module.
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/addons/GLTFLoader.js';
export const HERO = {
  url: 'models/zay/zay-mock.glb', height: 1.3, rotationY: Math.PI / 2,
  hide: [], centerXZ: false, preserveMaterials: true, probeBones: { leg: 'thigh_l', root: 'Root' },
  clips: { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', dodge: 'Dodge_Forward', throw: 'Throw', attack: 'Dualwield_Melee_Attack_Slice', interact: 'Interact' },
  // Clips should be in place. Add root-node names here for custom files with horizontal root motion.
  rootMotionNodes: ['Root'], fade: 0.16,
  durations: { dodge: 0.17, throw: 0.45, attack: 0.55 }
};
export async function loadHero(config = HERO) {
  const gltf = await new GLTFLoader().loadAsync(config.url);
  const model = gltf.scene;
  config.hide.forEach(name => { const o = model.getObjectByName(name); if (o) o.visible = false; });
  model.updateMatrixWorld(true);
  // Measure only the visible skinned body; hidden weapons must not affect normalization.
  const box = new THREE.Box3();
  model.traverseVisible(o => { if (o.isSkinnedMesh) box.union(new THREE.Box3().setFromObject(o)); });
  if (box.isEmpty() || box.getSize(new THREE.Vector3()).y <= 0) throw new Error('Character has no skinned body');
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
  let current = null, shot = null, remaining = 0, lastDash = false;
  function transition(role, once = false, duration = 0) {
    const next = actions[role]; if (!next || (next === current && !once)) return;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once; next.play();
    if (once && duration) next.setEffectiveTimeScale(next.getClip().duration / duration);
    if (current && current !== next) next.crossFadeFrom(current, once ? Math.min(config.fade, duration * 0.35) : config.fade, false);
    current = next;
  }
  const controller = {
    group,
    play(role) { if (!actions[role]) return; shot = role; remaining = config.durations?.[role] || actions[role].getClip().duration; transition(role, true, remaining); },
    reset() { mixer.stopAllAction(); current = shot = null; remaining = 0; lastDash = false; transition('idle'); },
    update(dt, speed, p) {
      const dash = p.dashT > 0;
      if (dash && !lastDash) this.play('dodge'); lastDash = dash;
      if (shot) { remaining -= dt; if (remaining <= 0) shot = null; }
      if (!shot) {
        const role = speed < 8 ? 'idle' : speed > 145 ? 'run' : 'walk';
        transition(role);
        current.setEffectiveTimeScale(role === 'idle' ? 1 : THREE.MathUtils.clamp(speed / (role === 'run' ? 185 : 118), 0.35, 1.4));
      }
      mixer.update(dt);
    },
    debug() { return { loaded: true, url: config.url, clip: current?.getClip().name, clips: Object.keys(actions), weights: Object.fromEntries(Object.entries(actions).map(([k,a])=>[k,a.getEffectiveWeight()])), leg: model.getObjectByName(config.probeBones?.leg || 'upperlegl')?.quaternion.toArray(), root: model.getObjectByName(config.probeBones?.root || 'root')?.position.toArray(), time: current?.time }; }
  };
  model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.receiveShadow = true; if (!config.preserveMaterials) o.material.roughness = 0.95; } });
  group.userData.rig = controller;
  controller.reset();
  return controller;
}
