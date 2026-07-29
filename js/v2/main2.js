// v2 디렉터 — WeBlock 플래그십 빌딩 (서막→건설→완공→조각화→CTA)
import * as THREE from 'three';
import { createBackdrop, buildEnvironment, createFloor, createDust } from './stage.js';
import {
  createFins, createHull, createRibbon, createInterior, createMedallion,
  createFractions, createToken, DONE_X, roofAt, depthAt,
} from './building.js';
import { createSparks, createComposer } from '../fx.js';
import { clamp, lerp, sat, span as sp, smoothstep, easeInOutSine, easeOutCubic, easeOutExpo, fmtKR } from '../util.js';

const SNAP = /[?&]snap/.test(location.search);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 820px)').matches;

// ---------------------------------------------------------------- 부트
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(SNAP ? 1 : Math.min(devicePixelRatio, MOBILE ? 1.7 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.localClippingEnabled = true;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 2, 9000);
camera.position.set(500, 150, 500);

const envMap = buildEnvironment(renderer);

const backdrop = createBackdrop();
const floor = createFloor();
const dust = createDust();
const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 300);
const fins = createFins(envMap);
const hull = createHull(envMap);
hull.mesh.material.clippingPlanes = [clipPlane];
const ribbon = createRibbon(envMap);
ribbon.mesh.material.clippingPlanes = [clipPlane];
const interior = createInterior(envMap);
const medallion = createMedallion(envMap);
const fractions = createFractions();
const token = createToken(envMap);
const sparks = createSparks();
// 건설 '프린팅 헤드' 광선 바
const barTexC = document.createElement('canvas'); barTexC.width = 64; barTexC.height = 256;
{
  const g = barTexC.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, 'rgba(160,120,255,0)');
  gr.addColorStop(0.5, 'rgba(220,200,255,1)');
  gr.addColorStop(1, 'rgba(160,120,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
}
const barMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(barTexC), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const printBar = new THREE.Sprite(barMat);
dust.mesh.layers.set(1);
camera.layers.enable(1);
scene.add(
  backdrop.mesh, floor.group, dust.mesh,
  interior.group, hull.mesh, fins.mesh, ribbon.mesh, medallion.group,
  fractions.mesh, token.group, sparks.mesh, printBar
);

// 스튜디오 라이트
const key = new THREE.DirectionalLight(0xdfe8ff, 1.15);
key.position.set(-700, 600, 700);
const rim = new THREE.DirectionalLight(0x8a5cff, 1.05);
rim.position.set(500, 260, -700);
const warm = new THREE.DirectionalLight(0xffc27d, 0.95);
warm.position.set(600, 180, 500);
const fill = new THREE.HemisphereLight(0x2a3050, 0x07060a, 0.7);
scene.add(key, rim, warm, fill);

const post = createComposer(renderer, scene, camera);
post.bloom.strength = 0.42;
post.bloom.threshold = 0.86;

// ---------------------------------------------------------------- 무드
const C = (h) => new THREE.Color(h);
const MOODS = [
  { zen: C(0x020208), hor: C(0x140d2a), glow: C(0x2a1758), gI: 0.55, stars: 0.55, exp: 1.0, mirror: 0.6 },
  { zen: C(0x020207), hor: C(0x100a20), glow: C(0x23124a), gI: 0.4, stars: 0.7, exp: 0.98, mirror: 0.64 },
  { zen: C(0x030310), hor: C(0x1c1128), glow: C(0x4a2450), gI: 0.68, stars: 0.45, exp: 1.03, mirror: 0.22 },
  { zen: C(0x020209), hor: C(0x0e0a22), glow: C(0x33176a), gI: 0.8, stars: 0.8, exp: 1.0, mirror: 0.5 },
  { zen: C(0x050414), hor: C(0x201435), glow: C(0x4c2a7e), gI: 0.82, stars: 0.4, exp: 1.04, mirror: 0.26 },
  { zen: C(0x050414), hor: C(0x201435), glow: C(0x4c2a7e), gI: 0.82, stars: 0.4, exp: 1.04, mirror: 0.26 },
];
const moodNow = { zen: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(), gI: 0, stars: 0, exp: 1, mirror: 0.6 };
function evalMood(T) {
  const i = clamp(Math.floor(T), 0, 4);
  const t = easeInOutSine(sat(T - i));
  const A = MOODS[i], B = MOODS[i + 1];
  moodNow.zen.copy(A.zen).lerp(B.zen, t);
  moodNow.hor.copy(A.hor).lerp(B.hor, t);
  moodNow.glow.copy(A.glow).lerp(B.glow, t);
  moodNow.gI = lerp(A.gI, B.gI, t);
  moodNow.stars = lerp(A.stars, B.stars, t);
  moodNow.exp = lerp(A.exp, B.exp, t);
  moodNow.mirror = lerp(A.mirror, B.mirror, t);
  return moodNow;
}

