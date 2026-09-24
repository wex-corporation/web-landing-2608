// v2 디렉터 — WeBlock 플래그십 (준공된 자산: 해체 → 구조 → 조각화 → 배당 → CTA)
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
const BASE_PR = SNAP ? 1 : Math.min(devicePixelRatio, MOBILE ? 1.5 : 2);
renderer.setPixelRatio(BASE_PR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 그림자 맵은 건물이 움직일 때만 다시 그린다. 브릭 변형이 전부 셰이더 유니폼이라
// uProg 가 멈추고 uShatter 가 0 이면(체류 시간의 대부분) 그림자는 한 픽셀도 안 변한다 —
// 그런데 autoUpdate 는 매 프레임 브릭 2,000개를 깊이 패스로 또 그린다.
// 카메라·스윕·램프는 그림자와 무관하다: 그림자는 라이트 공간이고, 스윕·고스트는
// 프래그먼트 전용이며, 자동차·폴·토큰·코인은 castShadow 를 켠 적이 없다.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 2, 9000);
camera.position.set(500, 150, 500);
const REF_ASPECT = 1.6;

// 포인터 패럴랙스: 커서를 따라 시점이 미세하게 기운다 (터치에서는 동작 안 함)
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
if (!SNAP && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  addEventListener('pointermove', (e) => {
    ptr.tx = (e.clientX / innerWidth) * 2 - 1;
    ptr.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}

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
const rim = new THREE.DirectionalLight(0x9c93cf, 0.62);
rim.position.set(520, 300, -650);
const warm = new THREE.DirectionalLight(0xffcc9a, 1.25);
warm.position.set(300, 260, 700);
const fill = new THREE.HemisphereLight(0x78808f, 0x1b1a20, 2.0);
scene.add(key, rim, warm, fill);

const post = createComposer(renderer, scene, camera, { samples: MOBILE ? 2 : 4 });
post.bloom.strength = 0.38;
post.bloom.threshold = 0.9;

dust.mesh.layers.set(1);
building.lamps.traverse((o) => o.layers.set(1));
camera.layers.enable(1);

// ---------------------------------------------------------------- 무드
const C = (h) => new THREE.Color(h);
// 컬러 스크립트 — 챕터마다 감정이 분명히 달라지도록 색·빛을 함께 움직인다.
//   서막 밤 → 구조 푸른 새벽 → 자산 골든아워 → 조각화 전기 바이올렛 → CTA 깊은 남색
// k/w/r = 키·웜·림 라이트 세기
const MOODS = [
  // 00 서막 — 레퍼런스 사진과 같은 밤. 하늘은 거의 검고 실내만 따뜻하다
  { zen: C(0x010208), hor: C(0x0a0c22), glow: C(0x1c1648), gI: 0.42, stars: 0.8, exp: 1.03, k: 3.0, w: 1.6, r: 0.5 },
  // 01 구조 — 차가운 새벽, 해부의 시간
  { zen: C(0x02040e), hor: C(0x101c3a), glow: C(0x21407a), gI: 0.6, stars: 0.62, exp: 1.02, k: 3.4, w: 0.7, r: 0.75 },
  // 02 자산 — 골든아워, 감정의 정점
  { zen: C(0x0b0912), hor: C(0x33221c), glow: C(0xc47a48), gI: 0.95, stars: 0.18, exp: 1.22, k: 2.7, w: 2.4, r: 0.5 },
  // 03 조각화 — 전기 바이올렛
  { zen: C(0x05041a), hor: C(0x241040), glow: C(0x6a2ce0), gI: 1.0, stars: 0.8, exp: 1.03, k: 3.0, w: 0.55, r: 1.15 },
  // 04 투자 — 차분한 인디고, 판단의 시간
  { zen: C(0x04061a), hor: C(0x161b45), glow: C(0x3f47b4), gI: 0.78, stars: 0.6, exp: 1.06, k: 3.2, w: 0.9, r: 0.85 },
  // 05 실적 — 밤이 걷히고 낮이 온다 (지나온 18개월)
  { zen: C(0x0d1730), hor: C(0x44577a), glow: C(0x9ab0d6), gI: 0.85, stars: 0.04, exp: 1.16, k: 3.2, w: 1.4, r: 0.5 },
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
  const t = smoothstep(0.34, 0.98, sat(T - i));
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
// Catmull-Rom 을 불균일 키 간격에 맞춰 에르미트로 푼다.
// (기존 균일 공식은 키 간격이 다를 때 그 지점에서 속도가 튀어 '덜컥'거렸다)
function crScalar(keys, T) {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && T >= keys[i + 1][0]) i++;
  const i0 = Math.max(i - 1, 0), i3 = Math.min(i + 2, n - 1);
  const t0 = keys[i0][0], t1 = keys[i][0], t2 = keys[i + 1][0], t3 = keys[i3][0];
  const k0 = keys[i0][1], k1 = keys[i][1], k2 = keys[i + 1][1], k3 = keys[i3][1];
  const dt = t2 - t1;
  const m1 = t2 - t0 > 1e-6 ? ((k2 - k0) / (t2 - t0)) * dt : k2 - k1;
  const m2 = t3 - t1 > 1e-6 ? ((k3 - k1) / (t3 - t1)) * dt : k2 - k1;
  const u = sat((T - t1) / dt), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * k1 + (u3 - 2 * u2 + u) * m1
       + (-2 * u3 + 3 * u2) * k2 + (u3 - u2) * m2;
}

// 전면 = +z. 서막은 레퍼런스 사진과 같은 정면·눈높이에서 시작해,
// 페이지 전체에 걸쳐 한 바퀴(2π)를 돌아 마지막에 다시 정면으로 돌아온다.
const FRONT = Math.PI / 2;
// 건물 뒷면은 민무늬 벽이라 보여주지 않는다. 정면에서 시작해
// 우측 3/4(완공) → 좌측 3/4(투자·성장) → 다시 정면(수익·CTA) 으로 스윙한다.
const K_AZ = [[0, FRONT], [1, 1.30], [1.5, 1.03], [2, 0.85], [2.5, 0.72], [3, 0.95], [3.55, 1.36],
  [4, 1.72], [4.6, 2.02], [5, 2.20], [5.6, 2.34], [6, 2.02], [6.6, 1.72], [7, 1.60], [8, FRONT]];
const K_DIST = [[0, 470], [1, 620], [1.5, 640], [2, 618], [2.5, 628], [3, 820], [3.55, 920],
  [4, 720], [4.6, 620], [5, 700], [5.6, 810], [6, 680], [6.6, 620], [7, 790], [8, 960]];
const K_H = [[0, 116], [1, 110], [1.5, 155], [2, 138], [2.5, 74], [3, 240], [3.55, 285],
  [4, 205], [4.6, 145], [5, 195], [5.6, 300], [6, 168], [6.6, 118], [7, 195], [8, 225]];
const K_TY = [[0, 152], [1, 85], [1.5, 115], [2, 140], [2.5, 168], [3, 150], [3.55, 158],
  [4, 145], [4.6, 130], [5, 142], [5.6, 152], [6, 132], [6.6, 122], [7, 140], [8, 150]];
const K_TX = [[0, 0], [1, -40], [1.5, 0], [2, 18], [2.5, 6], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]];
const K_FOV = [[0, 38], [1, 45], [2, 43], [3, 42], [3.55, 44], [4, 43], [5, 42], [6, 42], [7, 43], [8, 42]];

// 가로 화면의 좌우 분할 — 모바일이 '위 = 건물 / 아래 = 글'로 나누는 것과 같은 원리다.
// 카피가 왼쪽 레인이면 건물을 오른쪽으로, 오른쪽 레인이면 왼쪽으로 민다.
// 값 = 건물이 갈 방향(+1 오른쪽 / -1 왼쪽). 서막(00)과 CTA(07)는 카피가 가운데라 0.
// 03·06 만 원래도 안 겹쳤는데, 그건 그 구간의 방위각이 마침 건물을 반대편에
// 세워 준 덕이었다. 그 우연을 전 챕터에 규칙으로 깔아 준다.
// 이웃한 두 챕터는 반드시 다른 레인이어야 한다 — 교차 페이드 잔상이 겹쳐 읽히므로.
// (01·02 만 예외이고, 그건 FADE[1] 을 앞당겨 끊어서 막았다)
const LANE = [0, 1, 1, -1, 1, -1, 1, 0, 0];
const SPLIT_F = 0.15;    // 화면 폭 대비 미는 양
function laneAt(t) {
  const i = clamp(Math.floor(t), 0, 7);
  // 카피가 교차 페이드하는 구간(l 0.86→1.02)에 맞춰 레인을 바꾼다 —
  // 글이 반대편으로 건너가는 그 순간에 건물도 같이 건너가야 한 동작으로 읽힌다.
  return lerp(LANE[i], LANE[i + 1], smoothstep(0.80, 1.0, sat(t - i)));
}

// ---------------------------------------------------------------- 딸깍(디텐트)
// 스크롤 총량은 그대로 두고, 타임라인이 '읽는 지점'에서만 느려지게 만든다.
// 같은 거리를 밀어도 메시지 앞에서 한 번 걸렸다가 훅 넘어간다.
// 스크롤을 가로채지 않으므로 되감기·관성·휠이 전부 그대로 동작한다.
//
// 비트는 3D 가 '쉬는 자세'로 서 있는 지점으로 골랐다 (챕터 로컬 l):
//   00 사진이 레고가 된 직후 / 01 재조립 완료 / 02 준공 전경 / 03 완전 분해 + 토큰
//   04 다시 한 채 + 지갑 / 05 그래프 완주 / 06 배당 누적 완료 / 07 CTA
// 재조립 한복판 같은 데 비트를 두면 반쯤 지어진 채로 멈춰 선다.
const BEAT = [0.66, 0.62, 0.45, 0.78, 0.72, 0.75, 0.72, 0.35];
const DW = 0.20;               // 디텐트 반폭 (챕터 로컬)
// 깊이. 중심에서 기울기가 (1−DD)/DEN ≈ 0.18 배까지 떨어진다.
// 1 로 두면(=기울기 0) 그 구간에서 T 가 멈춰 3D 가 통째로 얼어붙는다. 반드시 1 미만.
const DD = 0.85;
const DEN = 1 - DD * DW;       // 디텐트 바깥 기울기는 1/DEN ≈ 1.20 배로 빨라진다
// BEAT 는 T 공간의 값이므로, 범프 중심은 원래 스크롤 공간으로 되돌려 잡는다
const beatU = (i) => clamp(BEAT[i] * DEN + (DD * DW) / 2, DW, 1 - DW);

// 기울기 1 − DD·bump(범프는 양 끝에서 기울기 0 인 코사인 언덕)를 적분해 정규화한 것.
// 단조 증가라 u 0→1 이 v 0→1 로 빠짐없이 대응한다.
function warpLocal(u, i) {
  const b = beatU(i);
  let acc;
  if (u <= b - DW) acc = u;
  else if (u >= b + DW) acc = u - DD * DW;
  else {
    const x = (u - b) / DW;
    acc = u - DD * DW * 0.5 * (x + Math.sin(Math.PI * x) / Math.PI + 1);
  }
  return acc / DEN;
}
// 역함수 — __seek 과 스냅이 쓴다. 단조라 이분법이면 충분하고 정확하다.
// (이걸 빼먹으면 __seek(T) 가 엉뚱한 시점을 찍어 검수가 통째로 어긋난다)
function unwarpLocal(v, i) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 28; k++) {
    const mid = (lo + hi) * 0.5;
    if (warpLocal(mid, i) < v) lo = mid; else hi = mid;
  }
  return (lo + hi) * 0.5;
}

