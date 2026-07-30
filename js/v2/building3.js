// WeBlock 플래그십 — 레퍼런스(가평설악IC DT) 매싱을 브릭으로 재현
// 레고 설명서 구성 참고: 봉지1 = 부지+1층 / 봉지2 = 2층 / 3 = 3층+지붕
import * as THREE from 'three';
import { BrickGrid, buildBrickMeshes, MAT, U, BH } from './bricks.js';

// 그리드 범위: x 0..33 (좌→우), z 0..23 (뒤→앞), y 0..20 (아래→위)
export const GX = 34, GZ = 24, GY = 21;
export const ORIGIN_X = GX / 2, ORIGIN_Z = GZ / 2;
export const W_WIDTH = GX * U, W_DEPTH = GZ * U, W_HEIGHT = GY * BH;

// 층 경계 (설명서 봉지 = 3단계)
export const STAGE_Y = [5, 12, 20]; // 1단계 y<=5, 2단계 y<=12, 3단계 나머지

export function buildGrid() {
  const g = new BrickGrid();

  // ── [봉지 1] 부지 + 1층 ─────────────────────────────
  // 부지 베이스플레이트 (아스팔트) — 건물보다 넓게
  g.fill(-6, 39, -5, 28, 0, 0, MAT.ASPHALT);
  // 진입 보도 (밝은 스톤)
  g.fill(-6, 39, 24, 26, 0, 0, MAT.STONE);
  // 조경 띠
  g.fill(20, 33, -5, -3, 0, 0, MAT.GREEN);
  g.fill(-6, 2, -5, -3, 0, 0, MAT.GREEN);

  // 1층 실내 볼륨 (좌측): 스톤 벽 + 전면 유리
  g.shell(3, 16, 3, 20, 1, 5, MAT.STONE);
  g.fill(3, 16, 20, 20, 1, 5, MAT.GLASS);      // 전면 전체 유리
  g.fill(3, 3, 6, 17, 1, 5, MAT.GLASS);        // 좌측면 유리 슬릿
  g.fill(8, 12, 20, 20, 1, 1, MAT.DARK);       // 출입구 프레임 하단
  g.fill(9, 11, 20, 20, 2, 4, MAT.GLASS);      // 자동문

  // 1층 우측: 필로티 (드라이브스루 / 주차) — 다크 기둥만
  const cols = [[20, 5], [20, 18], [26, 5], [26, 18], [31, 11]];
  cols.forEach(([cx, cz]) => g.fill(cx, cx + 1, cz, cz + 1, 1, 5, MAT.DARK));
  // 코어 벽 (우측 안쪽 다크)
  g.fill(17, 19, 3, 4, 1, 5, MAT.DARK);

  // 우드 타워 (전면 중앙, 1층~지붕 관통)
  g.fill(16, 18, 17, 20, 1, 19, MAT.WOOD);

  // ── [봉지 2] 2층 ────────────────────────────────────
  g.fill(1, 32, 1, 22, 6, 6, MAT.STONE);       // 캔틸레버 슬래브
  g.shell(2, 31, 2, 21, 7, 12, MAT.GLASS);     // 유리 커튼월 링
  // 스톤 코너/측벽 (사진: 좌우 끝단은 솔리드)
  g.fill(2, 5, 2, 21, 7, 12, MAT.STONE);
  g.fill(2, 31, 2, 2, 7, 12, MAT.STONE);       // 후면 솔리드
  g.fill(29, 31, 2, 6, 7, 12, MAT.STONE);
  g.fill(2, 5, 18, 21, 7, 12, MAT.STONE);
  // 유리 사이 수직 멀리언 리듬 (다크)
  for (let x = 8; x <= 28; x += 3) g.fill(x, x, 21, 21, 7, 12, MAT.DARK);
  // 파사드 사인 밴드 (WeBlock 워드마크가 붙는 자리)
  g.fill(6, 15, 21, 21, 6, 6, MAT.WHITE);

  // ── [봉지 3] 3층 + 지붕 ─────────────────────────────
  g.fill(1, 32, 1, 22, 13, 13, MAT.STONE);     // 3층 슬래브 (캔틸레버)
  g.shell(6, 31, 5, 21, 14, 19, MAT.GLASS);
  g.fill(6, 9, 5, 21, 14, 19, MAT.STONE);      // 좌측 솔리드
  g.fill(6, 31, 5, 5, 14, 19, MAT.STONE);      // 후면 솔리드
  g.fill(28, 31, 5, 21, 14, 19, MAT.STONE);    // 우측 솔리드
  // 전면 테라스: 좌측 앞부분을 비우고 난간만
  g.clear(6, 15, 17, 21, 14, 19);
  g.fill(6, 15, 21, 21, 14, 14, MAT.WHITE);    // 난간 하단
  g.fill(6, 15, 21, 21, 15, 15, MAT.WHITE);    // 난간 상단
  g.fill(6, 6, 17, 21, 14, 15, MAT.WHITE);
  g.fill(6, 15, 17, 17, 14, 14, MAT.STONE);    // 테라스 바닥 마감
  // 지붕 슬래브 (오버행)
  g.fill(4, 32, 4, 22, 20, 20, MAT.STONE);
  // 옥상 설비 (다크 큐브)
  g.fill(22, 26, 8, 12, 21, 21, MAT.DARK);

  // 우드 타워가 지붕을 뚫고 살짝 올라오게
  g.fill(16, 18, 17, 20, 20, 20, MAT.WOOD);

  return g;
}

