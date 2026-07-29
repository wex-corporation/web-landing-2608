// v2 디렉터 — 스튜디오 히어로 오브젝트 연출 (서막→건설→완공→조각화→CTA)
import * as THREE from 'three';
import { createBackdrop, buildEnvironment, createFloor, createDust } from './stage.js';
import { createTower2 } from './tower2.js';
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
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 2, 9000);
camera.position.set(700, 200, 700);

const envMap = buildEnvironment(renderer);
scene.environment = null; // 머티리얼별 envMap 사용

const backdrop = createBackdrop();
const floor = createFloor();
const dust = createDust();
const tower = createTower2(envMap);
const sparks = createSparks();
scene.add(backdrop.mesh, floor.group, dust.mesh, tower.group, sparks.mesh);

// 스튜디오 라이트 (PBR 보조)
const key = new THREE.DirectionalLight(0xdfe8ff, 1.1);
key.position.set(-900, 700, 650);
const rim = new THREE.DirectionalLight(0x8a5cff, 0.8);
rim.position.set(400, 350, -900);
const fill = new THREE.HemisphereLight(0x2a3050, 0x05060a, 0.5);
scene.add(key, rim, fill);

const post = createComposer(renderer, scene, camera);
post.bloom.strength = 0.42;
post.bloom.threshold = 0.86;

// ---------------------------------------------------------------- 무드 (T 경계 0..5)
const C = (h) => new THREE.Color(h);
const MOODS = [
  { zen: C(0x020208), hor: C(0x140d2a), glow: C(0x2a1758), gI: 0.55, stars: 0.55, exp: 1.0, mirror: 0.62 },
  { zen: C(0x020207), hor: C(0x100a20), glow: C(0x23124a), gI: 0.4, stars: 0.7, exp: 0.98, mirror: 0.66 },
  { zen: C(0x030310), hor: C(0x1a1030), glow: C(0x3a1e6e), gI: 0.72, stars: 0.45, exp: 1.03, mirror: 0.5 },
  { zen: C(0x020209), hor: C(0x0e0a22), glow: C(0x33176a), gI: 0.82, stars: 0.8, exp: 1.0, mirror: 0.58 },
  { zen: C(0x050414), hor: C(0x1e1438), glow: C(0x46258c), gI: 0.85, stars: 0.4, exp: 1.04, mirror: 0.5 },
  { zen: C(0x050414), hor: C(0x1e1438), glow: C(0x46258c), gI: 0.85, stars: 0.4, exp: 1.04, mirror: 0.5 },
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

// ---------------------------------------------------------------- 카메라 궤도 릭 (스칼라 CR)
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
const K_AZ = [[0, 0.55], [1, 1.3], [1.5, 1.75], [2, 2.2], [2.5, 2.6], [3, 2.95], [3.55, 3.4], [4, 3.85], [5, 4.75]];
const K_DIST = [[0, 1480], [1, 640], [1.5, 620], [2, 560], [2.5, 860], [3, 900], [3.55, 660], [4, 620], [5, 840]];
const K_H = [[0, 230], [1, 80], [1.5, 260], [2, 300], [2.5, 350], [3, 340], [3.55, 330], [4, 300], [5, 260]];
const K_TY = [[0, 255], [1, 120], [1.5, 210], [2, 268], [2.5, 280], [3, 285], [3.55, 300], [4, 285], [5, 268]];
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
  const bH = Math.min(state.buildH, 555);
  set('height', fmtKR(bH));
  set('floors', fmtKR((bH / 555) * 123));
  set('frag', fmtKR(100000 * easeOutExpo(sp(T, 3.28, 3.92))));
}

// ---------------------------------------------------------------- 프레임 상태
const state = {
  buildH: 0, frontier: 0, work: 0, assembleOn: 0,
  winLit: 0, winWave: 0, crownLit: 0, aviI: 0, beamI: 0,
  holo: 0, ghost: 0, scanY: -60, scanI: 0, seamGlow: 0,
  shatter: 0, ringRot: 0, edgeGlow: 0, panelFade: 1,
  tokScale: 0, tokAlpha: 1, tokPos: new THREE.Vector3(),
  sparkRate: 0,
};
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