// ---------------------------------------------------------------- 스크롤 → 타임라인
const sections = [...document.querySelectorAll('section.ch')];
let secTop = [], secLen = [];
function measure() {
  // 카피 판이 fixed 라 '핀이 붙어 있는 구간' 이라는 게 없다.
  // 스크롤 가능한 전체 길이를 챕터 수로 똑같이 나눠 T 0→8 을 끊김 없이 태운다.
  // (예전처럼 섹션 높이−화면높이 로 재면 섹션이 빠져나가는 한 화면 동안
  //  T 가 정수에 멈춰 서서 3D 도 카피도 얼어붙었다)
  const total = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
  const len = total / sections.length;
  secTop = sections.map((s, i) => i * len);
  secLen = sections.map(() => len);
}
function chapterAt(y) {
  let i = 0;
  for (let k = 0; k < sections.length; k++) if (y >= secTop[k]) i = k;
  return i;
}
function scrollToT() {
  const y = scrollY;
  const i = chapterAt(y);
  return Math.min(i + warpLocal(sat((y - secTop[i]) / secLen[i]), i), 7.9999);
}
// rawT = 워핑까지만 거친 '실제 스크롤 위치'. T 는 여기에 러프와 넛지가 더해진 연출값이다.
let targetT = 0, T = 0, rawT = 0;
window.__seek = (t) => {
  t = clamp(t, 0, 7.999);
  const i = clamp(Math.floor(t), 0, 7);
  scrollTo(0, secTop[i] + unwarpLocal(t - i, i) * secLen[i]);
  targetT = T = rawT = t;   // 프레임을 기다리지 않아도 __info() 가 맞도록 같이 세운다
};

