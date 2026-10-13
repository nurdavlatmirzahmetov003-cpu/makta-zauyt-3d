// Post-processing for the «Жоғары» preset: a half-resolution UnrealBloom (strong at night, a subtle
// glint by day). Other presets render directly, so iPad «Орташа» pays nothing for it.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createPost(renderer, scene, camera) {
  let composer = null, bloom = null, enabled = false, night = 0;
  const size = new THREE.Vector2();

  function build() {
    renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x * pr / 2, size.y * pr / 2), 0.3, 0.55, 1);
    // Half resolution: the bright pass and its blur mips run at half the drawing-buffer size.
    const setSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    tune();
  }
  function tune() {
    if (!bloom) return;
    bloom.strength = 0.16 + 0.62 * night;
    bloom.threshold = 1.05 - 0.4 * night;
    bloom.radius = 0.45 + 0.2 * night;
  }

  return {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      if (on && !composer) build();
      if (on) this.resize();
    },
    setNight(k) { night = k; tune(); },
    resize() {
      if (!composer) return;
      renderer.getSize(size);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(size.x, size.y);
    },
    render(dt) {
      if (enabled) composer.render(dt);
      else renderer.render(scene, camera);
    },
  };
}
