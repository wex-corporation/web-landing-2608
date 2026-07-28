// 위블록 랜딩 디렉터 — 스크롤 타임라인이 모든 것을 지휘한다
import * as THREE from 'three';
import { createSky, createCity, createGround, createLake, createTrails } from './world.js';
import { createTower, H } from './tower.js';
import { createSparks, createDividends, createComposer } from './fx.js';
import { clamp, lerp, sat, span as sp, smoothstep, easeInOutSine, easeOutCubic, easeOutExpo, fmtKR } from './util.js';

const SNAP = /[?&]snap/.test(location.search);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 820px)').matches;

// ---------------------------------------------------------------- 부트
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(SNAP ? 1 : Math.min(devicePixelRatio, MOBILE ? 1.6 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 2, 9000);
camera.position.set(820, 360, 1260);

const sky = createSky();
const city = createCity();
const ground = createGround();
const lake = createLake();
const trails = createTrails();
const tower = createTower();
const sparks = createSparks();
const dividends = createDividends();
scene.add(sky.mesh, city.mesh, ground.mesh, lake.mesh, trails.mesh, tower.group, sparks.mesh, dividends.mesh);

const hemi = new THREE.HemisphereLight(0x33507a, 0x0a0d14, 0.5);
const sun = new THREE.DirectionalLight(0xffe0b0, 0.3);
scene.add(hemi, sun);

const post = createComposer(renderer, scene, camera);

// 포그 유니폼 배포 대상
const FOG_BAGS = [city.u, ground.u, lake.u, trails.u, tower.shellU];

// ---------------------------------------------------------------- 룩(시간대) 테이블 — T 경계 0..8
const C = (h) => new THREE.Color(h);
const LOOKS = [
  /*0 서막·박명*/  { zen: C(0x0a1226), hor: C(0x24445e), haze: C(0x2e4a63), sunC: C(0xcfe0ff), el: -14, az: -2.4, disc: 0, glow: 0.35, stars: 0.75, fogC: C(0x0a1626), fogD: 3.1e-4, exp: 1.0, sunI: 0.25, sunL: 0.12, cityLit: 0.5, hemiI: 0.5 },
  /*1 심야·착공*/  { zen: C(0x060a16), hor: C(0x14263f), haze: C(0x1d3350), sunC: C(0xcfe0ff), el: -22, az: -2.4, disc: 0, glow: 0.2, stars: 0.95, fogC: C(0x081020), fogD: 3.4e-4, exp: 0.98, sunI: 0.1, sunL: 0.06, cityLit: 0.46, hemiI: 0.4 },
  /*2 황혼 잔광*/  { zen: C(0x0a0e1e), hor: C(0x2e2438), haze: C(0x5c3a28), sunC: C(0xffb070), el: -7, az: -2.2, disc: 0, glow: 0.45, stars: 0.5, fogC: C(0x0e0d1c), fogD: 3.2e-4, exp: 1.0, sunI: 0.3, sunL: 0.1, cityLit: 0.55, hemiI: 0.45 },
  /*3 잉크빛 밤*/  { zen: C(0x04060c), hor: C(0x101a2e), haze: C(0x16233c), sunC: C(0xbcd4ff), el: -26, az: -2.0, disc: 0, glow: 0.16, stars: 1.0, fogC: C(0x060c18), fogD: 3.3e-4, exp: 0.98, sunI: 0.08, sunL: 0.05, cityLit: 0.6, hemiI: 0.38 },
  /*4 밤·투자*/   { zen: C(0x05070f), hor: C(0x121e33), haze: C(0x1a2a44), sunC: C(0xbcd4ff), el: -26, az: -1.9, disc: 0, glow: 0.18, stars: 0.95, fogC: C(0x070d1a), fogD: 3.2e-4, exp: 1.0, sunI: 0.08, sunL: 0.05, cityLit: 0.62, hemiI: 0.4 },
  /*5 심야→여명*/ { zen: C(0x060a14), hor: C(0x152238), haze: C(0x1d2f4a), sunC: C(0xd8e4ff), el: -18, az: -2.2, disc: 0, glow: 0.2, stars: 0.85, fogC: C(0x081020), fogD: 3.1e-4, exp: 1.0, sunI: 0.1, sunL: 0.06, cityLit: 0.7, hemiI: 0.42 },
  /*6 박명*/      { zen: C(0x0a1224), hor: C(0x3a3040), haze: C(0x5a3c2c), sunC: C(0xffc27d), el: -10, az: -2.35, disc: 0, glow: 0.5, stars: 0.5, fogC: C(0x121424), fogD: 3.0e-4, exp: 1.0, sunI: 0.3, sunL: 0.15, cityLit: 0.6, hemiI: 0.42 },
  /*7 일출*/      { zen: C(0x1e4066), hor: C(0xd8894a), haze: C(0xf0b46a), sunC: C(0xffd9a0), el: 4, az: -2.3, disc: 0.8, glow: 0.9, stars: 0, fogC: C(0x363e54), fogD: 2.6e-4, exp: 1.03, sunI: 1.0, sunL: 0.85, cityLit: 0.2, hemiI: 0.6 },
  /*8 아침*/      { zen: C(0x2b527e), hor: C(0x7fa2c2), haze: C(0xd8c090), sunC: C(0xfff0d0), el: 10, az: -2.25, disc: 0.7, glow: 0.5, stars: 0, fogC: C(0x7690a8), fogD: 1.7e-4, exp: 1.0, sunI: 0.9, sunL: 1.0, cityLit: 0.08, hemiI: 0.75 },
];

const lookNow = {
  zen: new THREE.Color(), hor: new THREE.Color(), haze: new THREE.Color(), sunC: new THREE.Color(), fogC: new THREE.Color(),
  el: 0, az: 0, disc: 0, glow: 0, stars: 0, fogD: 3e-4, exp: 1, sunI: 0, sunL: 0, cityLit: 0, hemiI: 0.5,
};
function evalLook(T) {
  const i = clamp(Math.floor(T), 0, 7);
  const t = easeInOutSine(sat(T - i));
  const A = LOOKS[i], B = LOOKS[i + 1];
  for (const k of ['zen', 'hor', 'haze', 'sunC', 'fogC']) lookNow[k].copy(A[k]).lerp(B[k], t);
  for (const k of ['el', 'az', 'disc', 'glow', 'stars', 'fogD', 'exp', 'sunI', 'sunL', 'cityLit', 'hemiI']) lookNow[k] = lerp(A[k], B[k], t);
  return lookNow;
}

// ---------------------------------------------------------------- 카메라 트랙 (비균등 키 + Catmull-Rom)
const CAM_KEYS = [
  { T: 0.0, p: [680, 240, 1180], t: [0, 175, 0], fov: 44 },
  { T: 0.9, p: [430, 120, 800], t: [0, 120, 0], fov: 47 },
  { T: 1.15, p: [305, 78, 605], t: [0, 95, 0], fov: 50 },
  { T: 1.6, p: [-150, 310, 650], t: [0, 250, 0], fov: 48 },
  { T: 2.0, p: [-430, 530, 570], t: [0, 430, 0], fov: 46 },
  { T: 2.5, p: [-700, 430, 920], t: [0, 300, 0], fov: 44 },
  { T: 3.0, p: [-800, 350, 1080], t: [0, 280, 0], fov: 43 },
  { T: 3.55, p: [-440, 370, 800], t: [0, 305, 0], fov: 46 },
  { T: 4.0, p: [-250, 310, 680], t: [0, 295, 0], fov: 47 },
  { T: 4.6, p: [-130, 250, 540], t: [0, 305, 0], fov: 48 },
  { T: 5.0, p: [70, 270, 640], t: [0, 275, 0], fov: 47 },
  { T: 5.6, p: [440, 310, 840], t: [0, 255, 0], fov: 45 },
  { T: 6.0, p: [630, 290, 900], t: [0, 265, 0], fov: 44 },
  { T: 6.5, p: [720, 230, 840], t: [0, 295, 0], fov: 42 },
  { T: 7.0, p: [570, 190, 960], t: [0, 295, 0], fov: 44 },
  { T: 8.0, p: [430, 210, 1080], t: [0, 305, 0], fov: 46 },
];
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const camPts = CAM_KEYS.map((k) => ({ T: k.T, p: V(k.p), t: V(k.t), fov: k.fov }));
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();
const crS1 = new THREE.Vector3(), crS2 = new THREE.Vector3(), crS3 = new THREE.Vector3(), crS4 = new THREE.Vector3();
function crEval(field, T, out) {
  const n = camPts.length;
  let i = 0;
  while (i < n - 2 && T >= camPts[i + 1].T) i++;
  const k0 = camPts[Math.max(i - 1, 0)][field];
  const k1 = camPts[i][field];
  const k2 = camPts[i + 1][field];
  const k3 = camPts[Math.min(i + 2, n - 1)][field];
  const span_ = camPts[i + 1].T - camPts[i].T;
  const t = sat((T - camPts[i].T) / span_);
  const t2 = t * t, t3 = t2 * t;
  // uniform Catmull-Rom
  out.copy(k1).multiplyScalar(2)
    .add(crS1.copy(k2).sub(k0).multiplyScalar(t))
    .add(crS2.copy(k0).multiplyScalar(2).sub(crS3.copy(k1).multiplyScalar(5)).add(crS4.copy(k2).multiplyScalar(4)).sub(k3).multiplyScalar(t2))
    .add(crS2.copy(k3).sub(k0).add(crS3.copy(k1).sub(k2).multiplyScalar(3)).multiplyScalar(t3))
    .multiplyScalar(0.5);
  return out;
}
function camFov(T) {
  const n = camPts.length;
  let i = 0;
  while (i < n - 2 && T >= camPts[i + 1].T) i++;
  const t = easeInOutSine(sat((T - camPts[i].T) / (camPts[i + 1].T - camPts[i].T)));
  return lerp(camPts[i].fov, camPts[i + 1].fov, t);
}

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
  return Math.min(T, 7.9999);
}
let targetT = 0, T = 0;
window.__seek = (t) => {
  t = clamp(t, 0, 7.999);
  const i = clamp(Math.floor(t), 0, 7);
  const y = secTop[i] + (t - i) * secLen[i];
  scrollTo(0, y);
  targetT = T = t;
};