// ── 비트 스냅 ──────────────────────────────────────────────────
// 손을 떼고 관성까지 잦아들었을 때, 디텐트 안쪽에 있으면 중심으로 살짝 앉힌다.
// 바깥이면 손대지 않는다 — 어디서든 끌어당기면 스크롤을 뺏긴 느낌이 난다.
const SNAPPY = !SNAP && !REDUCED;
const SNAP_IN = DW * 0.5;      // 이 안쪽에 멈춰 섰을 때만 당긴다
const SNAP_DUR = 0.38;
const HAS_SCROLLEND = 'onscrollend' in window;
let snap = null, lastY = -1, stillT = 0;
function trySnap() {
  if (!SNAPPY || snap) return;
  const y = scrollY;
  const i = chapterAt(y);
  const b = beatU(i);
  const u = sat((y - secTop[i]) / secLen[i]);
  if (Math.abs(u - b) > SNAP_IN) return;
  const to = Math.round(secTop[i] + b * secLen[i]);
  if (Math.abs(to - y) < 2) return;
  snap = { from: y, to, t: 0, wrote: y };
}
function updateSnap(dt) {
  if (!SNAPPY) return;
  if (snap) {
    // 스냅 도중에 사용자가 다시 잡으면 즉시 포기한다
    if (Math.abs(scrollY - snap.wrote) > 2) { snap = null; lastY = scrollY; return; }
    snap.t += dt;
    const k = easeInOutSine(sat(snap.t / SNAP_DUR));
    scrollTo(0, Math.round(lerp(snap.from, snap.to, k)));
    snap.wrote = scrollY;
    lastY = scrollY;
    if (k >= 1) snap = null;
    return;
  }
  // scrollend 를 지원하면 그쪽이 정확하다 (관성이 끝나는 바로 그 순간에 온다).
  // 없을 때만 '멈춘 지 얼마' 로 대신한다.
  if (HAS_SCROLLEND) return;
  if (scrollY !== lastY) { lastY = scrollY; stillT = 0; return; }
  stillT += dt;
  if (stillT < 0.22) return;
  stillT = 0;
  trySnap();
}
if (SNAPPY && HAS_SCROLLEND) addEventListener('scrollend', trySnap, { passive: true });

// ---------------------------------------------------------------- UI
const copies = sections.map((s) => s.querySelector('.copy'));
const railEl = document.getElementById('rail');
const railLinks = [...document.querySelectorAll('.rail a')];
// 섹션 위치와 타임라인 위치가 더는 같지 않으므로(measure 참고) 앵커 대신 직접 이동한다.
// 도착점은 그 챕터의 비트 — 눌러서 온 사람도 딱 읽기 좋은 자리에 선다.
railLinks.forEach((lnk, i) => lnk.addEventListener('click', (e) => {
  e.preventDefault();
  scrollTo({ top: secTop[i] + secLen[i] * beatU(i), behavior: 'smooth' });
}));
const scrollHint = document.getElementById('scrollHint');
const counters = {};
document.querySelectorAll('[data-c]').forEach((el) => (counters[el.dataset.c] = el));

// 서막 실사 사진 — assets/hero.jpg 가 있으면 사용, 없으면 바로 브릭 씬으로 시작
const PHOTO_SRC = 'assets/hero.jpg';
const heroPhoto = document.getElementById('heroPhoto');
const heroPhotoImg = document.getElementById('heroPhotoImg');
let hasPhoto = false, photoW = 0, photoH = 0;
// 사진 안에서 건물 본체가 차지하는 사각형(원본 픽셀 기준).
// 좌: 본체 좌측면 / 우: 우측 캔틸레버 끝 / 상: 지붕 앞날 / 하: 건물이 땅에 닿는 선.
// (좌측 별동과 주차장은 뺀다 — 3D 매싱의 실루엣과 같은 범위여야 한다)
const PHOTO_MASS = { x0: 186, y0: 551, x1: 1037, y1: 1146, W: 1206, H: 1812 };
if (heroPhoto) {
  const probe = new Image();
  probe.onload = () => {
    hasPhoto = true;
    photoW = probe.naturalWidth || PHOTO_MASS.W;
    photoH = probe.naturalHeight || PHOTO_MASS.H;
    heroPhotoImg.style.backgroundImage = `url("${PHOTO_SRC}")`;
    heroPhoto.classList.add('on');
  };
  probe.src = PHOTO_SRC;
}