// ---------------------------------------------------------------- 로고 마크 (단일 사양)
// 업로드 로고 사양: 5열 × 세로 1:2 블록. 윗줄 0·2·4, 아랫줄 1·3 → 지그재그 W.
// 비율은 여기서만 정의하고 모든 렌더 지점이 이 값을 따른다 (찌그러짐 방지).
const MARK_COLS = 5;
const MARK_BH = 2;        // 블록 높이 ÷ 블록 폭
const MARK_DROP = 0.88;   // 아랫줄 내림폭 ÷ 블록 높이
const MARK_CELLS = [[0, 0], [2, 0], [4, 0], [1, 1], [3, 1]];
export const MARK_ASPECT = MARK_COLS / (MARK_BH * (1 + MARK_DROP)); // ≈ 1.33 : 1

// (cx, cy) 중심에 폭 markW로 그린다. 높이는 비율에서 파생되므로 절대 찌그러지지 않는다.
function drawMark(g, cx, cy, markW, color) {
  const u = markW / MARK_COLS;
  const bh = u * MARK_BH;
  const gap = u * 0.11;                       // 블록이 각각 하나의 브릭으로 읽히도록
  const x0 = cx - markW / 2;
  const y0 = cy - (bh * (1 + MARK_DROP)) / 2;
  g.fillStyle = color;
  MARK_CELLS.forEach(([bx, by]) =>
    g.fillRect(x0 + bx * u + gap / 2, y0 + by * bh * MARK_DROP + gap / 2, u - gap, bh - gap));
}
const MARK_VIOLET = '#5B16EE';   // 업로드 로고 원색
const MARK_LIGHT = '#F6F4FF';

// 원형 메달리온 (스타벅스 사인 위치 → WeBlock)
export function createMedallion() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = '#1a1030';
    g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
    g.lineWidth = 16; g.strokeStyle = '#8A5CFF';
    g.beginPath(); g.arc(256, 256, 238, 0, 7); g.stroke();
    drawMark(g, 256, 208, 268, MARK_LIGHT);
    g.fillStyle = MARK_LIGHT;
    g.font = '800 62px Pretendard, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('WeBlock', 256, 400);
    tex.needsUpdate = true;
  };
  draw();
  const group = new THREE.Group();
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const face = new THREE.Mesh(new THREE.CircleGeometry(26, 48), faceMat);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a1c4a, roughness: 0.5, metalness: 0.3 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 3, 48), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = -2;
  group.add(rim, face);
  // 우드 타워 전면(z+) 3층 높이에 부착
  group.position.set((17.5 - 17) * U, 16.2 * BH, (21 - 12) * U + 2);
  return { group, redraw: draw, mats: [faceMat, rimMat] };
}

// 파사드 워드마크 (사진의 'STARBUCKS' 자리)
// 캔버스를 글자 실측폭에 맞춰 만들고, 메시는 그 종횡비대로 스케일 → 늘어남 없음
export function createWordmark() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 220;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const H_WORLD = 16;
  const FONT = '800 120px Pretendard, sans-serif';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  const draw = () => {
    const H = 220, markW = 148, gap = 46, pad = 6;
    let g = c.getContext('2d');
    g.font = FONT;
    const W = Math.ceil(pad * 2 + markW + gap + g.measureText('WeBlock').width);
    if (c.width !== W) c.width = W;      // 캔버스 리사이즈 시 컨텍스트가 초기화된다
    if (c.height !== H) c.height = H;
    g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    drawMark(g, pad + markW / 2, H / 2, markW, MARK_VIOLET);
    g.fillStyle = '#20242e';
    g.font = FONT;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('WeBlock', pad + markW + gap, H / 2 + 4);
    tex.needsUpdate = true;
    mesh.scale.set(H_WORLD * (W / H), H_WORLD, 1);
  };
  draw();
  mesh.position.set((10.5 - 17) * U, 6.55 * BH, (22 - 12) * U + 6.2);
  return { mesh, redraw: draw, mats: [mesh.material] };
}

