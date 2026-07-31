// v2 디렉터 — WeBlock 플래그십 (브릭 조립 → 완공 → 조각화 → CTA)
import * as THREE from 'three';
import { createBackdrop, buildEnvironment, createFloor, createDust } from './stage.js';
import { createBuilding, createToken, createCoins, W_HEIGHT } from './building3.js';
import { createComposer } from '../fx.js';
import { clamp, lerp, sat, span as sp, smoothstep, easeInOutSine, easeOutCubic, easeOutExpo, fmtKR } from '../util.js';

const SNAP = /[?&]snap/.test(location.search);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 820px)').matches;

// ---------------------------------------------------------------- 부트
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(SNAP ? 1 : Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 2, 9000);
camera.position.set(500, 150, 500);
const REF_ASPECT = 1.6;

const envMap = buildEnvironment(renderer);

const backdrop = createBackdrop();
const floor = createFloor();
const dust = createDust();
const building = createBuilding(envMap);
const token = createToken(envMap);
const coins = createCoins(envMap, 9);
scene.add(backdrop.mesh, floor.group, dust.mesh, building.group, token.group, coins.group);

// 대기 원근 — 뒤쪽 브릭이 살짝 물러나 보이게
scene.fog = new THREE.FogExp2(0x0a0a16, 0.00042);

// 스튜디오 라이트
const key = new THREE.DirectionalLight(0xfbf8ff, 3.3);
key.position.set(-620, 620, 700);
// 키 라이트만 그림자를 만든다 — 브릭끼리의 자기그림자가 입체감의 8할
key.castShadow = true;
key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
key.shadow.camera.left = -340; key.shadow.camera.right = 340;
key.shadow.camera.top = 340; key.shadow.camera.bottom = -340;
key.shadow.camera.near = 300; key.shadow.camera.far = 2100;
key.shadow.bias = -0.0009;
key.shadow.normalBias = 1.4;
key.shadow.radius = 2.5;
const rim = new THREE.DirectionalLight(0xa88cff, 0.62);
rim.position.set(520, 300, -650);
const warm = new THREE.DirectionalLight(0xffcc9a, 1.25);
warm.position.set(300, 260, 700);
const fill = new THREE.HemisphereLight(0x6b7596, 0x191722, 2.0);
scene.add(key, rim, warm, fill);

const post = createComposer(renderer, scene, camera);
post.bloom.strength = 0.38;
post.bloom.threshold = 0.9;

dust.mesh.layers.set(1);
building.lamps.traverse((o) => o.layers.set(1));
camera.layers.enable(1);