// ---------------------------------------------------------------- UI 바인딩
const copies = sections.map((s) => s.querySelector('.copy'));
const walletEl = document.getElementById('wallet');
const earnEl = document.getElementById('earnPanel');
const railLinks = [...document.querySelectorAll('.rail a')];
const counters = {};
document.querySelectorAll('[data-c]').forEach((el) => (counters[el.dataset.c] = el));
const chartLine = document.getElementById('chartLine');
const chartArea = document.getElementById('chartArea');
let chartLen = 0;
if (chartLine) { chartLen = chartLine.getTotalLength(); chartLine.style.strokeDasharray = `${chartLen}`; }

// 챕터별 카피 페이드 윈도우 [inA,inB,outA,outB]
const FADE = [
  [-1, 0.0001, 0.5, 0.78],   // hero: 즉시 표시, 빨리 퇴장
  [0.05, 0.16, 0.86, 0.97],
  [0.08, 0.2, 0.84, 0.97],
  [0.05, 0.16, 0.86, 0.97],
  [0.05, 0.16, 0.88, 0.98],
  [0.05, 0.16, 0.86, 0.97],
  [0.05, 0.16, 0.88, 0.98],
  [0.1, 0.3, 2, 3],          // cta: 유지
];
function uiUpdate(t) {
  const li = clamp(Math.floor(T), 0, 7);
  for (let i = 0; i < copies.length; i++) {
    const el = copies[i]; if (!el) continue;
    const l = sat(T - i);
    const [a, b, c, d] = FADE[i];
    const vIn = sp(l, a, b), vOut = 1 - sp(l, c, d);
    const o = vIn * vOut;
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translateY(${((1 - vIn) * 30 - (1 - vOut) * 26).toFixed(2)}px)`;
    el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
  }
  railLinks.forEach((lnk, i) => lnk.classList.toggle('on', i === li));

  // 카운터
  const bH = Math.min(state.buildH, H);
  set('height', fmtKR(bH));
  set('floors', fmtKR((bH / H) * 123));
  set('frag', fmtKR(100000 * easeOutExpo(sp(T, 3.3, 3.95))));
  const pieces = Math.round(124 * easeOutCubic(sp(T, 4.18, 4.8)));
  set('pieces', fmtKR(pieces));
  if (counters.share) counters.share.textContent = ((pieces / 100000) * 100).toFixed(3);
  set('amount', fmtKR(pieces * 50000));
  set('occ', (62 + 36.2 * sp(T, 5.15, 5.9)).toFixed(1));
  set('visit', fmtKR(42000 * easeOutCubic(sp(T, 5.2, 5.95))));
  set('div', fmtKR(1860000 * easeOutCubic(sp(T, 6.3, 7.05))));

  // 지갑/수익 패널
  if (walletEl) {
    const w = sp(sat(T - 4), 0.18, 0.34);
    walletEl.style.opacity = w.toFixed(3);
    walletEl.style.transform = `translateX(-50%) translateY(${(1 - w) * 34}px)`;
  }
  if (earnEl) {
    const w = sp(sat(T - 6), 0.14, 0.3);
    earnEl.style.opacity = w.toFixed(3);
    earnEl.style.transform = `${MOBILE ? 'translateX(50%)' : ''} translateY(${(1 - w) * 34}px)`;
  }
  const cp = sp(T, 6.25, 6.98);
  if (chartLine) chartLine.style.strokeDashoffset = `${chartLen * (1 - easeInOutSine(cp))}`;
  if (chartArea) chartArea.style.opacity = (cp * 0.9).toFixed(3);
}
function set(k, v) { if (counters[k]) counters[k].textContent = v; }

// ---------------------------------------------------------------- 프레임 상태
const state = {
  buildH: 0, coreH: 0, slabT: 0, conAlpha: 0, frontier: 0, work: 0,
  winLit: 0, winWave: 0, crownLit: 0, aviI: 0, beamI: 0,
  holo: 0, ghost: 0, scanY: -60, scanI: 0, seamGlow: 0,
  shatter: 0, ringRot: 0, edgeGlow: 0, invest: 0, panelFade: 1,
  goldY: 168, goldI: 0,
  tokScale: 0, tokAlpha: 1, tokPos: new THREE.Vector3(),
  walletPos: new THREE.Vector3(0, 60, 400),
  earnTarget: new THREE.Vector3(0, 60, 400),
  sparkRate: 0, traffic: 0, earnStr: 0,
};

function winLitAt(T, t) {
  if (T < 2) return 0;
  if (T < 3) return 0.55 * sp(T, 2.3, 2.95);
  if (T < 4) return lerp(0.55, 0.34, sp(T, 3.05, 3.45));
  if (T < 5) return lerp(0.34, 0.42, sp(T, 4, 5));
  if (T < 6) { const g = sp(T, 5.05, 5.9); return lerp(0.42, 0.95, easeInOutSine(g)) * (0.97 + 0.03 * Math.sin(t * 6.3)); }
  if (T < 7) return lerp(0.95, 0.55, sp(T, 6.2, 6.95));
  return lerp(0.55, 0.2, sp(T, 7, 7.7));
}

const ndcTmp = new THREE.Vector3();
function screenAnchor(nx, ny, dist, out) {
  ndcTmp.set(nx, ny, 0.5).unproject(camera);
  ndcTmp.sub(camera.position).normalize();
  return out.copy(camera.position).addScaledVector(ndcTmp, dist);
}

function director(t, dt) {
  // ── 건설
  state.slabT = sp(T, 1.03, 1.14);
  const cp2 = easeInOutSine(sp(T, 1.07, 1.9));
  state.coreH = cp2 * H * 0.99;
  const bp = easeInOutSine(sp(T, 1.16, 1.98));
  state.buildH = T < 1 ? 0 : T >= 2 ? 566 : bp * 566;
  state.frontier = sp(T, 1.16, 1.26) * (1 - sp(T, 1.94, 2.0));
  state.work = state.frontier;
  state.conAlpha = (T < 1 ? 0 : 1) * (1 - sp(T, 1.9, 2.02));
  state.sparkRate = REDUCED ? 0 : state.frontier * (state.buildH > 25 && state.buildH < 535 ? 1 : 0);

  // ── 서막 홀로그램
  state.holo = sp(T, 0.22, 0.6) * (1 - sp(T, 0.82, 1.0));
  ground.u.uHoloSite.value = sp(T, 0.15, 0.45) * (1 - sp(T, 0.85, 1.05));
  ground.u.uPitGlow.value = sp(T, 0.95, 1.12) * (1 - sp(T, 1.4, 1.65));

  // ── 완공
  state.winWave = sp(T, 2.25, 2.85) * (1 - sp(T, 3.0, 3.3));
  state.winLit = winLitAt(T, t);
  const crownBase = sp(T, 2.5, 2.85);
  const crownDim = 1 - 0.55 * sp(T, 3.15, 3.5) * (1 - sp(T, 5.05, 5.5));
  state.crownLit = crownBase * crownDim;
  state.aviI = sp(T, 2.58, 2.8);
  state.beamI = sp(T, 2.52, 2.72) * (1 - sp(T, 2.98, 3.42));

  // ── 조각화
  state.scanI = sp(T, 3.02, 3.1) * (1 - sp(T, 3.52, 3.62));
  state.scanY = lerp(-40, 590, easeInOutSine(sp(T, 3.02, 3.6)));
  state.seamGlow = sp(T, 3.04, 3.28) * (1 - sp(T, 3.9, 4.25));
  state.shatter = sp(T, 3.16, 3.96);
  state.ghost = sp(T, 3.3, 3.86) * (1 - sp(T, 4.55, 5.35));
  state.edgeGlow = sp(T, 3.2, 3.55) * (1 - sp(T, 4.85, 5.3));
  state.ringRot += dt * (0.1 + smoothstep(0.2, 0.8, state.shatter) * 0.22);
  state.panelFade = 1 - sp(T, 4.78, 5.35);

  // ── 투자
  state.invest = sp(T, 4.05, 4.85);
  state.goldI = sp(T, 4.5, 4.85) * (1 - sp(T, 5.15, 5.55));

  // ── 성장/수익
  state.traffic = REDUCED ? 0 : sp(T, 5.05, 5.5) * (1 - sp(T, 6.75, 7.35));
  state.earnStr = REDUCED ? 0 : sp(T, 6.15, 6.55) * (1 - sp(T, 6.95, 7.4));

  // ── 룩 적용
  const L = evalLook(T);
  sky.u.uZenith.value.copy(L.zen);
  sky.u.uHorizon.value.copy(L.hor);
  sky.u.uHaze.value.copy(L.haze);
  sky.u.uSunColor.value.copy(L.sunC);
  sky.u.uSunDisc.value = L.disc;
  sky.u.uSunGlow.value = L.glow;
  sky.u.uStars.value = L.stars;
  sky.u.uTime.value = t;
  const el = L.el * Math.PI / 180, az = L.az;
  tmpA.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
  sky.u.uSunDir.value.copy(tmpA);
  tower.shellU.uSunDir.value.copy(tmpA);
  tower.shellU.uSunI.value = L.sunI;
  tower.shellU.uSunColor.value.copy(L.sunC);
  tower.shellU.uSkyZenith.value.copy(L.zen);
  tower.shellU.uSkyHorizon.value.copy(L.hor);
  lake.u.uSkyZenith.value.copy(L.zen);
  lake.u.uSkyHorizon.value.copy(L.hor);
  lake.u.uTowerLit.value = state.winLit * 0.9 + state.beamI * 0.4 + state.frontier * 0.25;
  lake.u.uTime.value = t;
  sun.position.copy(tmpA).multiplyScalar(2000).add(tmpB.set(0, 300, 0));
  sun.intensity = L.sunL * 2.4;
  sun.color.copy(L.sunC);
  hemi.intensity = L.hemiI * 1.1;
  hemi.color.copy(L.hor).lerp(L.zen, 0.4);
  city.u.uCityLit.value = L.cityLit * (0.6 + 0.4 * sp(T, 0, 0.35)) + state.traffic * 0.1;
  city.u.uTime.value = t;
  city.u.uHemiSky.value.copy(L.hor).multiplyScalar(0.9);
  ground.u.uPlazaLit.value = Math.max(sp(T, 2.45, 2.85) * 0.6, sp(T, 5.0, 5.45)) * (1 - sp(T, 7.2, 7.9) * 0.5);
  ground.u.uTime.value = t;
  trails.u.uTime.value = t;
  trails.u.uStr.value = state.traffic;
  renderer.toneMappingExposure = L.exp;
  for (const bag of FOG_BAGS) {
    bag.uFogColor.value.copy(L.fogC);
    bag.uFogDensity.value = L.fogD;
  }

  // ── 카메라
  crEval('p', T, tmpA);
  crEval('t', T, tmpB);
  // 건설 중 프런티어 추적
  if (T > 1.18 && T < 2.0) {
    const k = smoothstep(1.18, 1.45, T) * (1 - sp(T, 1.9, 2.0));
    tmpB.y = lerp(tmpB.y, clamp(state.buildH * 0.66, 60, 420), k * 0.75);
  }
  camera.position.copy(tmpA);
  if (!REDUCED) {
    camera.position.x += Math.sin(t * 0.31) * 1.6;
    camera.position.y += Math.sin(t * 0.23 + 2) * 1.2;
  }
  camera.lookAt(tmpB);
  const fv = camFov(T);
  if (Math.abs(camera.fov - fv) > 0.01) { camera.fov = fv; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();

  // ── 화면 앵커(지갑/배당 타깃)와 히어로 토큰 — 카메라 갱신 후 계산
  screenAnchor(0, -0.7, 320, state.walletPos);
  screenAnchor(MOBILE ? 0 : 0.42, -0.62, 300, state.earnTarget);
  const tokIn = easeOutCubic(sp(T, 3.52, 3.8));
  const tokFly = easeInOutSine(sp(T, 4.02, 4.34));
  state.tokScale = tokIn * (1 - tokFly * 0.98);
  state.tokAlpha = sat(tokIn * (1 - sp(T, 4.28, 4.4)));
  if (state.tokScale > 0.001) {
    const f = tmpA.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const r = tmpB.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmpC.copy(camera.position).addScaledVector(f, 300).addScaledVector(r, MOBILE ? 0 : -85).add(tmpD.set(0, 8, 0));
    state.tokPos.copy(tmpC).lerp(state.walletPos, tokFly);
  }

  // ── 타워/파티클
  tower.update(state, t, dt);
  sparks.update(dt, t, state.sparkRate, state.buildH);
  dividends.u.uTime.value = t;
  dividends.u.uStr.value = state.earnStr;
  dividends.u.uWalletPos.value.copy(state.earnTarget);

  // 블룸 강약 (완공 비컨/일출에서 살짝 상승)
  post.bloom.strength = 0.5 + state.beamI * 0.25 + sp(T, 6.4, 7.0) * 0.15 + state.scanI * 0.1;
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
  uiUpdate(t);
  post.composer.render();
  frames++;
  if (t - lastFpsT > 1) { fps = frames / (t - lastFpsT); frames = 0; lastFpsT = t; }
  if (!started) {
    started = true;
    if (loaderBar) loaderBar.style.width = '100%';
    document.fonts.ready.then(() => {
      tower.refreshToken(); // 폰트 로드 후 토큰 카드 텍스트 선명화
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
window.__info = () => ({
  T: +T.toFixed(3), fps: +fps.toFixed(1),
  calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
});
window.__probe = () => {
  const v = state.tokPos.clone().project(camera);
  return {
    tok: [state.tokPos.x, state.tokPos.y, state.tokPos.z].map((n) => +n.toFixed(1)),
    ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)],
    scale: +state.tokScale.toFixed(3),
  };
};
frame();
