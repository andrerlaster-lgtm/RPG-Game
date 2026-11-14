// ZAY's presentation profile. Story, movement, collisions and combat remain in game.js.
// Replace the GLB and semantic clip names together when the final Blender model is ready.
export const HERO = {
  url: 'models/zay/shadow-rogue.glb', height: 1.3, rotationY: Math.PI / 2,
  hide: [], centerXZ: false, preserveMaterials: true,
  probeBones: { leg: 'LeftUpLeg', root: 'Hips' },
  clips: { idle: 'Idle_9', walk: 'Walking', run: 'Running', dodge: 'ZAY_Dodge',
    throw: 'ZAY_CardThrow', attack: 'Boxing_Guard_Right_Straight_Kick', interact: 'ZAY_Interact' },
  rootMotionNodes: ['Hips'], fade: 0.18,
  durations: { dodge: 0.17, throw: 0.45, attack: 0.55, interact: 0.8 }
};
