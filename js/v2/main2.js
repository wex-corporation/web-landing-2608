// v2 디렉터 — WeBlock 플래그십 (브릭 조립 → 완공 → 조각화 → CTA)
import * as THREE from 'three';
import { createBackdrop, buildEnvironment, createFloor, createDust } from './stage.js';
import { createBuilding, createToken, W_HEIGHT } from './building3.js';
import { createComposer } from '../fx.js';
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
camera.position.set(500, 150, 500);

const envMap = buildEnvironment(renderer);

const backdrop = createBackdrop();
const floor = createFloor();
const dust = createDust();
const building = createBuilding(envMap);
const token = createToken(envMap);
scene.add(backdrop.mesh, floor.group, dust.mesh, building.group, token.group);

// 스튜디오 라이트
const key = new THREE.DirectionalLight(0xfbf8ff, 2.5);
key.position.set(-620, 620, 700);
const rim = new THREE.DirectionalLight(0xa88cff, 0.35);
rim.position.set(520, 300, -650);
const warm = new THREE.DirectionalLight(0xffcc9a, 1.25);
warm.position.set(300, 260, 700);
const fill = new THREE.HemisphereLight(0x5b6480, 0x14121a, 1.5);
scene.add(key, rim, warm, fill);

const post = createComposer(renderer, scene, camera);
post.bloom.strength = 0.38;
post.bloom.threshold = 0.9;

dust.mesh.layers.set(1);
building.lamps.traverse((o) => o.layers.set(1));
camera.layers.enable(1);

// ---------------------------------------------------------------- 무드
const C = (h) => new THREE.Color(h);
const MOODS = [
  { zen: C(0x020208), hor: C(0x140d2a), glow: C(0x2a1758), gI: 0.55, stars: 0.55, exp: 1.0, mirror: 0.55 },
  { zen: C(0x030210), hor: C(0x18102c), glow: C(0x3a2060), gI: 0.6, stars: 0.6, exp: 1.0, mirror: 0.5 },
  { zen: C(0x0a0a14), hor: C(0x242030), glow: C(0xa06a44), gI: 0.72, stars: 0.35, exp: 1.1, mirror: 0.3 },
  { zen: C(0x050414), hor: C(0x201435), glow: C(0x4c2a7e), gI: 0.85, stars: 0.7, exp: 1.0, mirror: 0.45 },
  { zen: C(0x0a0a16), hor: C(0x262234), glow: C(0x94603c), gI: 0.72, stars: 0.4, exp: 1.1, mirror: 0.32 },
  { zen: C(0x0a0a16), hor: C(0x262234), glow: C(0x94603c), gI: 0.72, stars: 0.4, exp: 1.1, mirror: 0.32 },
];
const moodNow = { zen: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(), gI: 0, stars: 0, exp: 1, mirror: 0.5 };
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

// ---------------------------------------------------------------- 카메라
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
// 전면 = +z. 레퍼런스 사진과 같은 3/4 앵글(전면-우측)에서 완공 샷
const K_AZ = [[0, 1.15], [1, 1.0], [1.5, 0.86], [2, 0.72], [2.5, 0.66], [3, 0.9], [3.55, 1.4], [4, 3.4], [4.5, 5.6], [5, 7.5]];
const K_DIST = [[0, 900], [1, 620], [1.5, 640], [2, 620], [2.5, 660], [3, 820], [3.55, 920], [4, 1040], [4.5, 1150], [5, 950]];
const K_H = [[0, 185], [1, 110], [1.5, 155], [2, 170], [2.5, 165], [3, 240], [3.55, 285], [4, 235], [4.5, 250], [5, 205]];
const K_TY = [[0, 135], [1, 85], [1.5, 115], [2, 132], [2.5, 132], [3, 150], [3.55, 158], [4, 142], [5, 138]];
const K_TX = [[0, 0], [1, -40], [1.5, 0], [2, 30], [2.5, 20], [3, 0], [4, 0], [5, 0]];
const K_FOV = [[0, 40], [1, 45], [2, 43], [3, 42], [3.55, 44], [4, 44], [5, 42]];

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
const stageBadge = document.getElementById('stageBadge');
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
  set('prog', Math.round(state.prog * 100));
  set('bricks', fmtKR(Math.round(building.brickSys.count * state.prog)));
  set('frag', fmtKR(100000 * easeOutExpo(sp(T, 3.28, 3.92))));
  if (stageBadge) {
    const on = T > 1.02 && T < 2.02;
    stageBadge.style.opacity = on ? '1' : '0';
    if (on) {
      const bag = clamp(Math.floor(state.prog * 3) + 1, 1, 3);
      stageBadge.textContent = `BAG ${String(bag).padStart(2, '0')} / 03`;
    }
  }
}

