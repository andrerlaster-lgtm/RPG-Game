// The finishing pass for the 3D view: bloom (lanterns and windows glow into the air), a gentle colour grade
// (cool shadows, warm highlights), a vignette and a red edge when guards are on you. Built on the Three.js
// post-processing add-ons in vendor/three/addons. It is optional: on the Low graphics setting, or if the
// device can't make the buffers, render3d.js draws straight to the screen instead.
import * as THREE from './vendor/three/three.module.min.js';
import { EffectComposer } from './vendor/three/addons/EffectComposer.js';
import { RenderPass } from './vendor/three/addons/RenderPass.js';
import { ShaderPass } from './vendor/three/addons/ShaderPass.js';
import { UnrealBloomPass } from './vendor/three/addons/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/addons/OutputPass.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uAlert: { value: 0 }, uHidden: { value: 0 }, uVignette: { value: 1 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uAlert, uHidden, uVignette; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, c * vec3(0.9, 0.98, 1.14), 1.0 - smoothstep(0.0, 0.3, l));       // cool, slightly lifted shadows
      c = mix(c, c * vec3(1.08, 1.0, 0.9), smoothstep(0.25, 1.1, l));             // warm highlights
      c = mix(vec3(l), c, 1.1 - uHidden * 0.25);                                  // a touch more colour; less when hidden
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.86);
      float v = smoothstep(0.86, 0.28, length(q));
      c *= mix(1.0 - 0.42 * uVignette - uHidden * 0.12, 1.0, v);
      c += vec3(0.55, 0.05, 0.03) * uAlert * (1.0 - v) * 0.7;
      gl_FragColor = vec4(c, 1.0);
    }`
};

export function makePost(renderer, scene, camera) {
  let composer = null, bloom = null, grade = null, samples = -1;
  function build(msaa) {
    dispose();
    try {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: msaa });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.34, 0.7, 0.92);
      composer.addPass(bloom);
      grade = new ShaderPass(GradeShader);
      composer.addPass(grade);
      composer.addPass(new OutputPass());
      samples = msaa;
    } catch { composer = null; }
  }
  function dispose() {
    if (!composer) return;
    composer.passes.forEach((p) => p.dispose && p.dispose());
    composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
    composer = bloom = grade = null; samples = -1;
  }
  return {
    get on() { return !!composer; },
    /** Turn the pass on (with `msaa` samples of edge smoothing) or off. */
    set(on, msaa = 0) { if (!on) dispose(); else if (!composer || samples !== msaa) build(msaa); },
    resize(w, h, pixelRatio) { if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(w, h); } },
    render(dt, { alert = 0, hidden = 0 } = {}) {
      grade.uniforms.uAlert.value = alert; grade.uniforms.uHidden.value = hidden;
      composer.render(dt);
    }
  };
}
