// «Маржан» — a small friendly flying guide robot: rounded white body, glowing teal face screen with
// animated eyes, gold cotton-boll emblem, little arms, a hover thruster glow and a headlight.
// Faces +Z. Reused by the robots page (Phase 13).
import * as THREE from 'three';
import { PALETTE } from '../data.js';

export function makeMarzhan() {
  const g = new THREE.Group();
  g.name = 'marzhan';
  const white = new THREE.MeshStandardMaterial({ color: '#fbfcfc', roughness: 0.22, metalness: 0.1 });
  const screen = new THREE.MeshStandardMaterial({ color: '#0b2226', roughness: 0.15, metalness: 0.4, emissive: '#0a3a3a', emissiveIntensity: 0.6 });
  const glow = new THREE.MeshBasicMaterial({ color: '#5ff5df', toneMapped: false });
  const gold = new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.3, metalness: 0.8, emissive: PALETTE.gold, emissiveIntensity: 0.15 });
  const cotton = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.9, emissive: '#fffaf0', emissiveIntensity: 0.15 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 40, 28).scale(1, 0.95, 0.92), white);
  body.castShadow = true;
  g.add(body);
  // Face screen: the front cap of a slightly larger sphere.
  // phi centred on π/2 → the cap faces +Z; theta 0.24π…0.58π spans the upper half of the body.
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.565, 40, 20, Math.PI / 2 - Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.24, Math.PI * 0.34), screen);
  g.add(face);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), glow);
    e.position.set(sx * 0.15, 0.08, 0.572);
    e.rotation.y = sx * 0.26;
    g.add(e);
    eyes.push(e);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.016, 6, 24, Math.PI), glow);
  smile.position.set(0, -0.06, 0.572);
  smile.rotation.z = Math.PI;
  g.add(smile);
  // Antennas with gold tips.
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8), white);
    a.position.set(sx * 0.28, 0.56, 0);
    a.rotation.z = -sx * 0.35;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), gold);
    tip.position.set(sx * 0.32, 0.67, 0);
    g.add(a, tip);
  }
  // Gold cotton-boll emblem on the chest.
  const emblem = new THREE.Group();
  emblem.add(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 24), gold));
  for (const [x, y] of [[0, 0.03], [-0.035, -0.02], [0.035, -0.02]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), cotton);
    b.position.set(x, y, 0.01);
    emblem.add(b);
  }
  emblem.position.set(0, -0.3, 0.43);
  emblem.rotation.x = -0.45;
  g.add(emblem);
  // Little arms (pivot at the shoulder) for gestures.
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.52, -0.08, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 10).translate(0, -0.16, 0), white);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), gold);
    hand.position.y = -0.34;
    pivot.add(arm, hand);
    pivot.rotation.z = sx * 0.35;
    g.add(pivot);
    arms.push(pivot);
  }
  // Hover thruster: a ring and a soft glowing cone under the body.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 28).rotateX(Math.PI / 2), gold);
  ring.position.y = -0.53;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 24, 1, true).rotateX(Math.PI).translate(0, -0.9, 0),
    new THREE.MeshBasicMaterial({ color: '#7ffbe9', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  g.add(ring, flame);
  // Headlight (night): a small lens and a forward light cone.
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshBasicMaterial({ color: '#fff4d0', toneMapped: false }));
  lens.position.set(0, 0.36, 0.448);
  lens.rotation.x = -0.6;
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 24, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 3.6),
    new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  beam.position.set(0, 0.36, 0.45);
  beam.rotation.x = 0.25;
  beam.visible = false;
  g.add(lens, beam);

  let blink = 0, t = 0;
  g.userData = {
    arms, eyes, flame, beam,
    /** talk: mouth/eye bounce; gesture 0…1 raises the right arm towards the object; light: headlight on. */
    update(dt, { talking = false, gesture = 0, light = false, speed = 0 } = {}) {
      t += dt;
      blink -= dt;
      if (blink < -0.12) blink = 2.5 + Math.random() * 3;
      const open = blink < 0 ? 0.15 : 1;
      for (const e of eyes) e.scale.y = open * (talking ? 1 + Math.sin(t * 9) * 0.08 : 1);
      smile.scale.set(1, talking ? 0.7 + Math.abs(Math.sin(t * 11)) * 0.6 : 1, 1);
      arms[1].rotation.z = 0.35 + gesture * 1.9 + Math.sin(t * 2.2) * 0.05;
      arms[1].rotation.x = -gesture * 0.6;
      arms[0].rotation.z = -0.35 - Math.sin(t * 2) * 0.06;
      flame.scale.set(1, 0.8 + Math.sin(t * 23) * 0.1 + speed * 0.04, 1);
      flame.material.opacity = 0.35 + Math.sin(t * 17) * 0.08;
      beam.visible = light;
      beam.material.opacity = light ? 0.16 : 0;
    },
  };
  return g;
}