// ── 실사 ↔ 브릭 정합 ──────────────────────────────────────────
// 사진과 레고가 '같은 자리에 같은 크기로' 서 있어야 보라 스윕이 지나갈 때
// 한 건물이 재질만 바뀌는 것처럼 보인다. 그래서 사진을 화면에 고정하지 않고,
// 매 프레임 3D 건물의 정면 실루엣을 화면에 투영해 그 사각형에 사진을 맞춘다.
// → 카메라를 움직이든 화면비가 바뀌든 둘은 절대 어긋나지 않는다.
const _pv = new THREE.Vector3();
const heroRect = { x0: 0, y0: 0, x1: 0, y1: 0 };
function projectMassFront() {
  const m = building.mass;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  // 사진에 찍힌 것은 정면이므로 앞면(z = z1) 네 모서리만 투영한다
  for (const x of [m.x0, m.x1]) {
    for (const y of [m.y0, m.y1]) {
      _pv.set(x, y, m.z1).project(camera);
      const sx = (_pv.x * 0.5 + 0.5) * innerWidth;
      const sy = (-_pv.y * 0.5 + 0.5) * innerHeight;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx;
      if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
  }
  heroRect.x0 = x0; heroRect.y0 = y0; heroRect.x1 = x1; heroRect.y1 = y1;
  return heroRect;
}
function fitHeroPhoto() {
  const r = projectMassFront();
  const pm = PHOTO_MASS;
  // 지붕~지면 높이를 맞춘다 — 층 슬래브 위치가 가장 잘 겹치는 기준
  const s = (r.y1 - r.y0) / ((pm.y1 - pm.y0) * (photoH / pm.H));
  const dw = photoW * s, dh = photoH * s;
  // 가로는 건물 중심, 세로는 '땅에 닿는 선'에 앵커 (스윕이 아래에서 위로 올라오므로)
  const bx = (r.x0 + r.x1) / 2 - (pm.x0 + pm.x1) / 2 * (photoW / pm.W) * s;
  const by = r.y1 - pm.y1 * (photoH / pm.H) * s;
  heroPhotoImg.style.backgroundSize = `${dw.toFixed(1)}px ${dh.toFixed(1)}px`;
  heroPhotoImg.style.backgroundPosition = `${bx.toFixed(1)}px ${by.toFixed(1)}px`;
}
// 헤드라인을 줄 단위로 감싸 마스크 안에서 차례로 올라오게 한다
const headLines = copies.map((el) => {
  if (!el) return null;
  const h = el.querySelector('h1, h2');
  if (!h) return null;
  const parts = h.innerHTML.split(/<br\s*\/?>/i).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 1) return null;
  h.innerHTML = parts.map((p) => `<span class="ln"><i>${p}</i></span>`).join('');
  return [...h.querySelectorAll('.ln > i')];
});

// 카피 교차 페이드 구간 [들어옴 시작, 끝, 나감 시작, 끝] — 기준은 l = T − 챕터번호.
// 들어오는 구간이 음수에서 시작해 앞 챕터가 나가는 구간과 겹친다.
// 겹치지 않으면 그 사이에 아무 카피도 없는 순간이 생기는데, 모바일은 화면 아래
// 3분의 2가 글 자리라 그 순간이 통째로 검은 판으로 보인다.
const FADE = [
  [-1, 0.0001, 0.86, 1.02],   // 00 서막 — 처음부터 떠 있다
  // 01 은 02 와 같은 왼쪽 레인이라(LANE 참고) 잔상이 다음 카피 위에 그대로 얹힌다.
  // 나가는 구간만 앞당겨 끊는다 — 02 는 이미 l=-0.14(T 1.86)부터 올라오고 있어서
  // 01 이 0 이 되는 T 1.96 시점엔 62% 까지 차 있다. 빈 순간은 생기지 않는다.
  [-0.14, 0.02, 0.80, 0.96],
  [-0.14, 0.02, 0.86, 1.02],
  [-0.14, 0.02, 0.86, 1.02],
  [-0.14, 0.02, 0.86, 1.02],
  [-0.14, 0.02, 0.86, 1.02],
  [-0.14, 0.02, 0.86, 1.02],
  [-0.14, 0.02, 9, 9],        // 07 CTA — 끝까지 남는다
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
  // 실제 월 순매출 (백만원, 부가세 제외) — 투자제안서 2026.05. 누적으로 쌓아 보여준다
  const SALES = [128, 121, 118, 124, 137, 141, 149, 152, 168, 195, 158, 147, 133, 126, 122, 129, 140, 146];
  const N = SALES.length, W = 300, H = 96;
  let acc = 0;
  const CUM = SALES.map((v) => (acc += v));
  const top = CUM[N - 1];
  let d = '', da = `M 0 ${H} `;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * W;
    const y = H - (CUM[i] / top) * (H - 10) - 4;
    d += (i ? 'L ' : 'M ') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    da += 'L ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  gLine.setAttribute('d', d);
  gArea.setAttribute('d', da + `L ${W} ${H} Z`);
}
// 경로 길이는 변하지 않으니 한 번만 잰다 — getTotalLength 는 지오메트리 계산이라
// 매 프레임 부르면 그 자체가 프레임 예산을 갉아먹는다. dasharray 도 여기서 한 번.
const gLen = gLine && gLine.getTotalLength ? gLine.getTotalLength() : 320;
if (gLine) gLine.style.strokeDasharray = gLen;
// 수익 배당 막대 12개
const earnBars = document.getElementById('earnBars');
if (earnBars && !earnBars.children.length) {
  for (let i = 0; i < 12; i++) earnBars.appendChild(document.createElement('i'));
}
const earnBarEls = earnBars ? [...earnBars.children] : [];