function director(t, dt) {
  // 서막 홀로그램
  state.holo = sp(T, 0.2, 0.6) * (1 - sp(T, 0.85, 1.02));

  // 건설 (패널 조립)
  const bp = easeInOutSine(sp(T, 1.05, 1.95));
  state.buildH = T < 1 ? 0 : T >= 2 ? 566 : bp * 566;
  state.assembleOn = REDUCED ? 0 : sp(T, 1.0, 1.08) * (1 - sp(T, 1.97, 2.05));
  state.frontier = sp(T, 1.05, 1.15) * (1 - sp(T, 1.92, 2.0));
  state.work = state.frontier;
  state.sparkRate = REDUCED ? 0 : state.frontier * (state.buildH > 25 && state.buildH < 535 ? 0.7 : 0);

  // 완공
  state.winWave = sp(T, 2.15, 2.75) * (1 - sp(T, 2.95, 3.25));
  state.winLit =
    T < 2 ? 0 :
    T < 3 ? 0.55 * sp(T, 2.2, 2.92) :
    T < 4 ? lerp(0.55, 0.3, sp(T, 3.05, 3.45)) :
    lerp(0.3, 0.52, sp(T, 4.15, 4.65));
  state.crownLit = clamp(sp(T, 2.45, 2.8) * (1 - 0.5 * sp(T, 3.15, 3.5)) + sp(T, 4.2, 4.6) * 0.5, 0, 1);
  state.aviI = sp(T, 2.5, 2.75);
  state.beamI = sp(T, 2.45, 2.65) * (1 - sp(T, 2.9, 3.35));

  // 조각화 (+ CTA에서 재결합)
  state.scanI = sp(T, 3.02, 3.1) * (1 - sp(T, 3.5, 3.6));
  state.scanY = lerp(-40, 590, easeInOutSine(sp(T, 3.02, 3.6)));
  state.seamGlow = sp(T, 3.04, 3.28) * (1 - sp(T, 3.85, 4.2));
  state.shatter = sp(T, 3.12, 3.92) * (1 - easeInOutSine(sp(T, 4.08, 4.55)));
  state.ghost = sp(T, 3.25, 3.85) * (1 - sp(T, 4.12, 4.55));
  state.edgeGlow = Math.max(sp(T, 3.18, 3.5) * (1 - sp(T, 4.2, 4.55)), state.assembleOn * 0.8);
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
  floor.ringMat.opacity = state.holo * 0.07 + state.frontier * 0.05 + state.beamI * 0.1 + sp(T, 4.2, 4.7) * 0.05;
  dust.u.uTime.value = t;
  dust.u.uStr.value = 0.35 + smoothstep(0.1, 0.9, state.shatter) * 0.45;

  // 카메라 궤도
  const az = crScalar(K_AZ, T);
  const dist = crScalar(K_DIST, T);
  let hgt = crScalar(K_H, T);
  let ty = crScalar(K_TY, T);
  if (T > 1.08 && T < 2.0) {
    const k = smoothstep(1.08, 1.35, T) * (1 - sp(T, 1.9, 2.0));
    ty = lerp(ty, clamp(state.buildH * 0.72, 60, 430), k * 0.85);
    hgt = lerp(hgt, clamp(state.buildH * 0.88 + 40, 80, 500), k * 0.7);
  }
  camera.position.set(Math.cos(az) * dist, hgt, Math.sin(az) * dist);
  if (!REDUCED) {
    camera.position.x += Math.sin(t * 0.3) * 1.4;
    camera.position.y += Math.sin(t * 0.22 + 2) * 1.1;
  }
  tmpB.set(0, ty, 0);
  camera.lookAt(tmpB);
  const fv = crScalar(K_FOV, T);
  if (Math.abs(camera.fov - fv) > 0.01) { camera.fov = fv; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();

  // 히어로 토큰 (카메라 갱신 후)
  const tokIn = easeOutCubic(sp(T, 3.5, 3.78));
  const tokOut = easeInOutSine(sp(T, 4.05, 4.35));
  state.tokScale = tokIn * (1 - tokOut) * (MOBILE ? 0.82 : 1);
  state.tokAlpha = sat(tokIn * (1 - tokOut));
  if (state.tokScale > 0.001) {
    const f = tmpA.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const r = tmpC.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmpD.copy(camera.position).addScaledVector(f, 300).addScaledVector(r, MOBILE ? 0 : -85);
    tmpD.y += MOBILE ? 62 : 8;
    state.tokPos.copy(tmpD);
  }

  tower.update(state, t);
  sparks.update(dt, t, state.sparkRate, state.buildH);
  post.bloom.strength = 0.4 + state.beamI * 0.22 + state.scanI * 0.1 + state.holo * 0.06;
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
      tower.refreshToken();
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
window.__info = () => ({ T: +T.toFixed(3), fps: +fps.toFixed(1) });
window.__probe = () => {
  const v = state.tokPos.clone().project(camera);
  return { ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], scale: +state.tokScale.toFixed(3) };
};
frame();