// ---------------------------------------------------------------- 상태
const state = {
  prog: 0, shatter: 0, ringRot: 0, holo: 0,
  interiorI: 0, sign: 0, cars: 0,
  tokScale: 0, tokAlpha: 1, tokPos: new THREE.Vector3(),
};
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

function director(t, dt) {
  // 서막: 홀로그램 프리뷰 (완성형을 미리 한 번)
  state.holo = sp(T, 0.2, 0.6) * (1 - sp(T, 0.86, 1.02));

  // 건설: 브릭 조립 (설명서 3봉지 = 3단계)
  const buildRaw = easeInOutSine(sp(T, 1.04, 1.94));
  state.prog = T < 1 ? (state.holo > 0.01 ? 1 : 0) : T >= 2 ? 1 : buildRaw;

  // 완공: 실내 점등 + 사인 + 자동차
  state.interiorI = Math.min(easeInOutSine(sp(T, 2.05, 2.55)) * (1 - sp(T, 3.3, 3.7) * 0.8) + sp(T, 4.2, 4.6) * 0.8, 1);
  state.sign = sp(T, 1.9, 2.35);
  state.cars = sp(T, 2.0, 2.45);

  // 조각화 (+ CTA 재조립)
  state.shatter = sp(T, 3.05, 3.9) * (1 - easeInOutSine(sp(T, 4.05, 4.5)));
  state.ringRot += dt * (0.1 + smoothstep(0.2, 0.8, state.shatter) * 0.24);

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
  dust.u.uStr.value = 0.3 + smoothstep(0.1, 0.9, state.shatter) * 0.45;

  // 카메라
  const az = crScalar(K_AZ, T);
  const aspectScale = camera.aspect < 1.2 ? 1.3 - camera.aspect * 0.1 : 1;
  const dist = crScalar(K_DIST, T) * Math.max(aspectScale, 1);
  const hgt = crScalar(K_H, T);
  const tx = crScalar(K_TX, T);
  const ty = crScalar(K_TY, T);
  camera.position.set(Math.cos(az) * dist, hgt, Math.sin(az) * dist);
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
  const tokOut = easeInOutSine(sp(T, 4.02, 4.3));
  state.tokScale = tokIn * (1 - tokOut) * (MOBILE ? 0.82 : 1);
  state.tokAlpha = sat(tokIn * (1 - tokOut));
  if (state.tokScale > 0.001) {
    const f = tmpA.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const r = tmpC.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmpD.copy(camera.position).addScaledVector(f, 300).addScaledVector(r, MOBILE ? 0 : -90);
    tmpD.y += MOBILE ? 60 : 6;
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

  building.update(state, t);
  post.bloom.strength = 0.36 + state.holo * 0.1 + smoothstep(0.05, 0.5, state.shatter) * 0.08;
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
      building.redrawAll();
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
window.__info = () => ({ T: +T.toFixed(3), fps: +fps.toFixed(1), prog: +state.prog.toFixed(2), bricks: building.brickSys.count });
window.__probe = () => ({ scale: +state.tokScale.toFixed(3) });
frame();