// ---------------------------------------------------------------- 무드
const C = (h) => new THREE.Color(h);
// 컬러 스크립트 — 챕터마다 감정이 분명히 달라지도록 색·빛을 함께 움직인다.
//   서막 밤 → 건설 푸른 새벽 → 완공 골든아워 → 조각화 전기 바이올렛 → CTA 깊은 남색
// k/w/r = 키·웜·림 라이트 세기
const MOODS = [
  // 00 서막 — 레퍼런스 사진과 같은 밤. 하늘은 거의 검고 실내만 따뜻하다
  { zen: C(0x010208), hor: C(0x0a0c22), glow: C(0x1c1648), gI: 0.42, stars: 0.8, exp: 1.03, k: 3.0, w: 1.6, r: 0.5 },
  // 01 건설 — 차가운 새벽, 작업의 시간
  { zen: C(0x02040e), hor: C(0x101c3a), glow: C(0x21407a), gI: 0.6, stars: 0.62, exp: 1.02, k: 3.4, w: 0.7, r: 0.75 },
  // 02 완공 — 골든아워, 감정의 정점
  { zen: C(0x0b0912), hor: C(0x33221c), glow: C(0xc47a48), gI: 0.95, stars: 0.18, exp: 1.22, k: 2.7, w: 2.4, r: 0.5 },
  // 03 조각화 — 전기 바이올렛
  { zen: C(0x05041a), hor: C(0x241040), glow: C(0x6a2ce0), gI: 1.0, stars: 0.8, exp: 1.03, k: 3.0, w: 0.55, r: 1.15 },
  // 04 투자 — 차분한 인디고, 판단의 시간
  { zen: C(0x04061a), hor: C(0x161b45), glow: C(0x3f47b4), gI: 0.78, stars: 0.6, exp: 1.06, k: 3.2, w: 0.9, r: 0.85 },
  // 05 성장 — 밤이 걷히고 낮이 온다 (시간의 경과)
  { zen: C(0x0d1730), hor: C(0x44577a), glow: C(0x9ab0d6), gI: 0.85, stars: 0.04, exp: 1.18, k: 4.0, w: 1.5, r: 0.5 },
  // 06 수익 — 황금빛 결실
  { zen: C(0x0a0810), hor: C(0x3a2a18), glow: C(0xd8933f), gI: 1.0, stars: 0.12, exp: 1.18, k: 2.9, w: 2.05, r: 0.45 },
  // 07 시작 — 깊은 남색, 다시 밤
  { zen: C(0x05060f), hor: C(0x1b1c3c), glow: C(0x6a4a9e), gI: 0.8, stars: 0.55, exp: 1.12, k: 3.1, w: 1.3, r: 0.8 },
  { zen: C(0x05060f), hor: C(0x1b1c3c), glow: C(0x6a4a9e), gI: 0.8, stars: 0.55, exp: 1.12, k: 3.1, w: 1.3, r: 0.8 },
];
const moodNow = { zen: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(), gI: 0, stars: 0, exp: 1, k: 3, w: 1, r: 0.6 };
function evalMood(T) {
  const i = clamp(Math.floor(T), 0, 7);
  // 챕터 중반까지는 그 챕터의 색을 붙잡고, 후반에 다음 챕터로 넘긴다.
  // (전 구간 선형 보간을 쓰면 어떤 챕터도 자기 색으로 앉아 있질 못한다)
  const t = smoothstep(0.52, 0.99, sat(T - i));
  const A = MOODS[i], B = MOODS[i + 1];
  moodNow.zen.copy(A.zen).lerp(B.zen, t);
  moodNow.hor.copy(A.hor).lerp(B.hor, t);
  moodNow.glow.copy(A.glow).lerp(B.glow, t);
  moodNow.gI = lerp(A.gI, B.gI, t);
  moodNow.stars = lerp(A.stars, B.stars, t);
  moodNow.exp = lerp(A.exp, B.exp, t);
  moodNow.k = lerp(A.k, B.k, t);
  moodNow.w = lerp(A.w, B.w, t);
  moodNow.r = lerp(A.r, B.r, t);
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
// 전면 = +z. 서막은 레퍼런스 사진과 같은 정면·눈높이에서 시작해,
// 페이지 전체에 걸쳐 한 바퀴(2π)를 돌아 마지막에 다시 정면으로 돌아온다.
const FRONT = Math.PI / 2;
// 건물 뒷면은 민무늬 벽이라 보여주지 않는다. 정면에서 시작해
// 우측 3/4(완공) → 좌측 3/4(투자·성장) → 다시 정면(수익·CTA) 으로 스윙한다.
const K_AZ = [[0, FRONT], [1, 1.30], [1.5, 1.03], [2, 0.85], [2.5, 0.72], [3, 0.95], [3.55, 1.36],
  [4, 1.72], [4.6, 2.02], [5, 2.20], [5.6, 2.34], [6, 2.02], [6.6, 1.72], [7, 1.60], [8, FRONT]];
const K_DIST = [[0, 850], [1, 620], [1.5, 640], [2, 600], [2.5, 585], [3, 820], [3.55, 920],
  [4, 720], [4.6, 620], [5, 700], [5.6, 810], [6, 680], [6.6, 620], [7, 790], [8, 960]];
const K_H = [[0, 140], [1, 110], [1.5, 155], [2, 138], [2.5, 74], [3, 240], [3.55, 285],
  [4, 205], [4.6, 145], [5, 195], [5.6, 300], [6, 168], [6.6, 118], [7, 195], [8, 225]];
const K_TY = [[0, 196], [1, 85], [1.5, 115], [2, 140], [2.5, 168], [3, 150], [3.55, 158],
  [4, 145], [4.6, 130], [5, 142], [5.6, 152], [6, 132], [6.6, 122], [7, 140], [8, 150]];
const K_TX = [[0, 0], [1, -40], [1.5, 0], [2, 30], [2.5, 20], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]];
const K_FOV = [[0, 38], [1, 45], [2, 43], [3, 42], [3.55, 44], [4, 43], [5, 42], [6, 42], [7, 43], [8, 42]];

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
  scrollTo(0, secTop[i] + (t - i) * secLen[i]);
  targetT = T = t;
};

