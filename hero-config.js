// ZAY's presentation profile. Story, movement, collisions and combat remain in game.js.
// Replace the GLB and semantic clip names together when the final Blender model is ready.
export const HERO = {
  url: 'models/zay/shadow-rogue.glb', height: 1.3, rotationY: Math.PI / 2,
  hide: [], centerXZ: false, preserveMaterials: true,
  probeBones: { leg: 'LeftUpLeg', root: 'Hips' },
  clips: { idle: 'Idle_9', walk: 'Walking', run: 'Running', dodge: 'ZAY_Dodge', jump: 'Regular_Jump', block: 'Block6',
    throw: 'ZAY_CardThrow', attack: 'Boxing_Guard_Right_Straight_Kick', interact: 'ZAY_Interact' },
  rootMotionNodes: ['Hips'], fade: 0.18,
  footBones: ['LeftFoot', 'RightFoot'],   // used to match the walk and run clips to ZAY's real speed, so his feet don't slide
  runAbove: 78,   // px a second. His walk clip only covers about 35 px/s, so normal movement (118) uses the run clip at an easy pace
  durations: { dodge: 0.3, jump: 0.72, block: 0.5, throw: 0.45, attack: 0.55, interact: 0.8 }
};