// 같은 값이면 쓰지 않는다 — textContent 는 같은 문자열이어도 쓰는 순간 스타일 무효화가 된다
function set(k, v) {
  const el = counters[k];
  if (el && el.__v !== v) { el.__v = v; el.textContent = v; }
}
// 화면에 그리는 모든 값이 T(와 rawT)의 함수다. 둘 다 멈춰 있으면 이 함수는
// 통째로 건너뛴다 — 사용자가 읽느라 멈춘 동안 DOM 쓰기·스타일 재계산이 0 이 된다.
let uiT = -1, uiRaw = -1;
function uiUpdate() {
  if (Math.abs(T - uiT) < 1e-5 && Math.abs(rawT - uiRaw) < 1e-5) return;
  uiT = T; uiRaw = rawT;
  const li = clamp(Math.floor(T), 0, 7);
  for (let i = 0; i < copies.length; i++) {
    const el = copies[i]; if (!el) continue;
    const l = T - i;   // 음수 허용 — 앞 챕터와 겹쳐야 교차 페이드가 된다
    const [a, b, c2, d] = FADE[i];
    const vIn = sp(l, a, b), vOut = 1 - sp(l, c2, d);
    const o = vIn * vOut;
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translateY(${((1 - vIn) * 22 - (1 - vOut) * 26).toFixed(2)}px)`;
    el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
    const lns = headLines[i];
    if (lns) {
      for (let k = 0; k < lns.length; k++) {
        const e = easeOutCubic(sat((vIn - k * 0.13) / 0.72));
        lns[k].style.transform = `translate3d(0,${((1 - e) * 106).toFixed(1)}%,0)`;
      }
    }
  }
  // 힌트는 '실제로 스크롤했는가' 로 걷는다. T 를 쓰면 넛지 연출에 스스로 사라진다.
  if (scrollHint) scrollHint.style.opacity = (1 - sp(rawT, 0.02, 0.13)).toFixed(3);
  railLinks.forEach((lnk, i) => lnk.classList.toggle('on', i === li));
  if (railEl) railEl.style.setProperty('--p', (T / 8).toFixed(4));
  set('prog', Math.round(state.prog * 100));
  set('bricks', fmtKR(Math.round(building.brickSys.count * state.prog)));
  set('frag', fmtKR(100000 * easeOutExpo(sp(T, 3.28, 3.92))));

  // 04 투자 — 1조각 66,900원 (66.9억 ÷ 100,000조각), 예시 보유 24조각
  const iv = state.invest;
  set('wfrag', fmtKR(24 * iv));
  set('wval', fmtKR(1605600 * iv));
  set('wshare', (0.024 * iv).toFixed(3));
  // 05 성장 — 2025년 순매출 17.1억, 월 평균 1.43억, 공시지가 +15.4%
  const gr = state.growth;
  set('gsales', (17.1 * gr).toFixed(1));
  set('gmonth', (1.43 * gr).toFixed(2));
  set('gland', (15.4 * gr).toFixed(1));
  set('gnow', (25.3 * gr).toFixed(1));
  if (gLine) {
    gLine.style.strokeDashoffset = gLen * (1 - gr);
    gArea.style.opacity = gr.toFixed(3);
    if (gLine.getPointAtLength && gr > 0.02) {
      const p = gLine.getPointAtLength(gLen * gr);
      gDot.setAttribute('cx', p.x); gDot.setAttribute('cy', p.y);
      gDot.setAttribute('opacity', Math.min(gr * 3, 1));
    } else if (gDot) gDot.setAttribute('opacity', 0);
  }
  // 06 수익 — NOI 이자 10년 누적 25.44억 ÷ 100,000조각 ÷ 120개월 = 조각당 월 212원
  const yd = state.yield;
  set('epay', fmtKR(5088 * yd));
  set('ecum', fmtKR(610560 * yd));
  set('eyield', (6.56 * yd).toFixed(2));
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
}

// ---------------------------------------------------------------- 상태
const state = {
  prog: 0, shatter: 0, ringRot: 0, holo: 0, sweepY: -1e5, sweepI: 0, poleFade: 1,
  invest: 0, growth: 0, yield: 0,
  interiorI: 0, sign: 0, cars: 0,
  tokScale: 0, tokAlpha: 1, tokPos: new THREE.Vector3(),
};
let shadowProg = -1, shadowShatter = -1;   // 마지막으로 그림자를 그린 시점의 상태
const tmpCol = new THREE.Color();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

function director(t, dt) {
  // 서막: 첫 화면부터 완성된 랜드마크를 보여준다.
  // 스크롤을 내리면 그 건물이 위에서부터 블록으로 풀리고(hero 1→0),
  // 곧바로 같은 블록이 다시 쌓이며(build 0→1) 구조 챕터로 이어진다 — 컷 없이 한 동작.
  // 0.00~0.14 실사 사진 → 0.14~0.60 형광 보라 밴드가 건물을 훑고 지나가며 레고로 치환
  // → 0.60~0.72 완성된 레고 → 0.72~1.00 위에서부터 해체 → 1.0~ 층별 재조립(구조)
  const sweep = sp(T, 0.14, 0.60);
  const sweepE = easeInOutSine(sweep);
  const sweepI = Math.sin(Math.PI * sweep);
  state.sweepI = sweepI * 1.0;   // sweepY 는 카메라 확정 후 화면 기준으로 계산한다
  const photoLive = hasPhoto && T < 0.68;
  if (hasPhoto) {
    heroPhoto.classList.toggle('on', photoLive);
    if (photoLive) {
      heroPhoto.style.setProperty('--scan', sweepI.toFixed(3));
      heroPhoto.style.opacity = (1 - sp(T, 0.60, 0.67)).toFixed(3);
    }
  }

  const hero = 1 - easeInOutSine(sp(T, 0.80, 1.0));
  // 재조립은 easeOutCubic — 바닥에서 빨리 빠져나와야 '아무것도 없는 구간'이 짧다
  const buildRaw = easeOutCubic(sp(T, 1.0, 1.92));
  state.prog = T < 1 ? hero : T >= 2 ? 1 : buildRaw;
  state.holo = 0;

  // 운영 중: 실내 점등 + 사인 + 자동차 (서막에서도 준공 상태로 보여준다)
  const lit = easeInOutSine(sp(T, 2.05, 2.55)) * (1 - sp(T, 3.3, 3.7) * 0.8) + sp(T, 4.2, 4.6) * 0.8;
  // 성장 챕터는 낮이다 — 실내 조명이 그대로면 창이 하얗게 날아간다
  const daylight = sp(T, 5.1, 5.7) * (1 - sp(T, 5.95, 6.3));
  state.interiorI = Math.min(Math.max(lit, hero * 0.95), 1) * (1 - 0.93 * daylight);
  // 폴 사인은 자산 챕터까지의 안내물 — 이후 카메라가 크게 돌면 카피를 가리므로 걷는다.
  // 서막에는 세우지 않는다: 실사에 없는 물건이라 치환이 끝난 뒤에 올라와야 자연스럽다.
  // 세로 화면에서는 건물을 꽉 채워 잡으므로 폴이 늘 화면 밖으로 잘린다 — 아예 세우지 않는다
  state.poleFade = camera.aspect < 1.15 ? 0 : sp(T, 0.62, 0.92) * (1 - sp(T, 3.85, 4.35));
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
  // 화각을 먼저 확정해야 '좌우 잘림 방지' 최소 거리를 계산할 수 있다
  const fv = crScalar(K_FOV, T);
  if (Math.abs(camera.fov - fv) > 0.01) { camera.fov = fv; camera.updateProjectionMatrix(); }
  // 세로 화면일수록 가로 화각이 좁아지므로 거리로 보정 (기준 16:10)
  const aspectScale = camera.aspect < REF_ASPECT ? Math.min(Math.sqrt(REF_ASPECT / camera.aspect), 1.74) : 1;
  let dist = crScalar(K_DIST, T) * aspectScale;
  const portrait = camera.aspect < 1.15;
  // 세로 화면은 '위 = 건물 / 아래 = 글'로 나눈다.
  let offY = portrait ? innerHeight * lerp(0.21, 0.28, easeInOutSine(sat((T - 0.55) / 0.55))) : 0;
  const hgt = crScalar(K_H, T);
  const tx = crScalar(K_TX, T);
  const ty = crScalar(K_TY, T);
  const place = (d) => {
    camera.position.set(Math.cos(az) * d, hgt, Math.sin(az) * d);
    tmpB.set(tx, ty, 0);
    camera.lookAt(tmpB);
    camera.updateMatrixWorld();
  };
  // setViewOffset 은 '전체 화면 중 어느 창을 렌더할지'를 정한다.
  // x/y 를 키우면 창이 오른쪽·아래로 가므로, 화면 위의 내용물은 왼쪽·위로 밀린다.
  const setOff = (ox, oy) => {
    if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) camera.setViewOffset(innerWidth, innerHeight, ox, oy, innerWidth, innerHeight);
    else camera.clearViewOffset();
  };

  // ── 서막 프레이밍 ──────────────────────────────────────────
  // 실사 사진은 이 건물 상자에 맞춰 앉는다. 그러니 서막에서는 건물 전체가
  // 화면의 정해진 밴드에 정확히 들어와야 사진과 브릭이 같은 자리에 선다.
  // (기기·화면비가 달라도 프레이밍이 같아지므로 치환이 늘 성립한다)
  const pro = 1 - easeInOutSine(sat((T - 0.60) / 0.40));
  if (pro > 0.002) {
    const band = portrait ? [0.13, 0.45] : [0.10, 0.63];
    camera.clearViewOffset();
    let d = dist;
    place(d);
    for (let i = 0; i < 5; i++) {
      const r = projectMassFront();
      // 세로·가로 중 더 빡빡한 쪽에 맞춘다
      const k = Math.max((r.y1 - r.y0) / innerHeight / (band[1] - band[0]),
                         (r.x1 - r.x0) / innerWidth / 0.90);
      if (Math.abs(k - 1) < 0.004) break;
      d += (d - building.mass.z1) * (k - 1);
      place(d);
    }
    const r = projectMassFront();
    dist = lerp(dist, d, pro);
    offY = lerp(offY, r.y0 - band[0] * innerHeight, pro);
  }

  // 건물이 화면 좌우로 잘리지 않는 최소 거리를 실제 투영으로 역산한다.
  // (예전의 '반폭 ÷ tan' 근사는 앞면이 카메라에 더 가깝다는 걸 못 봐서 잘렸다)
  setOff(0, offY);
  const pad = innerWidth * (portrait ? 0.05 : 0.004);
  place(dist);
  for (let i = 0; i < 4; i++) {
    const w = projectMassFront();
    const over = Math.max(pad - w.x0, w.x1 - (innerWidth - pad), 0) * 2 / innerWidth;
    if (over < 0.004) break;
    dist += (dist - building.mass.z1) * over;   // 폭 ∝ 1/(거리 − 앞면깊이)
    place(dist);
  }
  if (!REDUCED) {
    camera.position.x += Math.sin(t * 0.3) * 1.2;
    camera.position.y += Math.sin(t * 0.22 + 2) * 0.9;
    const k = 1 - Math.exp(-dt * 3.4);
    ptr.x += (ptr.tx - ptr.x) * k;
    ptr.y += (ptr.ty - ptr.y) * k;
    const side = tmpC.set(-Math.sin(az), 0, Math.cos(az));
    camera.position.addScaledVector(side, ptr.x * 26);
    camera.position.y -= ptr.y * 16;
    tmpB.set(tx, ty, 0);
    camera.lookAt(tmpB);
    camera.updateMatrixWorld();
  }

  // ── 좌우 분할 ─────────────────────────────────────────────
  // 거리 역산이 다 끝난 뒤에 화면만 옆으로 민다. 거리를 건드리지 않으므로
  // 건물이 작아지지 않고, 잘림 방지 루프와 서로 밀고 당기지도 않는다.
  // 서막(lane 0)에는 걸리지 않으니 실사 사진 정합도 그대로다.
  let offX = 0;
  const lane = portrait ? 0 : laneAt(T);
  if (Math.abs(lane) > 0.002) {
    const r = projectMassFront();
    const want = lane * innerWidth * SPLIT_F;
    const edge = innerWidth * 0.03;
    // 미는 쪽으로 건물이 화면 밖까지 나가지는 않을 만큼만 민다
    const room = want > 0 ? (innerWidth - edge) - r.x1 : r.x0 - edge;
    offX = Math.sign(want) * Math.min(Math.abs(want), Math.max(room, 0));
  }
  setOff(-offX, offY);

  // 카메라가 확정된 뒤에 사진을 그 위에 겹친다 (한 프레임도 어긋나지 않게)
  if (photoLive) fitHeroPhoto();
  else projectMassFront();

  // 치환 경계선. 화면을 등속으로 훑으면 건물을 스치듯 지나가 버리므로
  // '아래 여백 → 건물 → 위 여백' 세 구간으로 나누고 건물 구간에 시간을 몰아준다.
  {
    const H = innerHeight;
    const top = heroRect.y0, bot = heroRect.y1;
    const soft = Math.max((bot - top) * 0.2, 40);
    const seg = (a, b, u) => lerp(a, b, easeInOutSine(sat(u)));
    const edgeY = sweepE < 0.14 ? seg(H + soft, bot, sweepE / 0.14)
      : sweepE < 0.9 ? seg(bot, top, (sweepE - 0.14) / 0.76)
        : seg(top, -soft, (sweepE - 0.9) / 0.1);
    if (photoLive) {
      heroPhoto.style.setProperty('--edge', `${(H - edgeY).toFixed(1)}px`);
      heroPhoto.style.setProperty('--soft', `${soft.toFixed(1)}px`);
    }
    // 브릭 위를 훑는 보라 밴드도 같은 줄에 둔다. 어긋나면 '빛이 지나가며
    // 재질이 바뀐다'가 아니라 '두 장면이 겹쳤다'로 보인다.
    state.sweepY = (bot - edgeY) / Math.max(bot - top, 1) * building.mass.y1;
  }

  // 히어로 토큰
  const tokIn = easeOutCubic(sp(T, 3.5, 3.78));
  const tokOut = easeInOutSine(sp(T, 4.02, 4.3));
  state.tokScale = tokIn * (1 - tokOut) * (MOBILE ? 0.82 : 1);
  state.tokAlpha = sat(tokIn * (1 - tokOut));
  if (state.tokScale > 0.001) {
    const f = tmpA.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const r = tmpC.set(1, 0, 0).applyQuaternion(camera.quaternion);
    // 토큰도 빈 레인에 선다. 03(카피 우측)에서는 왼쪽에 떠 있다가
    // 04(카피 좌측)로 넘어갈 때 카피와 엇갈려 오른쪽으로 건너간다.
    // 한쪽에 고정해 두면 04 헤드라인 "66,900원부터" 위에 그대로 얹힌다.
    // 폭이 작은 건 좌우 분할이 이미 화면을 크게 밀어 주기 때문 —
    // 토큰은 카메라에서 300 밖에 안 떨어져 있어서 1 이 화면에서는 4px 쯤 된다.
    const tokLane = lerp(-1, 1, smoothstep(3.86, 4.14, T));
    tmpD.copy(camera.position).addScaledVector(f, 300).addScaledVector(r, MOBILE ? 0 : tokLane * 44);
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

  // 그림자 재렌더 판정 — 조립(prog)이 움직이거나 조각화(shatter) 구간이면 갱신.
  // shatter > 0 은 링이 uTime·uRingRot 으로 계속 도는 상태라 '변화량'이 아니라 '상태'로 본다.
  if (Math.abs(state.prog - shadowProg) > 1e-4 || state.shatter > 5e-4 ||
      Math.abs(state.shatter - shadowShatter) > 1e-4) {
    renderer.shadowMap.needsUpdate = true;
    shadowProg = state.prog;
    shadowShatter = state.shatter;
  }

  building.update(state, t);
  coins.update(t, state.yield * (1 - sp(T, 6.9, 7.15)));
  post.bloom.strength = (0.36 + state.holo * 0.1 + sweepI * 0.16 + smoothstep(0.05, 0.5, state.shatter) * 0.08) * bloomScale;
  post.grade.uniforms.uTime.value = t;
}

// ---------------------------------------------------------------- 적응형 품질
// 저사양 기기에서 프레임이 무너지면 단계적으로 무게를 덜어낸다.
// 2 = 전부 / 1 = 그림자 해상도·픽셀비 축소 / 0 = 그림자 해제
let tier = 2, slowSec = 0, bloomScale = 1;
function applyTier() {
  if (tier >= 2) {
    renderer.setPixelRatio(BASE_PR);
    renderer.shadowMap.enabled = true;
    bloomScale = 1;
  } else if (tier === 1) {
    renderer.setPixelRatio(Math.min(BASE_PR, 1.15));
    renderer.shadowMap.enabled = true;
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    key.shadow.mapSize.set(1024, 1024);
    bloomScale = 0.85;
  } else {
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    bloomScale = 0.7;
  }
  building.brickSys.materials.forEach((m) => (m.needsUpdate = true));
  if (building.brickSys.depthMat) building.brickSys.depthMat.needsUpdate = true;
  if (floor.shadowMat) floor.shadowMat.needsUpdate = true;
  renderer.shadowMap.needsUpdate = true;   // 해상도를 바꿨으면 정지 중이어도 한 번은 다시 그린다
  resize();
}

// ---------------------------------------------------------------- 첫 스크롤 넛지
// 가만히 두면 보라 스캔 밴드를 한 번 살짝 올렸다 내린다.
// 이 페이지가 스크롤로 움직인다는 걸 '말' 대신 '움직임' 으로 알린다 —
// 움직이는 것만큼 강한 어포던스가 없고, 마침 이 페이지의 대표 연출이다.
//
// 페이지를 실제로 스크롤하지 않고 타임라인만 잠깐 앞당긴다.
// scrollY 를 건드리면 관성·스냅과 엉키고 사용자가 되돌리기도 어렵다.
// 손가락이 닿아 있는 동안은 러프를 짧게(시정수 190ms → 90ms) 잡는다.
// iOS 관성 위에 우리 러프가 또 얹히면 '손을 안 따라온다'로 읽힌다 —
// 조작 중엔 바짝 붙고, 손을 떼면 원래의 부드러움으로 돌아간다.
let touching = false;
addEventListener('touchstart', () => { touching = true; }, { passive: true });
addEventListener('touchend', (e) => { if (!e.touches.length) touching = false; }, { passive: true });
addEventListener('touchcancel', (e) => { if (!e.touches.length) touching = false; }, { passive: true });

const NUDGE_WAIT = 2.5, NUDGE_DUR = 1.9, NUDGE_AMP = 0.26;  // 0.26 이면 밴드가 건물 발치까지 오른다
let nudgeAt = -1, nudgeDone = false, touched = false;
if (!SNAP && !REDUCED) {
  const cancel = () => { touched = true; };
  ['wheel', 'touchstart', 'keydown', 'scroll'].forEach((e) =>
    addEventListener(e, cancel, { passive: true, once: true }));
}
function nudgeAmount(t) {
  // 새로고침으로 중간에서 복원됐으면 넛지할 자리가 아니다
  if (SNAP || REDUCED || touched || nudgeDone || nudgeAt < 0 || scrollY > 4) return 0;
  const u = (t - nudgeAt) / NUDGE_DUR;
  if (u < 0) return 0;
  if (u >= 1) { nudgeDone = true; return 0; }
  return Math.sin(Math.PI * u) * NUDGE_AMP;
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
  updateSnap(dt);
  rawT = scrollToT();
  targetT = clamp(rawT + nudgeAmount(t), 0, 7.9999);
  const k = SNAP || REDUCED ? 1 : 1 - Math.exp(-dt * (touching ? 11 : 5.2));
  T += (targetT - T) * k;
  director(t, dt);
  uiUpdate();
  post.composer.render();
  frames++;
  if (t - lastFpsT > 1) {
    fps = frames / (t - lastFpsT); frames = 0; lastFpsT = t;
    // 4초 이후부터 관찰 — 초기 컴파일 구간은 제외한다
    if (!SNAP && t > 4) {
      if (fps < 34) slowSec++; else slowSec = Math.max(0, slowSec - 1);
      if (slowSec >= 3 && tier > 0) { tier--; applyTier(); slowSec = 0; }
    }
  }
  if (!started) {
    started = true;
    if (loaderBar) loaderBar.style.width = '100%';
    document.fonts.ready.then(() => {
      token.redraw();
      coins.redraw();
      building.redrawAll();
      setTimeout(() => {
        loader.classList.add('hide');
        window.__ready = true;
        nudgeAt = clock.elapsedTime + NUDGE_WAIT;   // 로더가 걷힌 뒤부터 센다
      }, 150);
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
window.__info = () => ({ T: +T.toFixed(3), raw: +rawT.toFixed(3), fps: +fps.toFixed(1), tier, prog: +state.prog.toFixed(2), inv: +state.invest.toFixed(2), gro: +state.growth.toFixed(2), yld: +state.yield.toFixed(2) });
// 검수용. 이 씬은 소프트웨어 렌더러에서 1fps 미만이라 '한 프레임 뒤' 값을 읽기 쉬운데,
// 이 둘은 프레임을 기다리지 않고 지금 상태를 그대로 돌려준다.
window.__rawNow = () => scrollToT();      // scrollY 로 바로 계산한 워핑 후 T
window.__snapBusy = () => !!snap;         // 비트 스냅 진행 중인가
window.__brickCount = () => building.brickSys.count;
window.__tier = (n) => { tier = clamp(n, 0, 2); applyTier(); };
window.__probe = () => {
  const r = projectMassFront();
  return {
    scale: +state.tokScale.toFixed(3),
    // 건물 정면 실루엣이 화면에서 차지하는 비율 — 실사/브릭 정합과 잘림 확인용
    bx: [+(r.x0 / innerWidth).toFixed(3), +(r.x1 / innerWidth).toFixed(3)],
    by: [+(r.y0 / innerHeight).toFixed(3), +(r.y1 / innerHeight).toFixed(3)],
    // 좌우/상하 분할 상태 — lane 부호와 bx 가 반대로 움직이면 분할이 뒤집힌 것이다
    lane: +laneAt(T).toFixed(2),
    off: camera.view && camera.view.enabled ? [Math.round(camera.view.offsetX), Math.round(camera.view.offsetY)] : null,
  };
};
frame();