// ---------------------------------------------------------------- UI
const copies = sections.map((s) => s.querySelector('.copy'));
const railEl = document.getElementById('rail');
const railLinks = [...document.querySelectorAll('.rail a')];
const counters = {};
document.querySelectorAll('[data-c]').forEach((el) => (counters[el.dataset.c] = el));
const stageBadge = document.getElementById('stageBadge');

// 서막 실사 사진 — assets/hero.jpg 가 있으면 사용, 없으면 바로 브릭 씬으로 시작
const PHOTO_SRC = 'assets/hero.jpg';
const heroPhoto = document.getElementById('heroPhoto');
const heroPhotoImg = document.getElementById('heroPhotoImg');
let hasPhoto = false;
if (heroPhoto) {
  const probe = new Image();
  probe.onload = () => {
    hasPhoto = true;
    heroPhotoImg.style.backgroundImage = `url("${PHOTO_SRC}")`;
    heroPhoto.classList.add('on');
  };
  probe.src = PHOTO_SRC;
}
const FADE = [
  [-1, 0.0001, 0.5, 0.78],
  [0.05, 0.16, 0.86, 0.97],
  [0.08, 0.2, 0.84, 0.97],
  [0.05, 0.16, 0.86, 0.97],
  [0.06, 0.18, 0.86, 0.97],
  [0.06, 0.18, 0.86, 0.97],
  [0.06, 0.18, 0.86, 0.97],
  [0.1, 0.3, 2, 3],
];
// 챕터별 데이터 패널 (투자 지갑 / 성장 차트 / 수익 배당)
const panels = [
  { el: document.getElementById('wallet'), at: 4, a: 0.16, b: 0.34, c: 0.86, d: 0.98 },
  { el: document.getElementById('growthPanel'), at: 5, a: 0.16, b: 0.34, c: 0.86, d: 0.98 },
  { el: document.getElementById('earnPanel'), at: 6, a: 0.16, b: 0.34, c: 0.86, d: 0.98 },
];
// 성장 차트 (감정가 추이) — 36개월 시계열을 미리 만들어 두고 스크롤로 그려 나간다
const gLine = document.getElementById('gLine');
const gArea = document.getElementById('gArea');
const gDot = document.getElementById('gDot');
if (gLine) {
  const N = 24, W = 300, H = 96;
  let d = '', da = `M 0 ${H} `;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * W;
    const base = 0.16 + Math.pow(i / (N - 1), 1.25) * 0.66;
    const wob = Math.sin(i * 1.7) * 0.035 + Math.sin(i * 0.6 + 1.2) * 0.022;
    const y = H - (base + wob) * H;
    d += (i ? 'L ' : 'M ') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    da += 'L ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  gLine.setAttribute('d', d);
  gArea.setAttribute('d', da + `L ${W} ${H} Z`);
}
// 수익 배당 막대 12개
const earnBars = document.getElementById('earnBars');
if (earnBars && !earnBars.children.length) {
  for (let i = 0; i < 12; i++) earnBars.appendChild(document.createElement('i'));
}
const earnBarEls = earnBars ? [...earnBars.children] : [];