// ---------------------------------------------------------------- 카메라 궤도 릭
function crScalar(keys, T) {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && T >= keys[i + 1][0]) i++;
  const k0 = keys[Math.max(i - 1, 0)][1];
  const k1 = keys[i][1];
  const k2 = keys[i + 1][1];
  const k3 = keys[Math.min(i + 2, n - 1)][1];
  const t = sat((T - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * k1) + (-k0 + k2) * t + (2 * k0 - 5 * k1 + 4 * k2 - k3) * t2 + (-k0 + 3 * k1 - 3 * k2 + k3) * t3);
}
// 전면 = +z (az ≈ π/2). CTA까지 한 바퀴 돌아 전면으로 복귀
const K_AZ = [[0, 0.95], [1, 1.3], [1.5, 1.52], [2, 1.85], [2.5, 2.3], [3, 2.9], [3.55, 3.5], [4, 5.0], [4.5, 6.4], [5, 7.35]];
const K_DIST = [[0, 1000], [1, 520], [1.5, 470], [2, 480], [2.5, 780], [3, 880], [3.55, 900], [4, 560], [5, 880]];
const K_H = [[0, 180], [1, 55], [1.5, 95], [2, 110], [2.5, 230], [3, 260], [3.55, 260], [4, 150], [5, 165]];
const K_TY = [[0, 88], [1, 55], [1.5, 70], [2, 82], [2.5, 85], [3, 92], [3.55, 96], [4, 85], [5, 78]];
const K_TX = [[0, 0], [1, -150], [1.4, -60], [1.8, 110], [2, 30], [3, 0], [4, 0], [5, -20]];
const K_FOV = [[0, 40], [1, 46], [2, 44], [3, 42], [3.55, 44], [4, 44], [5, 42]];

// ---------------------------------------------------------------- 스크롤 → 타임라인
const sections = [...document.querySelectorAll('section.ch')];
let secTop = [], secLen = [];
function measure() {
  secTop = sections.map((s) => s.offsetTop);
  secLen = sections.map((s) => Math.max(s.offsetHeight - innerHeight, 1));
}
function scrollToT() {
  const y = scrollY;
  let T = 0;
  for (let i = 0; i < sections.length; i++) {
    if (y >= secTop[i]) T = i + sat((y - secTop[i]) / secLen[i]);
  }
  return Math.min(T, 4.9999);
}
let targetT = 0, T = 0;
window.__seek = (t) => {
  t = clamp(t, 0, 4.999);
  const i = clamp(Math.floor(t), 0, 4);
  scrollTo(0, secTop[i] + (t - i) * secLen[i]);
  targetT = T = t;
};