// 폴 사인 (레퍼런스의 드라이브스루 기둥) — 브릭 폴 + 메달리온
export function createPoleSign() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.7, metalness: 0.3 });
  const pole = new THREE.Mesh(new THREE.BoxGeometry(7, 210, 7), poleMat);
  pole.position.y = 105;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#1a1030';
    g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.lineWidth = 9; g.strokeStyle = '#8A5CFF';
    g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
    drawMark(g, 128, 104, 134, MARK_LIGHT);
    g.fillStyle = MARK_LIGHT;
    g.font = '800 30px Pretendard, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('WeBlock', 128, 200);
    tex.needsUpdate = true;
  };
  draw();
  const signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const s1 = new THREE.Mesh(new THREE.CircleGeometry(26, 40), signMat);
  s1.position.set(0, 200, 4.2);
  const s2 = s1.clone(); s2.rotation.y = Math.PI; s2.position.z = -4.2;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(27, 27, 8, 40), poleMat);
  disc.rotation.x = Math.PI / 2; disc.position.y = 200;
  // 하단 안내 플레이트
  const plate = new THREE.Mesh(new THREE.BoxGeometry(44, 26, 5), poleMat);
  plate.position.y = 156;
  const pc = document.createElement('canvas');
  pc.width = 256; pc.height = 128;
  const ptex = new THREE.CanvasTexture(pc);
  ptex.colorSpace = THREE.SRGBColorSpace;
  const drawP = () => {
    const g = pc.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = '#F2F0FA';
    g.font = '800 44px Pretendard, sans-serif';
    g.textAlign = 'center';
    g.fillText('FRACTION', 128, 58);
    g.font = '600 34px Pretendard, sans-serif';
    g.fillStyle = '#9d7bff';
    g.fillText('1 / 100,000', 128, 104);
    ptex.needsUpdate = true;
  };
  drawP();
  const plateMat = new THREE.MeshBasicMaterial({ map: ptex, transparent: true, toneMapped: false });
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(42, 21), plateMat);
  pf.position.set(0, 156, 2.8);
  group.add(pole, disc, s1, s2, plate, pf);
  group.position.set((-4 - 17) * U, 0, (20 - 12) * U);
  return { group, redraw: () => { draw(); drawP(); }, mats: [poleMat, signMat, plateMat] };
}

// ---------------------------------------------------------------- 브릭 자동차 (주차 라인)
export function createCars(envMap) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe9e9ec, roughness: 0.45, metalness: 0.25, envMap, envMapIntensity: 1.0 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x2a3446, roughness: 0.15, metalness: 0, envMap, envMapIntensity: 1.4, transparent: true, opacity: 0.75 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x191b1f, roughness: 0.9 });
  const mk = (x, z, rotY) => {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(40, 11, 19), bodyMat);
    body.position.y = 9;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 17), glassMat);
    cabin.position.set(-2, 18, 0);
    [[-13, 9.5], [13, 9.5], [-13, -9.5], [13, -9.5]].forEach(([tx, tz]) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 12), tireMat);
      t.rotation.x = Math.PI / 2;
      t.position.set(tx, 5, tz);
      car.add(t);
    });
    car.add(body, cabin);
    car.position.set(x, 0, z);
    car.rotation.y = rotY;
    group.add(car);
  };
  mk((23 - 17) * U, (21.5 - 12) * U, 0);
  mk((28 - 17) * U, (21.5 - 12) * U, 0);
  mk((33 - 17) * U, (21.5 - 12) * U, 0);
  return { group, mats: [bodyMat, glassMat, tireMat] };
}