function set(k, v) { if (counters[k]) counters[k].textContent = v; }
function uiUpdate() {
  const li = clamp(Math.floor(T), 0, 7);
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
  if (railEl) railEl.style.setProperty('--p', (T / 8).toFixed(4));
  set('prog', Math.round(state.prog * 100));
  set('bricks', fmtKR(Math.round(building.brickSys.count * state.prog)));
  set('frag', fmtKR(100000 * easeOutExpo(sp(T, 3.28, 3.92))));

  // 04 투자
  const iv = state.invest;
  set('myfrag', fmtKR(24 * iv));
  set('myamt', fmtKR(1200000 * iv));
  set('myshare', (0.024 * iv).toFixed(3));
  set('wfrag', fmtKR(24 * iv));
  set('wval', fmtKR(1200000 * iv));
  set('wgain', (0.0 + 8.3 * state.growth).toFixed(1));
  // 05 성장
  const gr = state.growth;
  set('occ', Math.round(100 * gr));
  set('visit', fmtKR(12400 * gr));
  set('apprec', (8.3 * gr).toFixed(1));
  set('gnow', (168 + 14 * gr).toFixed(0));
  if (gLine) {
    const len = gLine.getTotalLength ? gLine.getTotalLength() : 320;
    gLine.style.strokeDasharray = len;
    gLine.style.strokeDashoffset = len * (1 - gr);
    gArea.style.opacity = gr.toFixed(3);
    if (gLine.getPointAtLength && gr > 0.02) {
      const p = gLine.getPointAtLength(len * gr);
      gDot.setAttribute('cx', p.x); gDot.setAttribute('cy', p.y);
      gDot.setAttribute('opacity', Math.min(gr * 3, 1));
    } else if (gDot) gDot.setAttribute('opacity', 0);
  }
  // 06 수익
  const yd = state.yield;
  set('epay', fmtKR(8400 * yd));
  set('ecum', fmtKR(100800 * yd));
  set('eyield', (8.4 * yd).toFixed(1));
  for (let i = 0; i < earnBarEls.length; i++) {
    const k = sat((yd - i * 0.055) / 0.3);
    const h = 0.34 + 0.66 * (i / (earnBarEls.length - 1)) + Math.sin(i * 1.9) * 0.07;
    earnBarEls[i].style.transform = `scaleY(${(k * h).toFixed(3)})`;
    earnBarEls[i].style.opacity = (0.45 + 0.55 * k).toFixed(2);
  }

  // 데이터 패널 등장/퇴장
  for (const p of panels) {
    if (!p.el) continue;
    const l = sat(T - p.at);
    const o = (T >= p.at && T < p.at + 1) ? sp(l, p.a, p.b) * (1 - sp(l, p.c, p.d)) : 0;
    p.el.style.opacity = o.toFixed(3);
    p.el.style.transform = `translateY(${((1 - Math.min(o * 1.4, 1)) * 26).toFixed(1)}px)`;
    p.el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
  }
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
  prog: 0, shatter: 0, ringRot: 0, holo: 0, sweepY: -1e5, sweepI: 0, poleFade: 1,
  invest: 0, growth: 0, yield: 0,
  interiorI: 0, sign: 0, cars: 0,
  tokScale: 0, tokAlpha: 1, tokPos: new THREE.Vector3(),
};
const tmpCol = new THREE.Color();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