// ---------------------------------------------------------------- UI
const copies = sections.map((s) => s.querySelector('.copy'));
const railLinks = [...document.querySelectorAll('.rail a')];
const counters = {};
document.querySelectorAll('[data-c]').forEach((el) => (counters[el.dataset.c] = el));
const FADE = [
  [-1, 0.0001, 0.5, 0.78],
  [0.05, 0.16, 0.86, 0.97],
  [0.08, 0.2, 0.84, 0.97],
  [0.05, 0.16, 0.86, 0.97],
  [0.1, 0.3, 2, 3],
];
function set(k, v) { if (counters[k]) counters[k].textContent = v; }
function uiUpdate() {
  const li = clamp(Math.floor(T), 0, 4);
  for (let i = 0; i < copies.length; i++) {
    const el = copies[i]; if (!el) continue;
    const l = sat(T - i);
    const [a, b, c2, d] = FADE[i];
    const vIn = sp(l, a, b), vOut = 1 - sp(l, c2, d);
    const o = vIn * vOut;
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translateY(${((1 - vIn) * 30 - (1 - vOut) * 26).toFixed(2)}px)`;
    el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
  }
  railLinks.forEach((lnk, i) => lnk.classList.toggle('on', i === li));
  set('prog', Math.round(sat((state.buildX + 260) / (DONE_X + 260)) * 100));
  set('frag', fmtKR(100000 * easeOutExpo(sp(T, 3.28, 3.92))));
}

// ---------------------------------------------------------------- 프레임 상태
const state = {
  buildX: -260, frontier: 0, holo: 0, ghost: 0,
  scanX: -300, scanI: 0, shatter: 0, ringRot: 0, edgeGlow: 0,
  interiorI: 0, logoLit: 0,
  tokScale: 0, tokAlpha: 1, tokPos: new THREE.Vector3(),
  sparkRate: 0,
};
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
const sparkEmit = () => {
  const bx = state.buildX;
  const side = Math.random() > 0.5 ? 1 : -1;
  const h = roofAt(clamp(bx, -235, 235));
  return [bx - 4, 4 + Math.random() * (h - 8), side * depthAt(clamp(bx, -235, 235)) * (0.65 + Math.random() * 0.4)];
};

function director(t, dt) {
  // 서막 홀로그램
  state.holo = sp(T, 0.2, 0.6) * (1 - sp(T, 0.85, 1.02));

  // 건설: 좌→우 스윕 (루버 조립 + 리본 결정화)
  const bp = easeInOutSine(sp(T, 1.05, 1.95));
  state.buildX = T < 1 ? -260 : T >= 2 ? DONE_X : lerp(-260, DONE_X, bp);
  state.frontier = sp(T, 1.05, 1.15) * (1 - sp(T, 1.9, 2.0));
  state.sparkRate = REDUCED ? 0 : state.frontier * (state.buildX > -230 && state.buildX < 245 ? 1.3 : 0);

  // 완공: 인테리어 점등 + 메달리온
  const lightsOn = easeInOutSine(sp(T, 2.12, 2.6));
  state.logoLit = sp(T, 2.4, 2.7);
  state.interiorI = lightsOn * (1 - sp(T, 3.2, 3.6) * 0.85) + sp(T, 4.15, 4.6) * 0.85;
  state.interiorI = Math.min(state.interiorI, 1);

  // 조각화 (+ CTA 재결합)
  state.scanI = sp(T, 3.02, 3.1) * (1 - sp(T, 3.5, 3.6));
  state.scanX = lerp(-290, 300, easeInOutSine(sp(T, 3.02, 3.6)));
  state.shatter = sp(T, 3.12, 3.92) * (1 - easeInOutSine(sp(T, 4.08, 4.55)));
  state.ghost = sp(T, 3.25, 3.85) * (1 - sp(T, 4.12, 4.55));
  state.edgeGlow = sp(T, 3.18, 3.5) * (1 - sp(T, 4.2, 4.55));
  state.ringRot += dt * (0.1 + smoothstep(0.2, 0.8, state.shatter) * 0.22);

  // 무드
  const M = evalMood(T);
  backdrop.u.uZen.value.copy(M.zen);
  backdrop.u.uHor.value.copy(M.hor);
  backdrop.u.uGlow.value.copy(M.glow);
  backdrop.u.uGlowI.value = M.gI;
  backdrop.u.uStars.value = M.stars;
  backdrop.u.uTime.value = t;
  renderer.toneMappingExposure = M.exp;
  floor.overlayU.uFade.value = M.mirror;
  floor.ringMat.opacity = 0;
  dust.u.uTime.value = t;
  dust.u.uStr.value = 0.32 + smoothstep(0.1, 0.9, state.shatter) * 0.45;

  // 카메라
  const az = crScalar(K_AZ, T);
  const dist = crScalar(K_DIST, T);
  let hgt = crScalar(K_H, T);
  let tx = crScalar(K_TX, T);
  const ty = crScalar(K_TY, T);
  if (T > 1.05 && T < 2.0) {
    const k2 = smoothstep(1.05, 1.3, T) * (1 - sp(T, 1.9, 2.0));
    tx = lerp(tx, clamp(state.buildX * 0.7, -180, 180), k2 * 0.7);
  }
  camera.position.set(tx * 0.4 + Math.cos(az) * dist, hgt, Math.sin(az) * dist);
  if (!REDUCED) {
    camera.position.x += Math.sin(t * 0.3) * 1.2;
    camera.position.y += Math.sin(t * 0.22 + 2) * 0.9;
  }
  tmpB.set(tx, ty, 0);
  camera.lookAt(tmpB);
  const fv = crScalar(K_FOV, T);
  if (Math.abs(camera.fov - fv) > 0.01) { camera.fov = fv; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();

  // 히어로 토큰
  const tokIn = easeOutCubic(sp(T, 3.5, 3.78));
  const tokOut = easeInOutSine(sp(T, 4.05, 4.35));
  state.tokScale = tokIn * (1 - tokOut) * (MOBILE ? 0.82 : 1);
  state.tokAlpha = sat(tokIn * (1 - tokOut));
  if (state.tokScale > 0.001) {
    const f = tmpA.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const r = tmpC.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmpD.copy(camera.position).addScaledVector(f, 280).addScaledVector(r, MOBILE ? 0 : -80);
    tmpD.y += MOBILE ? 56 : 6;
    state.tokPos.copy(tmpD);
  }
  token.group.visible = state.tokScale > 0.001;
  if (token.group.visible) {
    token.group.position.copy(state.tokPos);
    token.group.scale.setScalar(state.tokScale);
    token.group.rotation.y = t * 0.5;
    token.group.rotation.x = Math.sin(t * 0.7) * 0.08;
    token.mats.forEach((mm) => (mm.opacity = state.tokAlpha));
  }

  // 빌딩 유니폼 라우팅
  const revealX = state.holo > 0.005 ? DONE_X : state.buildX;
  clipPlane.constant = revealX;
  hull.u.uBuild.value = revealX;
  hull.u.uTime.value = t;
  hull.u.uGhost.value = state.ghost;
  hull.u.uHolo.value = state.holo;
  const building = T < 2.05;
  hull.u.uScanX.value = building ? state.buildX : state.scanX;
  hull.u.uScanI.value = Math.max(state.scanI, state.frontier * 0.5);
  hull.mesh.visible = state.buildX > -255 || state.holo > 0.005;
  hull.mesh.material.opacity = 0.44 + state.holo * 0.18;
  ribbon.u.uBuild.value = revealX;
  ribbon.mat.opacity = (1 - state.ghost * 0.75) * (state.holo > 0.005 ? 0.55 : 1);
  ribbon.mat.emissive.setRGB(0.11 + state.holo * 0.22, 0.07 + state.holo * 0.13, 0.02 + state.holo * 0.5);
  ribbon.mesh.visible = state.buildX > -255 || state.holo > 0.005;
  fins.update(state.buildX, state.holo, state.ghost, t);
  interior.update(state.interiorI * (1 - state.holo));
  medallion.update(state.logoLit, Math.max(state.ghost, state.holo * 0.7));
  medallion.group.visible = state.buildX > -120 || state.holo > 0.005;

  const fu = fractions.u;
  fu.uTime.value = t;
  fu.uShatter.value = state.shatter;
  fu.uRingRot.value = state.ringRot;
  fu.uEdge.value = state.edgeGlow;
  fractions.mesh.visible = state.shatter > 0.001;

  sparks.update(dt, t, state.sparkRate, sparkEmit);
  const barH = roofAt(clamp(state.buildX, -235, 235)) + 26;
  printBar.position.set(state.buildX - 1, barH / 2, 0);
  printBar.scale.set(16, barH, 1);
  barMat.opacity = state.frontier * 0.55;
  printBar.visible = barMat.opacity > 0.01 && state.buildX > -250 && state.buildX < 260;
  post.bloom.strength = 0.4 + state.scanI * 0.1 + state.logoLit * 0.06 + state.holo * 0.06;
  post.grade.uniforms.uTime.value = t;
}

// ---------------------------------------------------------------- 루프
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loaderBar');
if (loaderBar) loaderBar.style.width = '45%';
let started = false, frames = 0, fps = 60, lastFpsT = 0;
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  targetT = scrollToT();
  const k = SNAP || REDUCED ? 1 : 1 - Math.exp(-dt * 5.2);
  T += (targetT - T) * k;
  director(t, dt);
  uiUpdate();
  post.composer.render();
  frames++;
  if (t - lastFpsT > 1) { fps = frames / (t - lastFpsT); frames = 0; lastFpsT = t; }
  if (!started) {
    started = true;
    if (loaderBar) loaderBar.style.width = '100%';
    document.fonts.ready.then(() => {
      token.redraw();
      medallion.redraw();
      setTimeout(() => { loader.classList.add('hide'); window.__ready = true; }, 150);
    });
  }
}
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
  measure();
}
addEventListener('resize', resize);
measure();
resize();
window.__info = () => ({ T: +T.toFixed(3), fps: +fps.toFixed(1), bx: +state.buildX.toFixed(0) });
window.__probe = () => ({ scale: +state.tokScale.toFixed(3) });
if (SNAP) window.__objs = { ribbon: ribbon.mesh, hull: hull.mesh, fins: fins.mesh, interior: interior.group, printBar, dust: dust.mesh, mirror: floor.group };
frame();