// ---------------------------------------------------------------- 토큰 코인 (업로드한 원형 심벌)
function drawTokenFace(c) {
  const S = 512, R = S / 2;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  // 바이올렛 원판 = 업로드 심벌
  g.fillStyle = MARK_VIOLET;
  g.beginPath(); g.arc(R, R, R, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 5;
  g.beginPath(); g.arc(R, R, R - 24, 0, 7); g.stroke();
  drawMark(g, R, R - 30, 244, '#E4DCFF');   // 순백은 블룸에 뭉개져 형태가 사라진다
  g.fillStyle = 'rgba(228,220,255,0.92)';
  g.font = '700 38px Pretendard, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('1 / 100,000', R, R + 148);
}
export function createToken(envMap) {
  const group = new THREE.Group();
  const R = 46, D = 7;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const redraw = () => { drawTokenFace(c); tex.needsUpdate = true; };
  redraw();
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d10a8, metalness: 0.85, roughness: 0.24, envMap, envMapIntensity: 1.2, transparent: true,
  });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(R, R, D, 72), rimMat);
  rim.rotation.x = Math.PI / 2;
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.995, 72), faceMat);
  face.position.z = D / 2 + 0.12;
  const face2 = face.clone(); face2.rotation.y = Math.PI; face2.position.z = -D / 2 - 0.12;
  group.add(rim, face, face2);
  group.visible = false;
  return { group, mats: [rimMat, faceMat], redraw };
}

// ---------------------------------------------------------------- 전체 조립
export function createBuilding(envMap) {
  const grid = buildGrid();
  const bricks = grid.toBricks();
  const brickSys = buildBrickMeshes(bricks, envMap, { originX: ORIGIN_X, originZ: ORIGIN_Z });
  const group = new THREE.Group();
  brickSys.meshes.forEach((m) => group.add(m));

  const medallion = createMedallion();
  const wordmark = createWordmark();
  const pole = createPoleSign();
  const cars = createCars(envMap);
  group.add(medallion.group, wordmark.mesh, pole.group, cars.group);

  // 실내 웜 라이트 (유리 너머 밝기)
  const lampC = document.createElement('canvas'); lampC.width = lampC.height = 64;
  {
    const g = lampC.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,222,175,1)');
    gr.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const lampTex = new THREE.CanvasTexture(lampC);
  const lamps = new THREE.Group();
  const lampMats = [];
  const put = (gx, gy, gz, s) => {
    const m = new THREE.SpriteMaterial({ map: lampTex, color: 0xffd9a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    lampMats.push(m);
    const sp = new THREE.Sprite(m);
    sp.scale.setScalar(s);
    sp.position.set((gx - ORIGIN_X) * U, gy * BH, (gz - ORIGIN_Z) * U);
    lamps.add(sp);
  };
  for (let i = 0; i < 14; i++) put(4.5 + i * 0.85, 3.2, 10 + (i % 4) * 3, 15);     // 1F
  for (let i = 0; i < 18; i++) put(4 + i * 1.6, 9.6, 7 + (i % 5) * 3.2, 17);      // 2F
  for (let i = 0; i < 14; i++) put(8 + i * 1.6, 16.6, 8 + (i % 4) * 3.2, 16);     // 3F
  for (let i = 0; i < 7; i++) put(19 + i * 2.4, 4.8, 11 + (i % 2) * 6, 20);       // 필로티 다운라이트
  for (let i = 0; i < 4; i++) put(22 + i * 3.5, 1.6, 21, 16);                     // 주차 바닥 워시
  group.add(lamps);

  return {
    group, brickSys, medallion, wordmark, pole, cars, lamps, lampMats,
    redrawAll() { medallion.redraw(); wordmark.redraw(); pole.redraw(); },
    update(state, t) {
      const bu = brickSys.u;
      bu.uTime.value = t;
      bu.uProg.value = state.prog;
      bu.uShatter.value = state.shatter;
      bu.uRingRot.value = state.ringRot;
      bu.uGhostB.value = state.holo;
      bu.uSweepY.value = state.sweepY;
      bu.uSweepI.value = state.sweepI;
      const litFade = state.interiorI;
      lampMats.forEach((m, i) => (m.opacity = litFade * (0.5 + 0.5 * Math.sin(t * 0.7 + i))));
      lamps.visible = litFade > 0.02;
      const sigA = state.sign * (1 - state.shatter);
      medallion.mats.forEach((m) => { m.transparent = true; m.opacity = sigA; });
      wordmark.mats.forEach((m) => (m.opacity = sigA));
      medallion.group.visible = sigA > 0.02;
      wordmark.mesh.visible = sigA > 0.02;
      pole.group.visible = state.prog > 0.02 && state.shatter < 0.85;
      pole.mats.forEach((m) => { m.transparent = true; m.opacity = Math.min(state.prog * 2.2, 1) * (1 - state.shatter); });
      cars.group.visible = state.cars > 0.02 && state.shatter < 0.5;
      cars.mats.forEach((m) => { m.transparent = true; m.opacity = state.cars * (1 - state.shatter * 2); });
    },
  };
}