function director(t, dt) {
  // 서막: 첫 화면부터 완성된 랜드마크를 보여준다.
  // 스크롤을 내리면 그 건물이 위에서부터 블록으로 풀리고(hero 1→0),
  // 곧바로 같은 블록이 다시 쌓이며(build 0→1) 건설 챕터로 이어진다 — 컷 없이 한 동작.
  // 0.00~0.20 실사 사진 → 0.20~0.52 형광 보라 스윕이 훑고 지나가며 레고로 치환
  // → 0.52~0.70 완성된 레고 → 0.70~0.98 위에서부터 해체 → 1.0~ 재조립(건설)
  const sweep = sp(T, 0.20, 0.52);
  const sweepE = easeInOutSine(sweep);
  const sweepI = Math.sin(Math.PI * sweep);
  state.sweepY = lerp(-70, 350, sweepE);
  state.sweepI = sweepI * 1.0;
  if (hasPhoto) {
    const live = T < 0.76;
    heroPhoto.classList.toggle('on', live);
    if (live) {
      heroPhoto.style.setProperty('--wipe', sweepE.toFixed(4));
      heroPhoto.style.setProperty('--scan', sweepI.toFixed(3));
      heroPhoto.style.setProperty('--zoom', (1 + 0.055 * sat(T / 0.62)).toFixed(4));
      heroPhoto.style.opacity = (1 - sp(T, 0.6, 0.72)).toFixed(3);
    }
  }

  const hero = 1 - easeInOutSine(sp(T, 0.70, 0.98));
  const buildRaw = easeInOutSine(sp(T, 1.0, 1.92));
  state.prog = T < 1 ? hero : T >= 2 ? 1 : buildRaw;
  state.holo = 0;

  // 완공: 실내 점등 + 사인 + 자동차 (서막에서도 완공 상태로 보여준다)
  const lit = easeInOutSine(sp(T, 2.05, 2.55)) * (1 - sp(T, 3.3, 3.7) * 0.8) + sp(T, 4.2, 4.6) * 0.8;
  // 성장 챕터는 낮이다 — 실내 조명이 그대로면 창이 하얗게 날아간다
  const daylight = sp(T, 5.1, 5.7) * (1 - sp(T, 5.95, 6.3));
  state.interiorI = Math.min(Math.max(lit, hero * 0.95), 1) * (1 - 0.85 * daylight);
  // 폴 사인은 완공까지의 안내물 — 이후 카메라가 크게 돌면 카피를 가리므로 걷는다
  state.poleFade = 1 - sp(T, 4.3, 4.9);
  state.sign = Math.max(hero, sp(T, 1.9, 2.35));
  state.cars = Math.max(hero, sp(T, 2.0, 2.45));

  // 조각화 → 투자에서 다시 한 채로 모인다 (조각을 사 모으는 행위 = 재조립)
  state.shatter = sp(T, 3.05, 3.9) * (1 - easeInOutSine(sp(T, 4.02, 4.62)));
  // 04 투자 / 05 성장 / 06 수익
  state.invest = easeOutCubic(sp(T, 4.15, 4.85));
  state.growth = easeInOutSine(sp(T, 5.05, 5.85));
  state.yield = easeOutCubic(sp(T, 6.05, 6.8));
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
  // 바닥은 배경 지평과 같은 톤으로 — 반사·그림자 없이 자연스럽게 이어지도록
  floor.groundU.uNear.value.copy(M.hor).lerp(M.zen, 0.45).multiplyScalar(0.62);
  floor.groundU.uFar.value.copy(M.zen).multiplyScalar(0.6);
  floor.groundU.uHaze.value.copy(M.hor).multiplyScalar(0.95).add(tmpCol.copy(M.glow).multiplyScalar(0.22 * M.gI));
  floor.groundU.uGlow.value.copy(M.glow);
  scene.fog.color.copy(M.hor).lerp(M.zen, 0.35);
  key.intensity = M.k; warm.intensity = M.w; rim.intensity = M.r;
  dust.u.uTime.value = t;
  dust.u.uStr.value = 0.3 + smoothstep(0.1, 0.9, state.shatter) * 0.45;

  // 카메라
  const az = crScalar(K_AZ, T);
  // 세로 화면일수록 가로 화각이 좁아지므로 거리로 보정 (기준 16:10)
  const aspectScale = camera.aspect < REF_ASPECT ? Math.min(Math.sqrt(REF_ASPECT / camera.aspect), 1.95) : 1;
  // 세로 화면 서막은 카피가 아래로 빠지므로 건물을 조금 더 당겨 크게 보여준다
  const heroPull = camera.aspect < 1.05 ? 1 - 0.22 * (1 - sat(T)) : 1;
  const dist = crScalar(K_DIST, T) * aspectScale * heroPull;
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
    tmpD.y += MOBILE ? 16 : 6;
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
  coins.update(t, state.yield * (1 - sp(T, 6.9, 7.15)));
  post.bloom.strength = 0.36 + state.holo * 0.1 + sweepI * 0.16 + smoothstep(0.05, 0.5, state.shatter) * 0.08;
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
      coins.redraw();
      building.redrawAll();
      setTimeout(() => { loader.classList.add('hide'); window.__ready = true; }, 150);
    });
  }
}
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  // 세로 화면: 건물을 화면 위쪽으로 밀어 아래 절반을 카피 영역으로 비워둔다
  if (camera.aspect < 1.05) {
    camera.setViewOffset(innerWidth, innerHeight, 0, Math.round(innerHeight * 0.15), innerWidth, innerHeight);
  } else {
    camera.clearViewOffset();
  }
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
  measure();
}
addEventListener('resize', resize);
measure();
resize();
window.__info = () => ({ T: +T.toFixed(3), fps: +fps.toFixed(1), prog: +state.prog.toFixed(2), inv: +state.invest.toFixed(2), gro: +state.growth.toFixed(2), yld: +state.yield.toFixed(2) });
window.__probe = () => ({ scale: +state.tokScale.toFixed(3) });
frame();
